"""ASGI entrypoint: uvicorn app.main:app."""

from app.application import create_app
from app.websocket.routes import authorize_telemetry_socket as _authorize_telemetry_socket

__all__ = ["app", "create_app", "_authorize_telemetry_socket"]

app = create_app()
