"""Shared MQTT TLS policy for the API, simulator and diagnostic probe."""
from pathlib import Path
import ssl

from app.core.config import Settings


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
