from datetime import datetime, timezone

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import Device, MQTTCredential, MQTTACL

class DeviceRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_uid(self, device_uid: str) -> Device | None:
        """Kiểm tra xem device có tồn tại trong cơ sở dữ liệu hay không."""
        stmt = select(Device).where(Device.device_uid == device_uid, Device.deleted_at.is_(None))
    
        result = await self.db.execute(stmt)

        return result.scalar_one_or_none()

    async def create(self, device: Device) -> Device:
        """Tạo một thiết bị mới trong cơ sở dữ liệu."""
        self.db.add(device)
        await self.db.flush()
        return device

    async def get_by_user_id(self, user_id: int) -> list[Device]:
        """Lấy danh sách thiết bị theo user_id."""
        stmt = select(Device).where(Device.user_id == user_id, Device.deleted_at.is_(None))
    
        result = await self.db.execute(stmt)

        return result.scalars().all()

    async def get_by_id(self, device_id: int) -> Device | None:
        """Lấy thông tin thiết bị theo device_id."""
        stmt = select(Device).where(Device.id == device_id, Device.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def delete(self, device: Device) -> None:
        """Retain history and foreign keys; revoke database credentials atomically."""
        now = datetime.now(timezone.utc)
        device.deleted_at = now
        device.enabled = False
        device.status = 'offline'
        await self.db.execute(update(MQTTCredential).where(
            MQTTCredential.device_id == device.id
        ).values(enabled=False, deleted_at=now))
        await self.db.execute(delete(MQTTACL).where(MQTTACL.device_id == device.id))
        await self.db.flush()

    async def check_user_owns_device(self, user_id: int, device_uid: str, enabled_only: bool = False) -> bool:
        """Kiểm tra xem user có sở hữu thiết bị hay không."""
        stmt = select(Device).where(
            Device.device_uid == device_uid, Device.user_id == user_id,
            Device.deleted_at.is_(None),
        )
        if enabled_only:
            stmt = stmt.where(Device.enabled.is_(True))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def get_all_with_position(self, user_id: int) -> list[Device]:
        """Lấy vị trí của các thiết bị đang hoạt động thuộc user."""
        stmt = select(Device).where(
            Device.user_id == user_id,
            Device.enabled.is_(True),
            Device.deleted_at.is_(None),
            Device.last_lat.is_not(None),
            Device.last_lon.is_not(None),
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def update_position(
        self, device_uid: str, lat: float, lon: float, alt: float | None = None
    ) -> Device | None:
        """Cập nhật vị trí cuối của thiết bị (đè lên, không lưu lịch sử)."""
        device = await self.get_by_uid(device_uid)
        if not device:
            return None
        device.last_lat = lat
        device.last_lon = lon
        device.last_alt = alt
        device.last_position_at = datetime.now(timezone.utc)
        await self.db.flush()
        return device
