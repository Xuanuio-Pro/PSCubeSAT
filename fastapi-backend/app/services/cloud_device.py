"""The account's photo-uplink board: provisioning data for the hidden firmware layer (overrides/CDH/PTITCloud.cpp).

Students never write MQTT code. When the web app sees a board ask for configuration over Serial, it calls
`provision()` and writes the result into the board's NVS; the board then publishes every new JPEG saved
under /photos to `sensors/{uid}/image`, which `mqtt_consumer` stores for the Camera Viewer.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.lms_errors import LMSError
from app.models.tables import Device
from app.schemas.device import CreateDeviceRequest
from app.services import device_mqtt
from app.services.device import DeviceService

CLOUD_MODEL = "ptitcube-cloud"
CLOUD_NAME = "CubeSat của tôi (ảnh camera)"
MAX_FIELD = 128


async def find(db: AsyncSession, user_id: int) -> Device | None:
    statement = (
        select(Device)
        .where(Device.user_id == user_id, Device.model == CLOUD_MODEL, Device.deleted_at.is_(None))
        .order_by(Device.id)
        .limit(1)
    )
    return (await db.execute(statement)).scalar_one_or_none()


async def get_or_create(db: AsyncSession, user_id: int) -> Device:
    device = await find(db, user_id)
    if device:
        return device
    await DeviceService(db).register_new_device(
        user_id, CreateDeviceRequest(device_name=CLOUD_NAME, model=CLOUD_MODEL)
    )
    return await find(db, user_id)


def status(device: Device | None) -> dict:
    settings = get_settings()
    return {
        "device_uid": device.device_uid if device else None,
        "server_wifi": bool(settings.device_wifi_ssid),
        # The network name is not secret; the board reports it so the web app can tell a stale config.
        "wifi_ssid": settings.device_wifi_ssid,
        "image_topic": f"sensors/{device.device_uid}/image" if device else None,
    }


async def provision(
    db: AsyncSession, user_id: int, wifi_ssid: str | None = None, wifi_password: str | None = None
) -> dict:
    settings = get_settings()
    ssid = (wifi_ssid or "").strip() or settings.device_wifi_ssid
    password = wifi_password if (wifi_ssid or "").strip() else settings.device_wifi_password
    if not ssid:
        raise LMSError(
            409,
            "CONFIG_INVALID",
            "Chưa có WiFi cho bo mạch. Nhập WiFi hoặc nhờ quản trị viên cấu hình WiFi phòng lab.",
            {"reason": "wifi_missing"},
        )
    if len(ssid) > 32 or len(password or "") > 64:
        raise LMSError(422, "CONFIG_INVALID", "Tên hoặc mật khẩu WiFi quá dài.", {"reason": "wifi_invalid"})
    shared = settings.device_mqtt_auth == "shared"
    if shared and not (settings.device_mqtt_username and settings.device_mqtt_password):
        raise LMSError(
            503,
            "CONFIG_INVALID",
            "Máy chủ chưa cấu hình tài khoản MQTT cho thiết bị.",
            {"reason": "device_mqtt_missing"},
        )
    device = await get_or_create(db, user_id)
    if shared:
        username, secret = settings.device_mqtt_username, settings.device_mqtt_password
    else:
        # A new secret per provisioning: the previous board's credential stops working, which is intended.
        rotated = await device_mqtt.rotate(db, device.device_uid, user_id)
        username, secret = rotated["username"], rotated["password"]
    uid = device.device_uid
    return {
        "v": 1,
        "uid": uid,
        "host": settings.mqtt_host,
        "port": settings.mqtt_port,
        "tls": settings.mqtt_tls,
        "user": username,
        "pass": secret,
        "topic": f"sensors/{uid}/image",
        "ssid": ssid,
        "wpass": password or "",
    }
