import sys
from pathlib import Path

from loguru import logger


def configure_console_encoding():
    """Uvicorn reload workers and Windows pipes may default to cp1252."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="backslashreplace")


def configure_logging() -> None:
    """Configure sinks at application startup, not when importing modules."""
    configure_console_encoding()
    logger.remove()
    logger.add(
        sys.stdout,
        colorize=True,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
        level="INFO",
    )
    logger.add(
        Path(__file__).resolve().parents[2] / "logs/backend.log",
        rotation="10 MB",
        retention="7 days",
        compression="zip",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name} - {message}",
        level="DEBUG",
        enqueue=True,
        encoding="utf-8",
    )


def mask_email(email: str) -> str:
    """Keep logs useful for tracing without storing full addresses: "student@x.vn" -> "st***@x.vn"."""
    local, _, domain = email.strip().lower().partition("@")
    return f"{local[:2]}***@{domain}" if domain else "***"
