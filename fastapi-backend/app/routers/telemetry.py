from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.tables import Device, User
from app.repository.device import DeviceRepository
from app.services.auth import get_required_user
from app.services.mqtt_consumer import get_latest_state

router = APIRouter(prefix='/api/telemetry', tags=['telemetry'])


@router.get('/latest/{device_id}')
async def get_latest(device_id: str, db: AsyncSession = Depends(get_db),
                     user: User = Depends(get_required_user)):
    if not await DeviceRepository(db).check_user_owns_device(user.id, device_id, enabled_only=True):
        raise HTTPException(404, 'Thiết bị không tồn tại hoặc bạn không có quyền truy cập.')
    data = get_latest_state(device_id)
    return {'found': data is not None, 'device_id': device_id, 'data': data}


@router.get('/latest')
async def get_all_latest(db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_required_user)):
    ids = (await db.execute(select(Device.device_uid).where(
        Device.user_id == user.id, Device.deleted_at.is_(None), Device.enabled.is_(True)
    ))).scalars().all()
    return {'devices': {uid: data for uid in ids if (data := get_latest_state(uid)) is not None}}
