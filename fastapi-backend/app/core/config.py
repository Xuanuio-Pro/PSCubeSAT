from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server
    app_env: str = "development"
    port: int = 8000
    compiler_image: str = "pscubesat-compiler:1"

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
    database_url: str = Field(default="", repr=False)

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
    jwt_secret: str = Field(default="change_me", repr=False)
    jwt_expire_minutes: int = 1440
    google_client_id: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


def validate_production(settings: Settings) -> None:
    """Fail before starting services; errors name variables without leaking values."""
    if settings.app_env != "production":
        return
    from urllib.parse import urlsplit

    if len(settings.jwt_secret) < 32 or any(
        marker in settings.jwt_secret.lower() for marker in ("change", "replace", "your_", "<")
    ):
        raise RuntimeError(
            "JWT_SECRET must be a unique production secret of at least 32 characters."
        )
    if (
        "<" in settings.database_url
        or not settings.database_url.startswith(
            ("postgresql://", "postgres://", "postgresql+asyncpg://")
        )
        or not urlsplit(settings.database_url).hostname
    ):
        raise RuntimeError("DATABASE_URL must point to the production PostgreSQL database.")
    origins = settings.allowed_origins_list
    if not origins or any(
        urlsplit(origin).scheme != "https"
        or not urlsplit(origin).hostname
        or urlsplit(origin).path
        or urlsplit(origin).query
        or urlsplit(origin).fragment
        or urlsplit(origin).username
        or "*" in urlsplit(origin).netloc
        for origin in origins
    ):
        raise RuntimeError("ALLOWED_ORIGINS must contain exact HTTPS origins without paths.")
    if not settings.mqtt_password or settings.mqtt_password.startswith(("<", "replace_")):
        raise RuntimeError("MQTT_PASSWORD must be configured for the backend service account.")
