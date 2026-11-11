# """
# device.py
# ───────────────
# Dùng PostgreSQL để xử lý.
# """
import secrets
import uuid

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.security import hash_password
from app.models.tables import MQTTACL, Device, MQTTCredential
from app.repository.device import DeviceRepository
from app.repository.mqtt import MQTTACLRepository, MQTTCredentialRepository
from app.schemas.device import CreateDeviceRequest


class DeviceService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.device_repo = DeviceRepository(db)
        self.mqtt_credential_repo = MQTTCredentialRepository(db)
        self.mqtt_acl_repo = MQTTACLRepository(db)

    async def register_new_device(self, user_id: int, request: CreateDeviceRequest) -> dict:
        """Đăng ký một thiết bị mới cho người dùng."""
        while True:
            generated_uid = f"cube_{uuid.uuid4().hex[:8]}"
            existing_device = await self.device_repo.get_by_uid(generated_uid)
            if not existing_device:
                break

        raw_secret = secrets.token_urlsafe(32)
        hashed_secret = await run_in_threadpool(hash_password, raw_secret)

        try:
            new_device = Device(
                user_id=user_id,
                device_uid=generated_uid,
                device_name=request.device_name,
                description=request.description,
                model=request.model,
                device_type=request.device_type,
            )
            created_device = await self.device_repo.create(new_device)

            mqtt_cred = MQTTCredential(
                device_id=created_device.id,
                username=f"dev_{generated_uid}",
                password_hash=hashed_secret,
            )
            await self.mqtt_credential_repo.create(mqtt_cred)

            default_acls = [
                # Cho phép gửi dữ liệu telemetry
                MQTTACL(
                    device_id=created_device.id,
                    permission="allow",
                    action="publish",
                    topic=f"sensors/{generated_uid}/telemetry",
                ),
                # Cho phép lắng nghe lệnh từ server
                MQTTACL(
                    device_id=created_device.id,
                    permission="allow",
                    action="subscribe",
                    topic=f"cmd/{generated_uid}/#",
                ),
                MQTTACL(
                    device_id=created_device.id,
                    permission="allow",
                    action="publish",
                    topic=f"sensors/{generated_uid}/status",
                ),
                MQTTACL(
                    device_id=created_device.id,
                    permission="allow",
                    action="publish",
                    topic=f"sensors/{generated_uid}/ack",
                ),
                # Cho phép gửi ảnh JPEG chụp từ camera
                MQTTACL(
                    device_id=created_device.id,
                    permission="allow",
                    action="publish",
                    topic=f"sensors/{generated_uid}/image",
                ),
            ]
            await self.mqtt_acl_repo.create(default_acls)

            await self.db.commit()
            await self.db.refresh(created_device)

            logger.info(
                f"New device registered: {created_device.device_uid} for user_id: {user_id}"
            )
            return {
                "device_uid": created_device.device_uid,
                "device_name": created_device.device_name,
                "device_secret": raw_secret,
                "mqtt_username": mqtt_cred.username,
                "credential_backend": "postgresql",
                "message": "Đăng ký thiết bị thành công",
            }
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error registering new device: {type(e).__name__}")
            raise e

    async def get_device_by_uid(self, device_uid: str) -> Device | None:
        """Lấy thông tin thiết bị theo device_uid."""
        device = await self.device_repo.get_by_uid(device_uid)
        if not device:
            logger.warning(f"Device not found: {device_uid}")
            return None
        return device

    async def get_device_by_id(self, device_id: int) -> Device | None:
        """Lấy thông tin thiết bị theo device_id."""
        device = await self.device_repo.get_by_id(device_id)
        if not device:
            logger.warning(f"Device not found: {device_id}")
            return None
        return device

    async def get_device_details(self, user_id: int) -> list[dict]:
        """Lấy chi tiết thiết bị theo user_id."""
        devices = await self.device_repo.get_by_user_id(user_id)
        return [
            {
                "id": device.id,
                "device_uid": device.device_uid,
                "device_name": device.device_name,
                "description": device.description,
                "model": device.model,
                "device_type": device.device_type,
                "status": device.status.value if hasattr(device.status, "value") else device.status,
            }
            for device in devices
        ]

    async def get_all_positions(self, user_id: int) -> list[dict]:
        """Vị trí cuối của các thiết bị đang hoạt động thuộc tài khoản."""
        devices = await self.device_repo.get_all_with_position(user_id)
        return [
            {
                "device_uid": d.device_uid,
                "device_name": d.device_name,
                "device_type": d.device_type,
                "lat": d.last_lat,
                "lon": d.last_lon,
                "alt": d.last_alt,
                "updated_at": d.last_position_at.isoformat() if d.last_position_at else None,
            }
            for d in devices
        ]

    async def update_position(
        self, device_uid: str, lat: float, lon: float, alt: float | None = None
    ) -> Device | None:
        """Cập nhật vị trí cuối (dùng cho ground station tự báo GPS trình duyệt)."""
        device = await self.device_repo.update_position(device_uid, lat, lon, alt)
        if device:
            await self.db.commit()
            logger.info(f"Position updated: {device_uid} -> ({lat}, {lon})")
        return device

    async def delete_device(self, device_uid: str) -> bool:
        """Xoá thiết bị theo device_uid."""
        device = await self.device_repo.get_by_uid(device_uid)
        if not device:
            return False
        await self.device_repo.delete(device)
        await self.db.commit()
        # Database revocation remains authoritative even if a runtime is restarted.
        from app.services import mqtt_consumer
        from app.services.simulation.manager import simulation_manager
        from app.websocket.ws_manager import ws_manager

        for session in list(simulation_manager.list_for_user(device.user_id)):
            if session.device_uid == device_uid:
                try:
                    await simulation_manager.delete(session.session_id)
                except KeyError:
                    pass  # Another delete request already cleaned up this session.
        mqtt_consumer.clear_device_state(device_uid)
        await ws_manager.close_device(device_uid)
        logger.info(f"Device deleted: {device_uid}")
        return True
