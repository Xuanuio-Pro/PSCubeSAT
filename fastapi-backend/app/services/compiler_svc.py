import asyncio
import base64
import time
from hashlib import sha256
from pathlib import Path
from typing import Literal

from filelock import FileLock
from filelock import Timeout as FileLockTimeout
from loguru import logger

from app.services import artifacts, compiler_sandbox
from app.services.build_config import _PIO_INI
from app.services.lab1 import BOARD_PROFILES

_BASE_DIR = Path(__file__).resolve().parent.parent.parent / "build_cache"
_BOARD_DIRS: dict[str, Path] = {
    "esp32s3": _BASE_DIR / "esp32s3",
    "esp32": _BASE_DIR / "esp32",
}


def _ok(**extra) -> dict:
    """Helper: response thành công — luôn có compilerInstalled=True (cả hai kiểu)."""
    return {"success": True, "compilerInstalled": True, "compiler_installed": True, **extra}


def _err(message: str, installed: bool = True, **extra) -> dict:
    """Helper: response lỗi — luôn có compilerInstalled (cả hai kiểu)."""
    return {
        "success": False,
        "compilerInstalled": installed,
        "compiler_installed": installed,
        "message": message,
        **extra,
    }


async def _find_pio() -> list[str] | None:
    # Never fall back to host PlatformIO, even if it is installed.
    try:
        return ["sandbox"] if await compiler_sandbox.image_id() else None
    except OSError:
        return None


def _init_board_cache(board: str) -> None:
    board_dir = _BOARD_DIRS[board]
    (board_dir / "src").mkdir(parents=True, exist_ok=True)
    ini_path = board_dir / "platformio.ini"
    # Config and export script are server-owned, never supplied by user code.
    ini_path.write_text(_PIO_INI[board], encoding="utf-8")
    script = Path(__file__).resolve().parents[1] / "firmware" / "export_flash_manifest.py"
    (board_dir / script.name).write_bytes(script.read_bytes())


def init_all_caches() -> None:
    for board in _BOARD_DIRS:
        (_BOARD_DIRS[board] / "src").mkdir(parents=True, exist_ok=True)


BUILD_TIMEOUT_SECONDS = 600
QUEUE_TIMEOUT_SECONDS = 60


async def _run_build(command: list[str]) -> tuple[int, str]:
    if command[0] != "sandbox":
        raise OSError("Host compiler execution is disabled")
    board = command[command.index("-e") + 1]
    directory = Path(command[command.index("-d") + 1])
    return await compiler_sandbox.run(
        (directory / "src/main.cpp").read_bytes().decode("utf-8"),
        board,
        directory / ".pio/build" / board,
        BUILD_TIMEOUT_SECONDS,
    )


