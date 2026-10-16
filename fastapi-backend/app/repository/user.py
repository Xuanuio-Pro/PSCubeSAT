from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.db_models import User

class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_email_exists(self, email: str) -> bool:
        """Kiểm tra xem email đã tồn tại trong cơ sở dữ liệu hay chưa."""
        stmt = select(User).where(User.email == email, User.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() is not None

    async def create(self, user: User) -> User:
        """Tạo một người dùng mới trong cơ sở dữ liệu."""
        self.db.add(user)
        await self.db.flush()
        return user

    async def get_by_email(self, email: str) -> User | None:
        """Lấy thông tin người dùng theo email."""
        stmt = select(User).where(User.email == email, User.deleted_at.is_(None))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()