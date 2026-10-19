from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List
from pathlib import Path
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / '.env',
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server
    port: int = 8000
    compiler_image: str = 'pscubesat-compiler:1'

    # MQTT (Mosquitto)
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str = "backend-service"
    mqtt_password: str = Field(default="", repr=False)
    mqtt_topic: str = "sensors/#"
    mqtt_tls: bool = False
    mqtt_tls_verify: bool = True
    mqtt_ca_file: str = ""
    mqtt_admin_username: str = ""
    mqtt_admin_password: str = Field(default="", repr=False)

    # Redis
    redis_url: str = "redis://localhost:6379"

    # PostgreSQL
    database_url: str = ""

    @property
    def async_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    # CORS
    allowed_origins: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    # JWT
    jwt_secret: str = "change_me"
    jwt_expire_minutes: int = 1440
    google_client_id: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
