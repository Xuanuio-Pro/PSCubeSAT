import asyncio
import json
import time
import re
from typing import Optional

import aiomqtt
from loguru import logger
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.mqtt_transport import mqtt_tls_context
from app.db.database import get_session_maker
from app.models.telemetry import TelemetryPayload
from app.repository.device import DeviceRepository
from app.websocket.ws_manager import ws_manager

# In-memory latest telemetry per device
_latest_state: dict = {}

# Ghi vị trí xuống DB tối đa 1 lần / khoảng thời gian này cho mỗi thiết bị — tránh
# 1 round-trip DB (network tới Supabase) cho mỗi tin MQTT, việc từng làm consumer
# nghẽn cổ chai khi thiết bị (hoặc simulator) bắn GPS ở tần suất cao (vd 20Hz).
_MIN_POSITION_WRITE_INTERVAL_S = 3.0
_last_position_write: dict[str, float] = {}
_TELEMETRY_TOPIC = re.compile(r'^sensors/([A-Za-z0-9_-]{1,64})/telemetry$')
_MAX_PAYLOAD_BYTES = 65536

def get_latest_state(device_id: str) -> Optional[dict]:
    return _latest_state.get(device_id)


def get_all_latest_states() -> dict:
    return dict(_latest_state)


async def _persist_position(device_uid: str, lat: float, lon: float, alt: float | None) -> None:
    now = time.monotonic()
    last = _last_position_write.get(device_uid, 0.0)
    if now - last < _MIN_POSITION_WRITE_INTERVAL_S:
        return

    session_maker = get_session_maker()
    async with session_maker() as db:
        device = await DeviceRepository(db).update_position(device_uid, lat, lon, alt)
        if device is None:
            logger.warning(f"[MQTT] Vị trí GPS bị bỏ qua — chưa đăng ký thiết bị: {device_uid}")
            return
        await db.commit()
    _last_position_write[device_uid] = now


async def _handle_message(message: aiomqtt.Message) -> None:
    topic = str(message.topic)
    match = _TELEMETRY_TOPIC.fullmatch(topic)
    if not match or not isinstance(message.payload, bytes) or len(message.payload) > _MAX_PAYLOAD_BYTES:
        logger.warning('[MQTT] Rejected invalid topic or oversized payload.')
        return
    topic_uid = match.group(1)
    try:
        raw = message.payload.decode("utf-8")
        data = json.loads(raw)
        payload = TelemetryPayload(**data)
        if payload.device_id != topic_uid:
            logger.warning('[MQTT] Rejected topic/payload device mismatch.')
            return
        async with get_session_maker()() as db:
            device = await DeviceRepository(db).get_by_uid(topic_uid)
            if not device or not device.enabled or device.user_id is None:
                logger.warning('[MQTT] Rejected unknown, disabled or unowned device.')
                return
        normalized = payload.normalized()
        _latest_state[topic_uid] = normalized
        logger.debug(f"[MQTT] Accepted telemetry for {topic_uid}")
        await ws_manager.send_to_device(
            device_uid=payload.device_id,
            data=normalized
        )
        logger.info(f"[MQTT] {topic} → device={payload.device_id} | WS clients={ws_manager.count}")

        if normalized['gpsLat'] is not None and normalized['gpsLon'] is not None:
            await _persist_position(topic_uid, normalized['gpsLat'], normalized['gpsLon'], normalized['gpsAlt'])
    except (json.JSONDecodeError, UnicodeDecodeError, ValidationError, TypeError):
        logger.warning('[MQTT] Rejected invalid telemetry payload.')
    except Exception as e:
        logger.error(f"[MQTT] {topic} — Lỗi xử lý: {e}")


async def start() -> None:
    settings = get_settings()
    reconnect_delay = 3

    while True:
        try:
            logger.info(f"[MQTT] Kết nối → {settings.mqtt_host}:{settings.mqtt_port} | topic={settings.mqtt_topic}")
            tls_context = mqtt_tls_context(settings)
            if settings.mqtt_tls and not settings.mqtt_tls_verify:
                logger.warning('[MQTT] TLS certificate verification disabled by MQTT_TLS_VERIFY=false')

            async with aiomqtt.Client(
                hostname=settings.mqtt_host,
                port=settings.mqtt_port,
                username=settings.mqtt_username,
                password=settings.mqtt_password,
                tls_context=tls_context,
            ) as client:
                logger.success(f"[MQTT] ✅ Đã kết nối Mosquitto. Subscribe: {settings.mqtt_topic}")
                reconnect_delay = 3
                await client.subscribe(settings.mqtt_topic)
                async for message in client.messages:
                    await _handle_message(message)

        except aiomqtt.MqttError as e:
            logger.warning(f"[MQTT] Mất kết nối: {e} — retry sau {reconnect_delay}s...")
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 60)
        except asyncio.CancelledError:
            logger.info("[MQTT] Consumer dừng.")
            break
        except Exception as e:
            logger.error(f"[MQTT] Lỗi không mong đợi: {e} — retry sau {reconnect_delay}s...")
            await asyncio.sleep(reconnect_delay)
