from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.learning import LessonEventInput, OverrideInput, ReviewInput, SubmissionInput
from app.services import learning_progress as service
from app.services.auth import get_required_user
from app.services.learning_rules import learning_path
from app.services.permissions import ClassAccess, require_class_member, require_lms_enabled

router = APIRouter(
    prefix="/api/classes/{class_id}",
    tags=["learning"],
    dependencies=[Depends(get_required_user), Depends(require_lms_enabled)],
)
read = require_class_member()
write_student = require_class_member(roles=["student"], write=True)
write_teacher = require_class_member(roles=["teacher"], write=True)


@router.get("/learning-path")
async def path(
    membership_id: int | None = None,
    access: ClassAccess = Depends(read),
    db: AsyncSession = Depends(get_db),
):
    config = await service.raw_config(db, access)
    if access.can_manage and membership_id is None:
        return learning_path(config, {})
    member = await service.student_member(
        db, access, membership_id=membership_id if access.can_manage else None
    )
    return await service.member_path(db, config, member)


@router.get("/progress")
async def progress(access: ClassAccess = Depends(read), db: AsyncSession = Depends(get_db)):
    return await service.class_progress(db, access)


@router.post("/lessons/{lesson_id}/events")
async def event(
    lesson_id: str,
    request: LessonEventInput,
    access: ClassAccess = Depends(write_student),
    db: AsyncSession = Depends(get_db),
):
    return await service.record_event(db, access, lesson_id, request)


@router.post("/lessons/{lesson_id}/submissions", status_code=201)
async def submit(
    lesson_id: str,
    request: SubmissionInput,
    access: ClassAccess = Depends(write_student),
    db: AsyncSession = Depends(get_db),
):
    return await service.submit(db, access, lesson_id, request)


@router.get("/lessons/{lesson_id}/submissions")
async def submissions(
    lesson_id: str, access: ClassAccess = Depends(read), db: AsyncSession = Depends(get_db)
):
    rows = await service.submission_query(db, access, lesson_id=lesson_id)
    return [
        service.serialize_submission(row, member.id, progress.lesson_id)
        for row, progress, member in rows
    ]


@router.get("/submissions/{submission_id}")
async def submission(
    submission_id: int, access: ClassAccess = Depends(read), db: AsyncSession = Depends(get_db)
):
    from app.core.lms_errors import LMSError

    rows = await service.submission_query(db, access, submission_id=submission_id)
    if not rows:
        raise LMSError(404, "CONFIG_INVALID", "Không tìm thấy bài nộp.")
    row, progress, member = rows[0]
    return service.serialize_submission(row, member.id, progress.lesson_id)


@router.post("/submissions/{submission_id}/review")
async def review(
    submission_id: int,
    request: ReviewInput,
    access: ClassAccess = Depends(write_teacher),
    db: AsyncSession = Depends(get_db),
):
    return await service.review(db, access, submission_id, request)


@router.post("/completion-overrides")
async def override(
    request: OverrideInput,
    access: ClassAccess = Depends(write_teacher),
    db: AsyncSession = Depends(get_db),
):
    return await service.override(db, access, request)
