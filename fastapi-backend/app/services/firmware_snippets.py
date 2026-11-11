"""Generate device configuration fragments from the effective broker settings."""

import json

from app.core.config import get_settings


def make_firmware_snippet(device_uid: str, device_secret: str, username: str | None = None) -> str:
    settings = get_settings()
    username = username or f"dev_{device_uid}"
    # Configuration fragment only: firmware must supply its trusted CA/bundle.
    return "\n".join(
        [
            "// Device MQTT config. Password is returned only at registration/rotation.",
            f"const char* MQTT_HOST = {json.dumps(settings.mqtt_host)};",
            f"const int MQTT_PORT = {settings.mqtt_port};",
            f"const bool MQTT_TLS = {str(settings.mqtt_tls).lower()};",
            f"const char* MQTT_USERNAME = {json.dumps(username)};",
            f"const char* MQTT_PASSWORD = {json.dumps(device_secret)};",
            f"const char* MQTT_CLIENT_ID = {json.dumps(username)};",
            f"const char* DEVICE_UID = {json.dumps(device_uid)};",
            f"const char* TOPIC_PUB = {json.dumps(f'sensors/{device_uid}/telemetry')};",
            f"const char* TOPIC_IMAGE = {json.dumps(f'sensors/{device_uid}/image')};",
            f"const char* TOPIC_CMD = {json.dumps(f'cmd/{device_uid}/#')};",
            "// TLS: use WiFiClientSecure with the broker trusted root CA or a CA bundle.",
            "// ESP32 does not inherit the desktop OS CA store. Do not use WiFiClient on a TLS port.",
        ]
    )
