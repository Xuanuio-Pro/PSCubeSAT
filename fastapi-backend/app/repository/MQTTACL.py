from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import MQTTACL
class TelemetryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, acls: list[MQTTACL]) -> list[MQTTACL]:
        """Tạo một danh sách ACL mới trong cơ sở dữ liệu."""
        self.db.add_all(acls)
        await self.db.flush()
        return acls