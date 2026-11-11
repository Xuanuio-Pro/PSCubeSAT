"""Latest JPEG captures received from devices over MQTT (`sensors/{uid}/image`)."""

import shutil
import time
from pathlib import Path

MAX_IMAGE_BYTES = 2 * 1024 * 1024
KEEP_IMAGES = 10  # ponytail: ring of files on local disk; move to object storage if multi-worker.
IMAGE_ROOT = Path(__file__).resolve().parents[2] / "data" / "device-images"


def is_jpeg(data: bytes) -> bool:
    return len(data) > 4 and data[:2] == b"\xff\xd8" and data[-2:] == b"\xff\xd9"


def save_image(device_uid: str, data: bytes, root: Path = IMAGE_ROOT) -> str:
    """Persist one validated JPEG and return its id (nanosecond timestamp, unique per device)."""
    folder = root / device_uid
    folder.mkdir(parents=True, exist_ok=True)
    stamp = time.time_ns()
    # Clock resolution can repeat a timestamp; never let a newer image overwrite an older one.
    while (folder / f"{stamp}.jpg").exists():
        stamp += 1
    image_id = str(stamp)
    temporary = folder / f"{image_id}.tmp"
    temporary.write_bytes(data)
    temporary.replace(folder / f"{image_id}.jpg")
    for old in sorted(folder.glob("*.jpg"), key=lambda path: int(path.stem))[:-KEEP_IMAGES]:
        old.unlink(missing_ok=True)
    return image_id


def list_images(device_uid: str, root: Path = IMAGE_ROOT) -> list[str]:
    """Image ids, newest first."""
    folder = root / device_uid
    if not folder.is_dir():
        return []
    return [
        path.stem for path in sorted(folder.glob("*.jpg"), key=lambda p: int(p.stem), reverse=True)
    ]


def image_path(device_uid: str, image_id: str, root: Path = IMAGE_ROOT) -> Path | None:
    if not image_id.isdigit():
        return None
    path = root / device_uid / f"{image_id}.jpg"
    return path if path.is_file() else None


def clear_images(device_uid: str, root: Path = IMAGE_ROOT) -> None:
    shutil.rmtree(root / device_uid, ignore_errors=True)
