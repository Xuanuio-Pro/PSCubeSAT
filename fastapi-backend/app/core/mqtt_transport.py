"""Shared MQTT TLS policy for the API, simulator and diagnostic probe."""

import ssl
from pathlib import Path

from aiomqtt.exceptions import MqttConnectError

from app.core.config import Settings

_CONNACK_REASONS = {
    1: "Incorrect protocol version",
    2: "Invalid client identifier",
    3: "Server unavailable",
    4: "Bad username or password",
    5: "Not authorized",
}


def mqtt_tls_context(settings: Settings) -> ssl.SSLContext | None:
    if not settings.mqtt_tls:
        return None
    if not settings.mqtt_tls_verify:
        # Explicit development opt-out only: TLS encryption remains enabled.
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        return context
    ca = Path(settings.mqtt_ca_file).expanduser() if settings.mqtt_ca_file else None
    if ca and not ca.is_absolute():
        ca = Path(__file__).resolve().parents[2] / ca
    return ssl.create_default_context(cafile=str(ca) if ca else None)


def redact_mqtt_secrets(text: str, settings: Settings) -> str:
    for value in (settings.mqtt_password, settings.mqtt_admin_password):
        if value:
            text = text.replace(value, "[REDACTED]")
    # Broker strings are data: prevent multiline/terminal control injection.
    return "".join(c if c.isprintable() else " " for c in text)[:1000]


def mqtt_error_detail(exc: Exception, settings: Settings) -> str:
    code = getattr(exc, "rc", None)
    detail = f"{type(exc).__name__}: {exc}"
    if code is not None:
        detail += f" (CONNACK/reason={code})"
    if isinstance(exc, MqttConnectError) and isinstance(code, int):
        # aiomqtt 2.3's generic error_string is not a CONNACK lookup.
        detail += "; " + _CONNACK_REASONS.get(code, "Unknown CONNACK")
    return redact_mqtt_secrets(detail, settings)
