from datetime import datetime, timezone

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.repository.progress import ProgressRepository
from app.schemas.progress import LabProgressResponse

# Lab không có bước biên dịch (chỉ video + tài liệu) — tiêu chí hoàn thành khác các lab còn lại
LAB_IDS_WITHOUT_COMPILER = {0}


def _to_response(p) -> LabProgressResponse:
    return LabProgressResponse(
        lab_id=p.lab_id,
        video_watched=p.video_watched,
        doc_viewed=p.doc_viewed,
        compiled_at=p.compiled_at.isoformat() if p.compiled_at else None,
        completed_at=p.completed_at.isoformat() if p.completed_at else None,
    )


class ProgressService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ProgressRepository(db)

    async def list_progress(self, user_id: int) -> list[LabProgressResponse]:
        rows = await self.repo.list_by_user(user_id)
        return [_to_response(r) for r in rows]

    async def mark_video_watched(self, user_id: int, lab_id: int) -> LabProgressResponse:
        progress = await self.repo.get_or_create(user_id, lab_id)
        progress.video_watched = True
        self._recompute_completion(progress)
        await self.db.commit()
        await self.db.refresh(progress)
        return _to_response(progress)

    async def mark_doc_viewed(self, user_id: int, lab_id: int) -> LabProgressResponse:
        progress = await self.repo.get_or_create(user_id, lab_id)
        progress.doc_viewed = True
        self._recompute_completion(progress)
        await self.db.commit()
        await self.db.refresh(progress)
        return _to_response(progress)

    async def mark_compiled(self, user_id: int, lab_id: int) -> None:
        """Gọi khi biên dịch code của học viên thành công. Tự động tính là đã hoàn thành lab."""
        progress = await self.repo.get_or_create(user_id, lab_id)
        now = datetime.now(timezone.utc)
        if not progress.compiled_at:
            progress.compiled_at = now
        self._recompute_completion(progress)
        await self.db.commit()
        logger.info(
            f"[Progress] user_id={user_id} lab_id={lab_id} compiled_at={progress.compiled_at}"
        )

    def _recompute_completion(self, progress) -> None:
        if progress.completed_at:
            return

        if progress.lab_id in LAB_IDS_WITHOUT_COMPILER:
            done = progress.video_watched and progress.doc_viewed
        else:
            done = progress.compiled_at is not None

        if done:
            progress.completed_at = datetime.now(timezone.utc)
