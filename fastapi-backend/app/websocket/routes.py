"""Device-scoped telemetry WebSocket transport and session authorization."""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.repository.device import DeviceRepository
from app.services.mqtt_consumer import get_latest_state
from app.websocket.ws_manager import ws_manager

router = APIRouter()


async def authorize_telemetry_socket(token: str | None, device_uid: str) -> bool:
    from app.db.database import get_session_maker
    from app.services.auth import get_current_user

    # Close the transaction before accepting a long-lived WebSocket.
    async with get_session_maker()() as db:
        user = await get_current_user(token=token, db=db)
        return bool(
            user
            and await DeviceRepository(db).check_user_owns_device(
                user.id, device_uid, enabled_only=True
            )
        )


@router.websocket("/ws/devices/{device_uid}")
async def websocket_endpoint(websocket: WebSocket, device_uid: str):
    token = websocket.query_params.get("token")
    # Uvicorn logs the accepted/rejected WS scope; keep JWTs out of that URL log.
    websocket.scope["query_string"] = b""
    if not token or not await authorize_telemetry_socket(token, device_uid):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    await ws_manager.connect(device_uid, websocket)
    try:
        if (latest := get_latest_state(device_uid)) is not None:
            await websocket.send_text(
                json.dumps({"type": "init", "device": latest}, ensure_ascii=False)
            )
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30)
            except asyncio.TimeoutError:
                pass
            # Revalidate expiry, revocation and device ownership during the session.
            if not await authorize_telemetry_socket(token, device_uid):
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(device_uid, websocket)
