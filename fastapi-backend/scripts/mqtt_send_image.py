"""Publish one JPEG to sensors/<device_uid>/image, as the camera firmware will.

Run: python fastapi-backend/scripts/mqtt_send_image.py <device_uid> <photo.jpg>
Uses the backend service account from .env. The device must exist, be enabled and
be owned; then the image appears in GET /api/telemetry/images/<device_uid> and in
the Camera Viewer (device/MQTT source).
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import aiomqtt

from app.core.config import get_settings
from app.core.mqtt_transport import mqtt_error_detail, mqtt_tls_context
from app.services.device_images import MAX_IMAGE_BYTES, is_jpeg


async def send(device_uid: str, photo: Path) -> int:
    data = photo.read_bytes()
    if len(data) > MAX_IMAGE_BYTES or not is_jpeg(data):
        print(f"Not a complete JPEG within {MAX_IMAGE_BYTES} bytes: {photo}")
        return 2
    settings = get_settings()
    try:
        async with aiomqtt.Client(
            hostname=settings.mqtt_host,
            port=settings.mqtt_port,
            username=settings.mqtt_username,
            password=settings.mqtt_password,
            tls_context=mqtt_tls_context(settings),
            timeout=10,
        ) as client:
            await client.publish(f"sensors/{device_uid}/image", data, qos=1)
    except Exception as exc:
        print("Publish failed:", mqtt_error_detail(exc, settings))
        return 1
    print(f"Published {len(data)} bytes to sensors/{device_uid}/image")
    return 0


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("device_uid")
    parser.add_argument("photo", type=Path)
    arguments = parser.parse_args()
    sys.exit(asyncio.run(send(arguments.device_uid, arguments.photo)))
