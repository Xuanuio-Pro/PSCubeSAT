from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import MQTTCredential

class MQTTCredentialRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> MQTTCredential | None:
        """Kiểm tra xem thông tin đăng nhập MQTT có tồn tại trong cơ sở dữ liệu hay không."""
        stmt = select(MQTTCredential).where(MQTTCredential.id == id)
    
        result = await self.db.execute(stmt)

        return result.scalar_one_or_none()

    async def create(self, MQTTCredential: MQTTCredential) -> MQTTCredential:
        """Tạo một thông tin đăng nhập MQTT mới trong cơ sở dữ liệu."""
        self.db.add(MQTTCredential)
        await self.db.flush()
        return MQTTCredential