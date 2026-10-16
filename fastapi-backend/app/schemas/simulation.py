from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


ComponentType = Literal[
    "esp32-devkit",
    "mpu6500",
    "bmp280",
    "led",
    "button",
    "battery",
]

ScenarioType = Literal[
    "idle",
    "rotation",
    "shake",
    "thermal",
    "battery_drain",
]


class SimulationComponent(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    type: ComponentType
    x: float = 0.0
    y: float = 0.0
    config: dict[str, Any] = Field(default_factory=dict)


class SimulationConfig(BaseModel):
    board: Literal["esp32-devkit"] = "esp32-devkit"
    components: list[SimulationComponent] = Field(..., min_length=1, max_length=20)
    scenario: ScenarioType = "idle"
    speed: float = Field(default=1.0, ge=0.1, le=10.0)

    @field_validator("components")
    @classmethod
    def validate_components(cls, components: list[SimulationComponent]) -> list[SimulationComponent]:
        ids = [component.id for component in components]
        if len(ids) != len(set(ids)):
            raise ValueError("ID linh kiện không được trùng nhau")

        boards = [component for component in components if component.type == "esp32-devkit"]
        if len(boards) != 1:
            raise ValueError("Cấu hình phải có đúng một ESP32 DevKit")

        return components


class CreateSimulationRequest(BaseModel):
    device_id: int = Field(..., gt=0)
    config: SimulationConfig


class SimulationResponse(BaseModel):
    id: str
    user_id: int
    device_id: int
    device_uid: str
    status: str
    seq: int
    config: dict[str, Any]
