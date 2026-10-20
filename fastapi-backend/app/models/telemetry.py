from datetime import datetime, timezone
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class FiniteModel(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, strict=True)


class TelemetryAccel(FiniteModel):
    x: float | None = None
    y: float | None = None
    z: float | None = None


class TelemetryGyro(TelemetryAccel):
    pass


class TelemetryGPS(FiniteModel):
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    alt: float | None = None


class TelemetryFrame(FiniteModel):
    """The versioned wire/store contract. Missing measurements remain null."""

    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    type: Literal["telemetry"] = "telemetry"
    schema_version: Literal[1] = 1
    device_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    source: Literal["hardware", "simulator", "demo"] = "hardware"
    timestamp: float | None = Field(default=None, ge=0)
    received_at: float = Field(default_factory=lambda: datetime.now(timezone.utc).timestamp(), ge=0)
    seq: int | None = Field(default=None, ge=0)
    accX: float | None = None
    accY: float | None = None
    accZ: float | None = None
    gyroX: float | None = None
    gyroY: float | None = None
    gyroZ: float | None = None
    magX: float | None = None
    magY: float | None = None
    magZ: float | None = None
    temperatureC: float | None = None
    voltageV: float | None = Field(default=None, ge=0)
    humidityPct: float | None = Field(default=None, ge=0, le=100)
    pressureHpa: float | None = Field(default=None, ge=0)
    gpsLat: float | None = Field(default=None, ge=-90, le=90)
    gpsLon: float | None = Field(default=None, ge=-180, le=180)
    gpsAlt: float | None = None
    uptimeMs: float | None = Field(default=None, ge=0)
    ledOn: bool | None = None
    imageData: str | None = Field(
        default=None,
        max_length=60000,
        pattern=r"^data:image/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$",
    )


class TelemetryPayload(FiniteModel):
    """Adapter for legacy flat and nested MQTT payloads."""

    device_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")
    timestamp: float | None = Field(default=None, ge=0)
    source: Literal["hardware", "simulator"] | None = None
    seq: int | None = Field(default=None, ge=0)
    acc: TelemetryAccel | None = None
    gyro: TelemetryGyro | None = None
    mag: TelemetryAccel | None = None
    gps: TelemetryGPS | None = None
    temperature: float | None = Field(
        default=None, validation_alias=AliasChoices("temperature", "temperatureC", "temp", "temp_c")
    )
    voltage: float | None = Field(
        default=None, ge=0, validation_alias=AliasChoices("voltage", "voltageV", "battery_v")
    )
    humidity: float | None = Field(
        default=None, ge=0, le=100, validation_alias=AliasChoices("humidity", "humidityPct")
    )
    pressure: float | None = Field(
        default=None, ge=0, validation_alias=AliasChoices("pressure", "pressureHpa", "baro_hpa")
    )
    acc_x: float | None = Field(default=None, validation_alias=AliasChoices("acc_x", "accX"))
    acc_y: float | None = Field(default=None, validation_alias=AliasChoices("acc_y", "accY"))
    acc_z: float | None = Field(default=None, validation_alias=AliasChoices("acc_z", "accZ"))
    gyro_x: float | None = Field(default=None, validation_alias=AliasChoices("gyro_x", "gyroX"))
    gyro_y: float | None = Field(default=None, validation_alias=AliasChoices("gyro_y", "gyroY"))
    gyro_z: float | None = Field(default=None, validation_alias=AliasChoices("gyro_z", "gyroZ"))
    mag_x: float | None = Field(default=None, validation_alias=AliasChoices("mag_x", "magX"))
    mag_y: float | None = Field(default=None, validation_alias=AliasChoices("mag_y", "magY"))
    mag_z: float | None = Field(default=None, validation_alias=AliasChoices("mag_z", "magZ"))
    lat: float | None = Field(
        default=None, ge=-90, le=90, validation_alias=AliasChoices("lat", "gpsLat")
    )
    lon: float | None = Field(
        default=None, ge=-180, le=180, validation_alias=AliasChoices("lon", "lng", "gpsLon")
    )
    alt: float | None = Field(default=None, validation_alias=AliasChoices("alt", "gpsAlt"))
    uptime_ms: float | None = Field(
        default=None, ge=0, validation_alias=AliasChoices("uptime_ms", "uptimeMs")
    )
    led_on: bool | None = Field(default=None, validation_alias=AliasChoices("led_on", "ledOn"))
    image_data: str | None = Field(
        default=None,
        max_length=60000,
        pattern=r"^data:image/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$",
        validation_alias=AliasChoices("image_data", "imageData"),
    )

    def normalized(self) -> dict:
        def nested(vector, axis, fallback):
            return (
                getattr(vector, axis)
                if vector is not None and axis in vector.model_fields_set
                else fallback
            )

        result = TelemetryFrame(
            device_id=self.device_id,
            source=self.source or "hardware",
            timestamp=self.timestamp,
            seq=self.seq,
            accX=nested(self.acc, "x", self.acc_x),
            accY=nested(self.acc, "y", self.acc_y),
            accZ=nested(self.acc, "z", self.acc_z),
            gyroX=nested(self.gyro, "x", self.gyro_x),
            gyroY=nested(self.gyro, "y", self.gyro_y),
            gyroZ=nested(self.gyro, "z", self.gyro_z),
            magX=nested(self.mag, "x", self.mag_x),
            magY=nested(self.mag, "y", self.mag_y),
            magZ=nested(self.mag, "z", self.mag_z),
            temperatureC=self.temperature,
            voltageV=self.voltage,
            humidityPct=self.humidity,
            pressureHpa=self.pressure,
            gpsLat=nested(self.gps, "lat", self.lat),
            gpsLon=nested(self.gps, "lon", self.lon),
            gpsAlt=nested(self.gps, "alt", self.alt),
            uptimeMs=self.uptime_ms,
            ledOn=self.led_on,
            imageData=self.image_data,
        )
        return result.model_dump()