async def compile_code(
    code: str,
    board: Literal["esp32s3", "esp32"],
    *,
    owner_id: int | None = None,
    lab_id: int | None = None,
    include_binary: bool = True,
) -> dict:
    if board not in _BOARD_DIRS:
        return _err(f"Board không hợp lệ: {board}")

    pio_cmd = await _find_pio()
    if not pio_cmd:
        return _err(
            "Compiler sandbox chưa sẵn sàng. Cần Docker và image compiler.",
            installed=False,
            error_code="COMPILER_UNAVAILABLE",
        )

    board_dir = _BOARD_DIRS[board]
    src_file = board_dir / "src" / "main.cpp"

    # FileLock also protects the mutable board cache across API worker processes.
    board_dir.mkdir(parents=True, exist_ok=True)
    lock = FileLock(board_dir / ".compile.lock", thread_local=False)
    queued_at = time.monotonic()
    acquired = False
    admission = None
    try:
        # Bound queued + running requests across API processes on this cache volume.
        for index in range(4):
            candidate = FileLock(board_dir.parent / f".compiler-slot-{index}", thread_local=False)
            try:
                candidate.acquire(timeout=0)
                admission = candidate
                break
            except FileLockTimeout:
                continue
        if admission is None:
            return _err("Hàng đợi compiler đã đầy. Vui lòng thử lại.", error_code="COMPILER_BUSY")
        while not acquired:
            try:
                lock.acquire(timeout=0)
                acquired = True
            except FileLockTimeout:
                if time.monotonic() - queued_at >= QUEUE_TIMEOUT_SECONDS:
                    return _err("Compiler đang bận. Vui lòng thử lại.", error_code="COMPILER_BUSY")
                await asyncio.sleep(0.1)
        _init_board_cache(board)
        t0 = time.monotonic()
        # Preserve exactly the bytes the frontend hashed, including LF on Windows.
        src_file.write_bytes(code.encode("utf-8"))
        try:
            returncode, full_logs = await _run_build(
                [*pio_cmd, "run", "-e", board, "-d", str(board_dir)]
            )
        except asyncio.TimeoutError:
            return _err(
                f"Build timeout ({BUILD_TIMEOUT_SECONDS}s).",
                error_code="BUILD_TIMEOUT",
                duration_ms=int((time.monotonic() - t0) * 1000),
            )
        except (OSError, ValueError, KeyError, TypeError) as exc:
            logger.error(f"[Compiler] Không thể khởi chạy PlatformIO: {type(exc).__name__}")
            return _err(
                "Compiler sandbox chưa sẵn sàng hoặc trả dữ liệu không hợp lệ.",
                installed=False,
                error_code="COMPILER_UNAVAILABLE",
            )
        duration_ms = int((time.monotonic() - t0) * 1000)
        if returncode != 0:
            return _err(
                "Lỗi biên dịch C++! Vui lòng kiểm tra mã nguồn.",
                error_code="BUILD_FAILED",
                logs=full_logs,
                duration_ms=duration_ms,
            )
        build_dir = board_dir / ".pio" / "build" / board
        try:
            config_hash = sha256(
                (
                    _PIO_INI[board]
                    + (board_dir / "export_flash_manifest.py").read_text(encoding="utf-8")
                ).encode()
            ).hexdigest()
            # Snapshot every file while holding the lock; later builds cannot mutate this artifact.
            snapshot_task = asyncio.create_task(
                asyncio.to_thread(
                    artifacts.create_artifact,
                    board,
                    code,
                    build_dir,
                    owner_id=owner_id,
                    lab_id=lab_id,
                    config_sha256=config_hash,
                )
            )
            try:
                artifact = await asyncio.shield(snapshot_task)
            except asyncio.CancelledError:
                # Do not release the cache lock while the snapshot thread still reads its files.
                await asyncio.shield(snapshot_task)
                raise
            bin_bytes = (artifacts.ARTIFACT_DIR / artifact["id"] / "firmware.bin").read_bytes()
            await asyncio.to_thread(artifacts.cleanup_expired)
        except (OSError, ValueError, KeyError) as exc:
            logger.error(f"[Compiler] Không thể đóng gói flash artifact: {type(exc).__name__}")
            return _err(
                "Không thể tạo bộ firmware đầy đủ để nạp.",
                error_code="ARTIFACT_FAILED",
                logs=full_logs,
                duration_ms=duration_ms,
            )
        response = _ok(
            artifact=artifact,
            board=board,
            chip=BOARD_PROFILES[board]["chip"],
            source_sha256=artifact["source_sha256"],
            binSize=len(bin_bytes),
            bin_size=len(bin_bytes),
            fileName="firmware.bin",
            file_name="firmware.bin",
            logs=full_logs,
            duration_ms=duration_ms,
        )
        if include_binary:
            response["binBase64"] = response["bin_base64"] = base64.b64encode(bin_bytes).decode()
        logger.success(
            f"[Compiler] Build OK board={board} artifact={artifact['id']} ({duration_ms}ms)"
        )
        return response
    finally:
        if acquired:
            lock.release()
        if admission is not None:
            admission.release()
