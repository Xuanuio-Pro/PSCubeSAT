"""Persistence operations for device MQTT credentials and topic ACLs."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import MQTTACL, MQTTCredential


class MQTTCredentialRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, credential_id: int) -> MQTTCredential | None:
        result = await self.db.execute(
            select(MQTTCredential).where(MQTTCredential.id == credential_id)
        )
        return result.scalar_one_or_none()

    async def get_for_device(self, device_id: int) -> MQTTCredential | None:
        result = await self.db.execute(
            select(MQTTCredential).where(
                MQTTCredential.device_id == device_id,
                MQTTCredential.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def create(self, credential: MQTTCredential) -> MQTTCredential:
        self.db.add(credential)
        await self.db.flush()
        return credential


class MQTTACLRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, rules: list[MQTTACL]) -> list[MQTTACL]:
        self.db.add_all(rules)
        await self.db.flush()
        return rules
