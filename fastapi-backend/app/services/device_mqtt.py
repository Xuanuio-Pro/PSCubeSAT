"""Device credential lifecycle stored atomically in PostgreSQL; no broker admin API."""

import secrets
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.tables import Device
from app.repository.mqtt import MQTTCredentialRepository


async def owned_credential(db: AsyncSession, uid: str, owner: int, *, lock=False):
    statement = select(Device).where(Device.device_uid == uid, Device.deleted_at.is_(None))
    if lock:
        statement = statement.with_for_update()
    device = (await db.execute(statement)).scalar_one_or_none()
    if not device:
        raise HTTPException(404, "Không tìm thấy thiết bị.")
    if device.user_id != owner:
        raise HTTPException(403, "Bạn không sở hữu thiết bị này.")
    credential = await MQTTCredentialRepository(db).get_for_device(device.id)
    if not credential:
        raise HTTPException(404, "Thiết bị chưa có credential MQTT.")
    return device, credential


def metadata(device, credential) -> dict:
    settings = get_settings()
    uid = device.device_uid
    return {
        "device_uid": uid,
        "username": credential.username,
        "client_id": credential.username,
        "host": settings.mqtt_host,
        "port": settings.mqtt_port,
        "tls": settings.mqtt_tls,
        "tls_verify": settings.mqtt_tls_verify,
        "credential_backend": "postgresql",
        "enabled": bool(device.enabled and credential.enabled and credential.revoked_at is None),
        "rotated_at": credential.rotated_at,
        "revoked_at": credential.revoked_at,
        "topics": {
            "telemetry": f"sensors/{uid}/telemetry",
            "status": f"sensors/{uid}/status",
            "ack": f"sensors/{uid}/ack",
            "commands": f"cmd/{uid}/#",
        },
    }


async def rotate(db: AsyncSession, uid: str, owner: int) -> dict:
    device, credential = await owned_credential(db, uid, owner, lock=True)
    if not device.enabled:
        raise HTTPException(409, "Thiết bị đang bị vô hiệu hóa.")
    secret = secrets.token_urlsafe(32)
    credential.password_hash = await run_in_threadpool(hash_password, secret)
    credential.enabled = True
    credential.revoked_at = None
    credential.rotated_at = datetime.now(timezone.utc)
    credential.updated_at = credential.rotated_at
    await db.commit()
    return {**metadata(device, credential), "password": secret}


async def revoke(db: AsyncSession, uid: str, owner: int) -> dict:
    device, credential = await owned_credential(db, uid, owner, lock=True)
    credential.enabled = False
    credential.revoked_at = credential.revoked_at or datetime.now(timezone.utc)
    credential.updated_at = credential.revoked_at
    await db.commit()
    return {
        **metadata(device, credential),
        "existing_sessions_disconnected": False,
        "message": "Đã thu hồi trong DB. Phiên MQTT đang mở cần ngắt từ phía broker.",
    }
