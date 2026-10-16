"""
routers/devices.py
──────────────────
Device Registry API:
  POST   /api/devices/register  — Đăng ký thiết bị mới
  GET    /api/devices            — Danh sách thiết bị của user hiện tại
  GET    /api/devices/{id}       — Chi tiết + firmware template
  DELETE /api/devices/{id}       — Xoá thiết bị (chỉ chủ sở hữu)
"""
from fastapi import APIRouter, Depends, HTTPException, status
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

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.post("/register", response_model=CreateDeviceResponse, status_code=201)
async def register_device(
    req: CreateDeviceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    """Đăng ký thiết bị mới cho tài khoản đang đăng nhập."""
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

    snippet = _make_firmware_snippet(device.device_uid, "<saved-on-register-only>")
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


def _make_firmware_snippet(device_uid: str, device_secret: str) -> str:
    return f"""\
// CubeSat PTIT-STEM - MQTT Credentials
// Paste this block into your ESP32 firmware.

#include <WiFi.h>
#include <PubSubClient.h>

const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";

const char* MQTT_HOST      = "mqtt.ptit-stem-cube.local";
const int   MQTT_PORT      = 8883;
const char* MQTT_USERNAME  = "{device_uid}";
const char* MQTT_PASSWORD  = "{device_secret}";
const char* MQTT_CLIENT_ID = "{device_uid}";

const char* TOPIC_PUB = "sensors/{device_uid}/telemetry";
const char* TOPIC_CMD = "cmd/{device_uid}";

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

void connectMQTT() {{
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  while (!mqttClient.connected()) {{
    Serial.println("Connecting to MQTT...");
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {{
      Serial.println("MQTT Connected!");
      mqttClient.subscribe(TOPIC_CMD);
    }} else {{
      delay(3000);
    }}
  }}
}}
"""
