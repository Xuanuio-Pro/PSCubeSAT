import asyncio
import sys
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from app.core.logging import configure_console_encoding

configure_console_encoding()

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.redis import init_redis, close_redis
from app.db import init_db, close_db
from app.routers import health, compiler, telemetry, devices, auth, simulations, progress
from app.services import compiler_svc, mqtt_consumer
from app.websocket.ws_manager import ws_manager
from app.repository.device import DeviceRepository
from app.services.mqtt_consumer import get_latest_state
from app.services.simulation.manager import simulation_manager
from app.services.simulation.mqtt_publisher import simulation_mqtt_publisher
settings = get_settings()


# ── Loguru setup ───────────────────────────────────────────────────────────────
logger.remove()  # Xoá handler mặc định
logger.add(
    sys.stdout,
    colorize=True,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
    level="INFO",
)
logger.add(
    "logs/backend.log",
    rotation="10 MB",
    retention="7 days",
    compression="zip",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name} - {message}",
    level="DEBUG",
    enqueue=True,
    encoding="utf-8",
)


# ── Lifespan: startup / shutdown ───────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 CubeSat FastAPI Backend starting...")
    compiler_svc.init_all_caches()
    logger.success("✅ PlatformIO build cache ready.")

    # Initialize DB (Check connection & init tables if needed)
    await init_db()

    # Initialize Redis
    await init_redis()

    # Start MQTT publisher for simulator workers
    await simulation_mqtt_publisher.start()
    simulation_manager.set_publisher(simulation_mqtt_publisher.publish)

    # Start MQTT Consumer
    mqtt_task = asyncio.create_task(mqtt_consumer.start())
    logger.success(f"✅ MQTT Consumer started → {settings.mqtt_host}:{settings.mqtt_port}")
    
    yield
    
    await simulation_manager.shutdown()
    await simulation_mqtt_publisher.stop()

    mqtt_task.cancel()
    try:
        await mqtt_task
    except asyncio.CancelledError:
        pass
    await close_redis()
    await close_db()
    logger.info("👋 CubeSat FastAPI Backend stopped.")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CubeSat Ground Station API",
    description="Backend cho hệ thống Ground Station CubeSat PTIT-STEM",
    version="2.0.0",
    lifespan=lifespan,
)

# Frontend gửi JSON POST tới /api/compile nên browser sẽ gửi preflight OPTIONS.
# Phải đăng ký CORS trước khi include các router để FastAPI trả 200 cho preflight.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(compiler.router)
app.include_router(telemetry.router)
app.include_router(devices.router)
app.include_router(simulations.router)
app.include_router(progress.router)

async def _authorize_telemetry_socket(token: str | None, device_uid: str) -> bool:
    from app.db.database import get_session_maker
    from app.services.auth import get_current_user
    # Close the transaction before accepting a long-lived WebSocket.
    async with get_session_maker()() as db:
        user = await get_current_user(token=token, db=db)
        return bool(user and await DeviceRepository(db).check_user_owns_device(user.id, device_uid, enabled_only=True))


@app.websocket('/ws/devices/{device_uid}')
async def websocket_endpoint(websocket: WebSocket, device_uid: str):
    token = websocket.query_params.get('token')
    # Uvicorn logs the accepted/rejected WS scope; keep JWTs out of that URL log.
    websocket.scope['query_string'] = b''
    if not token or not await _authorize_telemetry_socket(token, device_uid):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await ws_manager.connect(device_uid, websocket)
    try:
        if (latest := get_latest_state(device_uid)) is not None:
            await websocket.send_text(json.dumps({'type': 'init', 'device': latest}, ensure_ascii=False))
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                pass
            # Revalidate expiry, revocation and device ownership during the session.
            if not await _authorize_telemetry_socket(token, device_uid):
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(device_uid, websocket)


@app.get("/")
async def root():
    return {"message": "CubeSat Ground Station API v2.0", "docs": "/docs", "ws": "/ws"}
