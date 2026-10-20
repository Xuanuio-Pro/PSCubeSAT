"""
routers/devices.py
──────────────────
Device Registry API:
  POST   /api/devices/register  — Đăng ký thiết bị mới
  GET    /api/devices            — Danh sách thiết bị của user hiện tại
  GET    /api/devices/{id}       — Chi tiết + firmware template
  DELETE /api/devices/{id}       — Xoá thiết bị (chỉ chủ sở hữu)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Response
import json
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.db_models import User
from app.schemas.device import (
    CreateDeviceRequest,
    CreateDeviceResponse,
    DeviceDetailsResponse,
    DevicePositionResponse,
    UpdatePositionRequest,
)
from app.services.auth import get_required_user
from app.services.device import DeviceService
from app.services import device_mqtt
from app.core.config import get_settings

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.post("/register", response_model=CreateDeviceResponse, status_code=201)
async def register_device(
    req: CreateDeviceRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    """Đăng ký thiết bị mới cho tài khoản đang đăng nhập."""
    response.headers['Cache-Control'] = 'no-store'
    return await DeviceService(db).register_new_device(current_user.id, req)


@router.get("", response_model=list[DeviceDetailsResponse], status_code=200)
async def list_devices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    """Trả về danh sách thiết bị của tài khoản đang đăng nhập."""
    return await DeviceService(db).get_device_details(current_user.id)


@router.get("/positions", response_model=list[DevicePositionResponse], status_code=200)
async def list_positions(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_required_user)):
    """Vị trí cuối của các thiết bị thuộc tài khoản đang đăng nhập."""
    return await DeviceService(db).get_all_positions(current_user.id)


@router.patch("/{device_uid}/position")
async def update_position(
    device_uid: str,
    req: UpdatePositionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    """Cập nhật vị trí cuối của thiết bị (dùng cho ground station báo GPS từ trình duyệt)."""
    service = DeviceService(db)
    device = await service.get_device_by_uid(device_uid)

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thiết bị.")

    if device.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền cập nhật thiết bị này.")

    updated = await service.update_position(device_uid, req.lat, req.lon, req.alt)
    return {
        "device_uid": updated.device_uid,
        "lat": updated.last_lat,
        "lon": updated.last_lon,
        "alt": updated.last_alt,
        "updated_at": updated.last_position_at.isoformat(),
    }


@router.get("/{device_uid}")
async def get_device(
    device_uid: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    """Trả về chi tiết thiết bị và firmware template (chỉ chủ sở hữu)."""
    service = DeviceService(db)
    device = await service.get_device_by_uid(device_uid)

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thiết bị.")

    if device.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền truy cập thiết bị này.")

    _, credential = await device_mqtt.owned_credential(db, device_uid, current_user.id)
    snippet = _make_firmware_snippet(device.device_uid, "<saved-on-register-or-rotate-only>", credential.username)
    return {
        "device_uid": device.device_uid,
        "device_name": device.device_name,
        "description": device.description,
        "model": device.model,
        "firmware_snippet": snippet,
    }


@router.delete("/{device_uid}")
async def delete_device(
    device_uid: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    """Xoá thiết bị (chỉ chủ sở hữu mới được xoá)."""
    service = DeviceService(db)
    device = await service.get_device_by_uid(device_uid)

    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy thiết bị.")

    if device.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bạn không có quyền xoá thiết bị này.")

    await service.delete_device(device_uid)
    logger.info(f"[Devices] Deleted: {device_uid} by user_id={current_user.id}")
    return {"message": f"Đã xoá thiết bị {device_uid} khỏi registry."}


@router.get('/{device_uid}/mqtt')
async def mqtt_configuration(device_uid: str, response: Response,
                             db: AsyncSession = Depends(get_db),
                             current_user: User = Depends(get_required_user)):
    response.headers['Cache-Control'] = 'no-store'
    device, credential = await device_mqtt.owned_credential(db, device_uid, current_user.id)
    return device_mqtt.metadata(device, credential)


@router.post('/{device_uid}/mqtt/rotate')
async def rotate_mqtt(device_uid: str, response: Response,
                      db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_required_user)):
    response.headers['Cache-Control'] = 'no-store'
    return await device_mqtt.rotate(db, device_uid, current_user.id)


@router.post('/{device_uid}/mqtt/revoke')
async def revoke_mqtt(device_uid: str, db: AsyncSession = Depends(get_db),
                      current_user: User = Depends(get_required_user)):
    return await device_mqtt.revoke(db, device_uid, current_user.id)


def _make_firmware_snippet(device_uid: str, device_secret: str, username: str | None = None) -> str:
    settings = get_settings()
    username = username or f'dev_{device_uid}'
    # Configuration fragment only: firmware must supply its trusted CA/bundle.
    return '\n'.join([
        '// Device MQTT config. Password is returned only at registration/rotation.',
        f'const char* MQTT_HOST = {json.dumps(settings.mqtt_host)};',
        f'const int MQTT_PORT = {settings.mqtt_port};',
        f'const bool MQTT_TLS = {str(settings.mqtt_tls).lower()};',
        f'const char* MQTT_USERNAME = {json.dumps(username)};',
        f'const char* MQTT_PASSWORD = {json.dumps(device_secret)};',
        f'const char* MQTT_CLIENT_ID = {json.dumps(username)};',
        f'const char* DEVICE_UID = {json.dumps(device_uid)};',
        f'const char* TOPIC_PUB = {json.dumps(f"sensors/{device_uid}/telemetry")};',
        f'const char* TOPIC_CMD = {json.dumps(f"cmd/{device_uid}/#")};',
        '// TLS: use WiFiClientSecure with the broker trusted root CA or a CA bundle.',
        '// ESP32 does not inherit the desktop OS CA store. Do not use WiFiClient on a TLS port.',
    ])
