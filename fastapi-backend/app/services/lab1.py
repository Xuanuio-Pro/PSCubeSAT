"""Buildable Lab 1 starter and the board profiles shared with the frontend."""

from hashlib import sha256
from pathlib import Path

BOARD_PROFILES = {
    "esp32": {
        "board_id": "esp32doit-devkit-v1",
        "chip": "esp32",
        "label": "ESP32 DOIT DevKit V1 (4 MB)",
        "serial_transport": "uart",
        "flash_size": "4MB",
    },
    "esp32s3": {
        "board_id": "esp32-s3-devkitc-1",
        "chip": "esp32s3",
        "label": "ESP32-S3 DevKitC-1-N8 (8 MB, no PSRAM)",
        "serial_transport": "usb_cdc",
        "flash_size": "8MB",
    },
}
TEMPLATE_PATH = Path(__file__).resolve().parents[1] / "firmware" / "lab1.cpp"


def get_template(board: str) -> dict:
    profile = BOARD_PROFILES[board]
    code = TEMPLATE_PATH.read_text(encoding="utf-8")
    return {
        "lab_id": 1,
        "template_version": "1.0.0",
        "board": board,
        **profile,
        "code": code,
        "source_sha256": sha256(code.encode()).hexdigest(),
        "serial": {
            "baud_rate": 115200,
            "transport": profile["serial_transport"],
            "format": "ndjson",
            "commands": ["ping", "status", "led on", "led off", "blink"],
        },
        "led": {
            "pin": 2,
            "external": board == "esp32s3",
            "note": "GPIO2 -> điện trở 330 ohm -> LED -> GND. ESP32-S3 không dùng RGB LED tích hợp.",
        },
    }
