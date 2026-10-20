from typing import Field, Literal

from pydantic import BaseModel


class SimulationComponent(BaseModel):
    id: str
    type: Literal["esp32-devkit", "mpu6500", "bmp280", "led", "button", "battery"]

    config: dict[str, str | int | float | bool] = {}


class SimulationConfig(BaseModel):
    board: Literal["esp32-devkit"]
    components: list[SimulationComponent]
    scenario: Literal["idle", "rotation", "shake", "thermal", "battery_drain"]
    speed: float = Field(default=1.0, ge=0.1, le=10.0)
