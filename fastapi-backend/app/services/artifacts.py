"""Immutable build snapshots. No download ever reads a mutable board cache."""

import json
import re
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path

from app.services.lab1 import BOARD_PROFILES

ARTIFACT_DIR = Path(__file__).resolve().parents[2] / "build_cache" / "artifacts"
TTL_SECONDS = 3600
MAX_IMAGE_BYTES = 16 * 1024 * 1024
_ID = re.compile(r"^[a-f0-9]{32}$")


class ArtifactNotFound(Exception):
    pass


class ArtifactExpired(Exception):
    pass


def cleanup_expired() -> None:
    if not ARTIFACT_DIR.exists():
        return
    now = datetime.now(timezone.utc)
    for directory in ARTIFACT_DIR.iterdir():
        if not directory.is_dir() or not _ID.fullmatch(directory.name):
            continue
        try:
            info = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
            if datetime.fromisoformat(info["expires_at"]) <= now:
                shutil.rmtree(directory)
        except (OSError, ValueError, KeyError):
            # Another request may already have removed the expired directory.
            continue


def create_artifact(
    board: str,
    code: str,
    build_dir: Path,
    *,
    owner_id: int | None,
    lab_id: int | None,
    config_sha256: str,
) -> dict:
    raw = json.loads((build_dir / "flash-manifest.json").read_text(encoding="utf-8"))
    if raw["chip"] != BOARD_PROFILES[board]["chip"]:
        raise ValueError("Flash manifest không khớp board đã chọn.")
    entries = sorted(raw["files"], key=lambda item: item["offset"])
    names = {Path(item["path"]).name for item in entries}
    if not {"bootloader.bin", "partitions.bin", "boot_app0.bin", "firmware.bin"}.issubset(names):
        raise ValueError("Thiếu bộ ảnh bootloader/partition/application để nạp.")
    identifier = uuid.uuid4().hex
    directory = ARTIFACT_DIR / identifier
    directory.mkdir(parents=True)
    try:
        files = []
        end = 0
        for item in entries:
            source = Path(item["path"])
            name = source.name
            data = source.read_bytes()
            offset = item["offset"]
            if (
                not isinstance(offset, int)
                or offset < end
                or not data
                or len(data) > MAX_IMAGE_BYTES
            ):
                raise ValueError("Flash image có kích thước hoặc offset không hợp lệ.")
            if any(existing["name"] == name for existing in files):
                raise ValueError("Flash image có tên trùng nhau.")
            end = offset + len(data)
            (directory / name).write_bytes(data)
            files.append(
                {
                    "name": name,
                    "offset": offset,
                    "size": len(data),
                    "sha256": sha256(data).hexdigest(),
                    "download_url": f"/api/artifacts/{identifier}/files/{name}",
                }
            )
        now = datetime.now(timezone.utc)
        profile = BOARD_PROFILES[board]
        info = {
            "schema_version": 1,
            "id": identifier,
            "board": board,
            "board_id": profile["board_id"],
            "chip": profile["chip"],
            "lab_id": lab_id,
            "source_sha256": sha256(code.encode("utf-8")).hexdigest(),
            "build_config_sha256": config_sha256,
            "created_at": now.isoformat(),
            "expires_at": (now + timedelta(seconds=TTL_SECONDS)).isoformat(),
            "serial": {"baud_rate": 115200, "transport": profile["serial_transport"]},
            "flash": {
                "mode": raw["mode"],
                "frequency": raw["frequency"],
                "size": raw["size"],
                "erase_all": False,
                "files": files,
            },
            "manifest_url": f"/api/artifacts/{identifier}",
            "_owner_id": owner_id,
        }
        (directory / "manifest.json").write_text(json.dumps(info), encoding="utf-8")
        return public_manifest(info)
    except BaseException:
        shutil.rmtree(directory)
        raise


def public_manifest(info: dict) -> dict:
    return {key: value for key, value in info.items() if not key.startswith("_")}


def get_artifact(identifier: str, user_id: int | None) -> dict:
    if not _ID.fullmatch(identifier):
        raise ArtifactNotFound()
    try:
        info = json.loads((ARTIFACT_DIR / identifier / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise ArtifactNotFound() from None
    if info["_owner_id"] is not None and info["_owner_id"] != user_id:
        raise ArtifactNotFound()
    if datetime.fromisoformat(info["expires_at"]) <= datetime.now(timezone.utc):
        raise ArtifactExpired()
    return public_manifest(info)


def get_file(identifier: str, name: str, user_id: int | None) -> tuple[Path, dict]:
    info = get_artifact(identifier, user_id)
    entry = next((entry for entry in info["flash"]["files"] if entry["name"] == name), None)
    if entry is None or Path(name).name != name:
        raise ArtifactNotFound()
    path = ARTIFACT_DIR / identifier / name
    if not path.is_file():
        raise ArtifactNotFound()
    return path, entry
