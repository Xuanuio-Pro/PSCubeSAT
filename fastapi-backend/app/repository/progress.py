from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert

from app.models.tables import LabProgress


class ProgressRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get(self, user_id: int, lab_id: int) -> LabProgress | None:
        stmt = select(LabProgress).where(
            LabProgress.user_id == user_id, LabProgress.lab_id == lab_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_or_create(self, user_id: int, lab_id: int) -> LabProgress:
        if not 0 <= lab_id <= 8:
            raise ValueError("Lab ID phải nằm trong khoảng 0–8.")
        await self.db.execute(insert(LabProgress).values(user_id=user_id, lab_id=lab_id)
                              .on_conflict_do_nothing(index_elements=['user_id', 'lab_id']))
        # Serialize all completion updates, including updates to an existing row.
        # Refresh an identity-map instance after acquiring the lock.
        result = await self.db.execute(select(LabProgress).where(
            LabProgress.user_id == user_id, LabProgress.lab_id == lab_id
        ).with_for_update().execution_options(populate_existing=True))
        return result.scalar_one()

    async def list_by_user(self, user_id: int) -> list[LabProgress]:
        stmt = select(LabProgress).where(LabProgress.user_id == user_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
