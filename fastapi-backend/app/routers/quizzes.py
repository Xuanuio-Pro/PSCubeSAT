from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.lms_errors import LMSError
from app.db import get_db
from app.models.quiz import QuizAttempt
from app.models.tables import User
from app.schemas.quiz import (
    AnswersInput,
    BankFork,
    GenerationInput,
    GrantInput,
    ImportInput,
    PolicyInput,
    QuestionEdit,
    QuestionReview,
    RevisionInput,
    StartInput,
)
from app.services import question_banks as banks
from app.services import quizzes
from app.services.auth import get_required_user
from app.services.permissions import ClassAccess, require_class_member, require_lms_enabled

router = APIRouter(prefix="/api", tags=["quizzes"], dependencies=[Depends(require_lms_enabled)])
teacher = require_class_member(roles=["teacher"], write=True)
student = require_class_member(roles=["student"], write=True)


async def lab_target(lab_id: int):
    """Lab Test routes: the target is the lab id."""
    return lab_id


async def lesson_target(lesson_id: str):
    """Lesson quiz routes: the target is the quiz lesson id."""
    return lesson_id


def register(bank_path, lab_path, target_dep):
    """Mount the bank, policy and attempt routes under one URL scheme."""

    @router.get(bank_path)
    async def bank(
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.view(db, access, target)

    @router.post(bank_path + "/questions")
    async def create_question(
        request: QuestionEdit,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.change_question(db, access, target, request)

    @router.put(bank_path + "/questions/{question_id}")
    async def edit_question(
        question_id: str,
        request: QuestionEdit,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.change_question(db, access, target, request, question_id)

    @router.delete(bank_path + "/questions/{question_id}")
    async def delete_question(
        question_id: str,
        request: RevisionInput,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.change_question(db, access, target, request, question_id, "delete")

    @router.post(bank_path + "/questions/{question_id}/review")
    async def review_question(
        question_id: str,
        request: QuestionReview,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.change_question(db, access, target, request, question_id, "review")

    @router.post(bank_path + "/import")
    async def import_questions(
        request: ImportInput,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.change_question(db, access, target, request, action="import")

    @router.post(bank_path + "/load-samples")
    async def load_samples(
        request: RevisionInput,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.load_samples(db, access, target, request)

    @router.post(bank_path + "/publish")
    async def publish(
        request: RevisionInput,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.publish(db, access, target, request)

    @router.post(bank_path + "/fork")
    async def fork(
        request: BankFork,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.fork(db, access, target, request)

    @router.put(lab_path + "/quiz-policy")
    async def policy(
        request: PolicyInput,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await banks.update_policy(db, access, target, request)

    @router.post(lab_path + "/attempts")
    async def start(
        request: StartInput,
        target=Depends(target_dep),
        access: ClassAccess = Depends(student),
        db: AsyncSession = Depends(get_db),
    ):
        return await quizzes.start(db, access, target, request)

    @router.get(lab_path + "/attempts")
    async def history(
        target=Depends(target_dep),
        access: ClassAccess = Depends(student),
        db: AsyncSession = Depends(get_db),
    ):
        return await quizzes.history(db, access, target)

    @router.post(lab_path + "/attempt-grants")
    async def grant(
        request: GrantInput,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await quizzes.grant(db, access, target, request)

    @router.get(lab_path + "/quiz-statistics")
    async def statistics(
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        return await quizzes.statistics(db, access, target)

    @router.post(bank_path + "/generation-jobs")
    async def generate(
        request: GenerationInput,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        from app.services.question_generation import enqueue

        return await enqueue(db, access, target, request)

    @router.get(bank_path + "/generation-jobs")
    async def jobs(
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        from app.services.question_generation import list_jobs

        return await list_jobs(db, access, target)

    @router.post(bank_path + "/generation-jobs/{job_id}/retry")
    async def retry_job(
        job_id: str,
        target=Depends(target_dep),
        access: ClassAccess = Depends(teacher),
        db: AsyncSession = Depends(get_db),
    ):
        from app.services.question_generation import retry

        return await retry(db, access, target, job_id)


# Lab Test (unchanged URLs) and per-lesson quizzes share one implementation.
register(
    "/classes/{class_id}/labs/{lab_id}/question-bank",
    "/classes/{class_id}/labs/{lab_id}",
    lab_target,
)
register(
    "/classes/{class_id}/lessons/{lesson_id}/question-bank",
    "/classes/{class_id}/lessons/{lesson_id}",
    lesson_target,
)


async def own_attempt(
    attempt_id: str,
    request: Request,
    user: User = Depends(get_required_user),
    db: AsyncSession = Depends(get_db),
):
    probe = await db.get(QuizAttempt, attempt_id)
    if not probe:
        raise LMSError(404, "CONFIG_INVALID", "Không tìm thấy lượt thi.")
    access = await student(probe.class_id, user, db, request)
    member, _, _, _ = await quizzes.context(db, access, probe.lesson_id)
    if probe.membership_id != member.id:
        raise LMSError(403, "FORBIDDEN_ROLE", "Không được truy cập lượt thi của người khác.")
    return (
        await db.execute(
            select(QuizAttempt)
            .where(QuizAttempt.id == attempt_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    ).scalar_one()


@router.put("/attempts/{attempt_id}/answers")
async def save(
    request: AnswersInput,
    attempt: QuizAttempt = Depends(own_attempt),
    db: AsyncSession = Depends(get_db),
):
    return await quizzes.save_answers(db, attempt, request)


@router.post("/attempts/{attempt_id}/submit")
async def submit(attempt: QuizAttempt = Depends(own_attempt), db: AsyncSession = Depends(get_db)):
    return await quizzes.get_result(db, attempt, submit=True)


@router.get("/attempts/{attempt_id}/result")
async def result(attempt: QuizAttempt = Depends(own_attempt), db: AsyncSession = Depends(get_db)):
    return await quizzes.get_result(db, attempt)
