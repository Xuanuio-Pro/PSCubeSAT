"""
mosquitto_mgr.py
────────────────
Quản lý Mosquitto passwd + ACL:
  - Ghi passwd bằng Python PBKDF2-SHA512 thuần (không cần CLI)
  - Reload Mosquitto qua Docker Python SDK (docker exec kill -HUP 1)
  - Ghi ACL block trực tiếp vào bind-mounted /mosquitto/config/acl
"""
import base64
import hashlib
import os
import re
import asyncio
from pathlib import Path
from functools import lru_cache

from loguru import logger

# Bind mount trong FastAPI container
_CONFIG_DIR  = Path("/mosquitto/config")
_PASSWD_FILE = _CONFIG_DIR / "passwd"
_ACL_FILE    = _CONFIG_DIR / "acl"
_ACL_AUTO_BEGIN = "# ── AUTO-MANAGED DEVICES (do NOT edit manually) ──"
_MOSQUITTO_CONTAINER = "mosquitto"

# Mosquitto 2.x PBKDF2 parameters (reverse-engineered từ mosquitto_passwd binary)
_ITERATIONS = 1000   # mosquitto_passwd default iterations
_SALT_LEN   = 64    # 64 bytes salt → 88 chars base64 (đúng format Mosquitto 2.x)


def _get_docker_client():
    try:
        import docker  # type: ignore
        return docker.from_env()
    except Exception as e:
        logger.warning(f"[MosqMgr] Docker SDK unavailable: {e}")
        return None


# ── passwd file management (dùng mosquitto_passwd binary qua Docker SDK) ──────

def _write_passwd_via_sdk(username: str, password: str) -> bool:
    """
    Gọi mosquitto_passwd trong container Mosquitto qua Docker SDK.
    Đây là cách duy nhất đảm bảo 100% đúng format hash.
    """
    client = _get_docker_client()
    if client is None:
        return False
    try:
        container = client.containers.get(_MOSQUITTO_CONTAINER)
        # -b: batch mode, -U: update existing (không tạo mới file)
        # Dùng -b với file đích trong container
        result = container.exec_run(
            f'mosquitto_passwd -b /mosquitto/config/passwd "{username}" "{password}"'
        )
        if result.exit_code != 0:
            logger.error(f"[MosqMgr] mosquitto_passwd exec failed: {result.output.decode()}")
            return False
        logger.debug(f"[MosqMgr] passwd written via SDK for {username}")
        return True
    except Exception as e:
        logger.error(f"[MosqMgr] _write_passwd_via_sdk error: {e}")
        return False
    finally:
        client.close()


def _delete_passwd_via_sdk(username: str) -> bool:
    """Xoá entry khỏi passwd qua Docker SDK."""
    client = _get_docker_client()
    if client is None:
        return False
    try:
        container = client.containers.get(_MOSQUITTO_CONTAINER)
        result = container.exec_run(
            f'mosquitto_passwd -D /mosquitto/config/passwd "{username}"'
        )
        logger.debug(f"[MosqMgr] passwd deleted via SDK for {username}")
        return result.exit_code == 0
    except Exception as e:
        logger.error(f"[MosqMgr] _delete_passwd_via_sdk error: {e}")
        return False
    finally:
        client.close()


def _delete_passwd(username: str) -> None:
    if not _PASSWD_FILE.exists():
        return
    lines = _PASSWD_FILE.read_text(encoding="utf-8").splitlines(keepends=True)
    _PASSWD_FILE.write_text(
        "".join(l for l in lines if not l.startswith(f"{username}:")),
        encoding="utf-8",
    )
    logger.debug(f"[MosqMgr] passwd removed for {username}")


# ── ACL file management ───────────────────────────────────────────────────────

def _append_acl(device_id: str) -> None:
    content = _ACL_FILE.read_text(encoding="utf-8") if _ACL_FILE.exists() else ""
    if _ACL_AUTO_BEGIN not in content:
        content += f"\n{_ACL_AUTO_BEGIN}\n"
    if f"user {device_id}" in content:
        return
    content += (
        f"\nuser {device_id}\n"
        f"topic write sensors/{device_id}/#\n"
        f"topic write status/{device_id}\n"
        f"topic read  cmd/{device_id}\n"
    )
    _ACL_FILE.write_text(content, encoding="utf-8")
    logger.debug(f"[MosqMgr] ACL appended for {device_id}")


def _remove_acl(device_id: str) -> None:
    if not _ACL_FILE.exists():
        return
    content = _ACL_FILE.read_text(encoding="utf-8")
    pattern = rf"\nuser {re.escape(device_id)}\n(?:topic [^\n]+\n)*"
    _ACL_FILE.write_text(re.sub(pattern, "\n", content), encoding="utf-8")
    logger.debug(f"[MosqMgr] ACL removed for {device_id}")


# ── Mosquitto reload ──────────────────────────────────────────────────────────

async def _reload_mosquitto() -> None:
    """Gửi SIGHUP vào Mosquitto container qua Docker Python SDK."""
    def _do_reload():
        client = _get_docker_client()
        if client is None:
            return False
        try:
            container = client.containers.get(_MOSQUITTO_CONTAINER)
            result = container.exec_run("kill -HUP 1")
            return result.exit_code == 0
        except Exception as e:
            logger.warning(f"[MosqMgr] reload via SDK failed: {e}")
            return False
        finally:
            client.close()

    loop = asyncio.get_event_loop()
    ok   = await loop.run_in_executor(None, _do_reload)
    if ok:
        logger.success("[MosqMgr] Mosquitto reloaded via SIGHUP ✓")
    else:
        logger.warning("[MosqMgr] SIGHUP failed — Mosquitto sẽ nhận creds sau khi restart")


# ── Public API ────────────────────────────────────────────────────────────────

async def add_device(device_id: str, device_secret: str) -> bool:
    loop = asyncio.get_event_loop()
    # Gọi mosquitto_passwd qua Docker SDK (chạy trong thread pool)
    ok = await loop.run_in_executor(None, _write_passwd_via_sdk, device_id, device_secret)
    if not ok:
        return False
    try:
        _append_acl(device_id)
        await _reload_mosquitto()
        logger.success(f"[MosqMgr] ✅ Device added: {device_id}")
        return True
    except Exception as e:
        logger.error(f"[MosqMgr] add_device error: {e}")
        return False


async def remove_device(device_id: str) -> bool:
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _delete_passwd_via_sdk, device_id)
    try:
        _remove_acl(device_id)
        await _reload_mosquitto()
        logger.info(f"[MosqMgr] 🗑️ Device removed: {device_id}")
        return True
    except Exception as e:
        logger.error(f"[MosqMgr] remove_device error: {e}")
        return False


def list_device_ids() -> list[str]:
    if not _ACL_FILE.exists():
        return []
    content = _ACL_FILE.read_text(encoding="utf-8")
    if _ACL_AUTO_BEGIN not in content:
        return []
    return re.findall(r"^user (.+)$", content.split(_ACL_AUTO_BEGIN, 1)[1], re.MULTILINE)
