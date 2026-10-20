from pydantic import BaseModel, ConfigDict, Field
from typing import Literal

class CreateDeviceRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    device_name: str = Field(..., min_length=1, max_length=128, description="Tên thiết bị")
    description: str | None = Field(None, max_length=2000, description="Mô tả thiết bị")
    model: str | None = Field(None, max_length=128, description="Mẫu thiết bị")
    device_type: Literal['hardware', 'simulator', 'ground_station'] = 'hardware'

class CreateDeviceResponse(BaseModel):
    device_uid: str = Field(..., description="UID của thiết bị đã tạo")
    device_name: str = Field(..., description="Tên thiết bị đã tạo")
    device_secret: str = Field(..., description="Secret của thiết bị đã tạo")
    mqtt_username: str
    credential_backend: Literal['postgresql'] = 'postgresql'
    message: str = Field(..., description="Thông báo về việc tạo thiết bị thành công")

class DeviceDetailsResponse(BaseModel):
    id: int = Field(..., description="ID số của thiết bị")
    device_uid: str = Field(..., description="UID của thiết bị")
    device_name: str = Field(..., description="Tên thiết bị")
    description: str | None = Field(None, description="Mô tả thiết bị")
    model: str | None = Field(None, description="Mẫu thiết bị")
    device_type: str = Field("hardware", description="hardware hoặc simulator")
    status: str = Field("offline", description="Trạng thái thiết bị")


class UpdatePositionRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, strict=True)
    lat: float = Field(..., ge=-90, le=90, description="Vĩ độ")
    lon: float = Field(..., ge=-180, le=180, description="Kinh độ")
    alt: float | None = Field(None, description="Độ cao (m), tuỳ chọn")


class DevicePositionResponse(BaseModel):
    device_uid: str
    device_name: str
    device_type: str
    lat: float
    lon: float
    alt: float | None = None
    updated_at: str | None = None
