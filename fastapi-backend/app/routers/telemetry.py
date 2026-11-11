from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.tables import Device, User
from app.repository.device import DeviceRepository
from app.services import device_images
from app.services.auth import get_required_user
from app.services.mqtt_consumer import get_latest_state

router = APIRouter(prefix="/api/telemetry", tags=["telemetry"])


@router.get("/latest/{device_id}")
async def get_latest(
    device_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_required_user)
):
    if not await DeviceRepository(db).check_user_owns_device(user.id, device_id, enabled_only=True):
        raise HTTPException(404, "Thiết bị không tồn tại hoặc bạn không có quyền truy cập.")
    data = get_latest_state(device_id)
    return {"found": data is not None, "device_id": device_id, "data": data}


@router.get("/latest")
async def get_all_latest(
    db: AsyncSession = Depends(get_db), user: User = Depends(get_required_user)
):
    ids = (
        (
            await db.execute(
                select(Device.device_uid).where(
                    Device.user_id == user.id, Device.deleted_at.is_(None), Device.enabled.is_(True)
                )
            )
        )
        .scalars()
        .all()
    )
    return {"devices": {uid: data for uid in ids if (data := get_latest_state(uid)) is not None}}


async def _owned_device(db: AsyncSession, user: User, device_id: str) -> None:
    if not await DeviceRepository(db).check_user_owns_device(user.id, device_id, enabled_only=True):
        raise HTTPException(404, "Thiết bị không tồn tại hoặc bạn không có quyền truy cập.")


@router.get("/images/{device_id}")
async def list_device_images(
    device_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_required_user)
):
    await _owned_device(db, user, device_id)
    return {"device_id": device_id, "images": device_images.list_images(device_id)}


@router.get("/images/{device_id}/{image_id}")
async def get_device_image(
    device_id: str,
    image_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_required_user),
):
    await _owned_device(db, user, device_id)
    path = device_images.image_path(device_id, image_id)
    if path is None:
        raise HTTPException(404, "Ảnh không tồn tại.")
    return FileResponse(
        path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600"}
    )
