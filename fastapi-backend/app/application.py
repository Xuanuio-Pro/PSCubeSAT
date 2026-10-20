"""Application composition: middleware, error handlers and route registration."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_console_encoding
from app.lifespan import lifespan
from app.routers import auth, compiler, devices, health, progress, root, simulations, telemetry
from app.websocket.routes import router as websocket_router

API_ROUTERS = (
    health.router,
    auth.router,
    compiler.router,
    telemetry.router,
    devices.router,
    simulations.router,
    progress.router,
    root.router,
    websocket_router,
)


def create_app() -> FastAPI:
    """Build the ASGI app without opening database, Redis or MQTT connections."""
    configure_console_encoding()
    app = FastAPI(
        title="CubeSat Ground Station API",
        description="Backend cho hệ thống Ground Station CubeSat PTIT-STEM",
        version="2.0.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    for router in API_ROUTERS:
        app.include_router(router)
    return app
