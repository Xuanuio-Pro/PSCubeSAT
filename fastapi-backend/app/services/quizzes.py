"""Server-clock exams. Callers serialize writes by locking the class first."""

import hashlib
import json
import secrets
from copy import deepcopy
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, case, func, select

from app.core.lms_errors import LMSError
from app.models.learning import ProgressEvent
from app.models.quiz import (
    QuestionBank,
    QuizAnswer,
    QuizAttempt,
    QuizAttemptGrant,
    QuizAttemptItem,
    QuizPolicy,
    QuizRequest,
)
from app.models.tables import ClassMembership
from app.services.classes import audit
from app.services.learning_progress import (
    ensure_available,
    member_path,
    progress_row,
    raw_config,
    student_member,
)
from app.services.learning_rules import lesson_version, satisfies
from app.services.question_banks import conflict, invalid, policy_json, questions, uid


def now():
    return datetime.now(timezone.utc)


def utc(value):
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


async def items(db, attempt):
    return list(
        (
            await db.execute(
                select(QuizAttemptItem)
                .where(QuizAttemptItem.attempt_id == attempt.id)
                .order_by(QuizAttemptItem.position)
            )
        ).scalars()
    )


async def answers(db, attempt):
    return {
        row.item_id: row.choice_id
        for row in (
            await db.execute(select(QuizAnswer).where(QuizAnswer.attempt_id == attempt.id))
        ).scalars()
    }


async def attempt_rows(db, member_id, version):
    return list(
        (
            await db.execute(
                select(QuizAttempt)
                .where(
                    QuizAttempt.membership_id == member_id, QuizAttempt.lesson_version == version
                )
                .order_by(QuizAttempt.number)
            )
        ).scalars()
    )


async def allowance(db, member_id, version, base):
    extra = (
        await db.execute(
            select(func.coalesce(func.sum(QuizAttemptGrant.extra_attempts), 0)).where(
                QuizAttemptGrant.membership_id == member_id,
                QuizAttemptGrant.lesson_version == version,
            )
        )
    ).scalar_one()
    return base + extra


async def receipt(db, key, member_id, payload):
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    old = await db.get(QuizRequest, key)
    if old and (old.membership_id != member_id or old.payload_hash != digest):
        conflict()
    return old, digest


async def context(db, access, lab_id):
    member = await student_member(db, access, lock=True)
    config = await raw_config(db, access)
    lesson = next(
        (
            q
            for lab in config["labs"]
            if lab["id"] == lab_id
            for q in lab["lessons"]
            if q["type"] == "labtest"
        ),
        None,
    )
    if lesson is None:
        invalid("Không tìm thấy Lab Test.")
    await ensure_available(db, access, config, lesson["id"])
    return member, config, lesson


async def finalize(db, attempt, *, submit=False):
    if attempt.status != "active" or (not submit and now() < utc(attempt.expires_at)):
        return
    selected = await answers(db, attempt)
    attempt.score = sum(
        selected.get(q.id) == q.snapshot["correct_choice_id"] for q in await items(db, attempt)
    )
    attempt.status = "expired" if now() >= utc(attempt.expires_at) else "submitted"
    attempt.submitted_at = now()
    if attempt.score >= attempt.policy["pass_score"]:
        member = await db.get(ClassMembership, attempt.membership_id)
        row = await progress_row(
            db, {"course_version_id": attempt.course_version_id}, member, attempt.lesson_id
        )
        if not satisfies(row.status):
            row.status, row.completed_at = "completed", now()
    db.add(
        ProgressEvent(
            idempotency_key="quiz:" + attempt.id,
            membership_id=attempt.membership_id,
            lesson_version=attempt.lesson_version,
            kind="labtest_graded",
            payload_hash=attempt.id,
            response={"attempt_id": attempt.id, "score": attempt.score, "status": attempt.status},
        )
    )
    await db.flush()


async def serialize(db, attempt, *, result=False):
    all_attempts = await attempt_rows(db, attempt.membership_id, attempt.lesson_version)
    limit = await allowance(
        db, attempt.membership_id, attempt.lesson_version, attempt.policy["max_attempts"]
    )
    finished = attempt.status != "active"
    reveal = False
    if result and finished:
        rule = attempt.policy["reveal_policy"]
        close = attempt.policy.get("closes_at")
        reveal = (
            rule == "immediate"
            or rule == "after_attempts"
            and len(all_attempts) >= limit
            and not any(a.status == "active" for a in all_attempts)
            or rule == "after_close"
            and close
            and now() >= utc(datetime.fromisoformat(close))
        )
        if reveal and attempt.revealed_at is None:
            attempt.revealed_at = now()
    selected = await answers(db, attempt)
    public_items = []
    for item in await items(db, attempt):
        public = {
            "id": item.id,
            "prompt": item.snapshot["prompt"],
            "choices": item.snapshot["choices"],
        }
        if reveal:
            public.update(
                {
                    k: item.snapshot[k]
                    for k in ("correct_choice_id", "explanation", "source_reference")
                }
            )
        public_items.append(public)
    return {
        "id": attempt.id,
        "class_id": attempt.class_id,
        "lab_id": attempt.lab_id,
        "status": attempt.status,
        "number": attempt.number,
        "policy": attempt.policy,
        "started_at": utc(attempt.started_at).isoformat(),
        "expires_at": utc(attempt.expires_at).isoformat(),
        "server_now": now().isoformat(),
        "answer_revision": attempt.answer_revision,
        "items": public_items,
        "answers": selected,
        "score": attempt.score if finished else None,
        "passed": finished and attempt.score >= attempt.policy["pass_score"],
        "highest_score": max((a.score for a in all_attempts if a.score is not None), default=None),
        "remaining_attempts": max(0, limit - len(all_attempts)),
        "revealed": bool(reveal),
    }


async def start(db, access, lab_id, request):
    member, config, lesson = await context(db, access, lab_id)
    version = lesson_version(config, lesson["id"])
    old, digest = await receipt(
        db, request.idempotency_key, member.id, {"action": "start", "version": version}
    )
    if old:
        attempt = await db.get(QuizAttempt, old.attempt_id)
        await finalize(db, attempt)
    else:
        rows = await attempt_rows(db, member.id, version)
        attempt = next((a for a in rows if a.status == "active"), None)
        if attempt:
            await finalize(db, attempt)
        else:
            path = await member_path(db, config, member)
            lab = next(lab for lab in path["labs"] if lab["id"] == lab_id)
            missing = [
                q["id"]
                for q in lab["lessons"]
                if q["id"] != lesson["id"] and q["required"] and not satisfies(q["status"])
            ]
            if missing:
                raise LMSError(
                    403,
                    "PREREQUISITE_NOT_MET",
                    "Hoàn thành các bài bắt buộc trước khi làm Lab Test.",
                    {"lesson_ids": missing},
                )
            policy = await db.get(QuizPolicy, (access.classroom.id, lab_id))
            bank = await db.get(QuestionBank, policy.bank_id) if policy and policy.bank_id else None
            if (
                not bank
                or bank.status != "published"
                or bank.course_version_id != config["course_version_id"]
            ):
                raise LMSError(409, "BANK_NOT_READY", "Ngân hàng chưa sẵn sàng.")
            snapshot = policy_json(policy)
            # Class configuration may explicitly override these three settings.
            snapshot.update(
                {
                    k: lesson["params"][k]
                    for k in ("time_limit_minutes", "pass_score", "max_attempts")
                    if k in lesson["params"]
                }
            )
            limit = await allowance(db, member.id, version, snapshot["max_attempts"])
            if len(rows) >= limit or any(a.revealed_at for a in rows):
                raise LMSError(
                    409, "ATTEMPT_LIMIT_REACHED", "Đã hết lượt thi hoặc đáp án đã được công bố."
                )
            deadline = now() + timedelta(minutes=snapshot["time_limit_minutes"])
            if policy.closes_at:
                deadline = min(deadline, utc(policy.closes_at))
                if deadline <= now():
                    raise LMSError(409, "ATTEMPT_EXPIRED", "Bài test đã đóng.")
            pool = [q for q in await questions(db, bank.id) if q.status == "approved"]
            if len(pool) != 20:
                raise LMSError(409, "BANK_NOT_READY", "Ngân hàng cần đúng 20 câu đã duyệt.")
            attempt = QuizAttempt(
                id=uid(),
                class_id=access.classroom.id,
                membership_id=member.id,
                lab_id=lab_id,
                lesson_id=lesson["id"],
                lesson_version=version,
                course_version_id=config["course_version_id"],
                bank_id=bank.id,
                number=len(rows) + 1,
                policy=snapshot,
                started_at=now(),
                expires_at=deadline,
            )
            db.add(attempt)
            await db.flush()
            rng = secrets.SystemRandom()
            for position, question in enumerate(rng.sample(pool, 5)):
                content = deepcopy(question.content)
                rng.shuffle(content["choices"])
                db.add(
                    QuizAttemptItem(
                        id=uid(),
                        attempt_id=attempt.id,
                        question_version_id=question.id,
                        position=position,
                        snapshot=content,
                    )
                )
        db.add(
            QuizRequest(
                idempotency_key=request.idempotency_key,
                membership_id=member.id,
                attempt_id=attempt.id,
                payload_hash=digest,
            )
        )
    await db.flush()
    response = await serialize(db, attempt)
    await db.commit()
    return response


async def save_answers(db, attempt, request):
    old, digest = await receipt(
        db,
        request.idempotency_key,
        attempt.membership_id,
        {
            "action": "answers",
            "attempt": attempt.id,
            **request.model_dump(exclude={"idempotency_key"}),
        },
    )
    await finalize(db, attempt)
    if old:
        response = await serialize(db, attempt)
        await db.commit()
        return response
    if attempt.status != "active":
        await db.commit()
        raise LMSError(
            409,
            "ATTEMPT_EXPIRED",
            "Lượt thi đã kết thúc; đáp án đã lưu được chấm.",
            {"attempt_id": attempt.id},
        )
    if request.expected_revision != attempt.answer_revision:
        conflict()
    by_id = {q.id: q for q in await items(db, attempt)}
    for item_id, choice_id in request.answers.items():
        if item_id not in by_id or choice_id not in {
            c["id"] for c in by_id[item_id].snapshot["choices"]
        }:
            invalid("Lựa chọn không thuộc đề thi này.")
    for item_id, choice_id in request.answers.items():
        row = await db.get(QuizAnswer, (attempt.id, item_id))
        if row:
            row.choice_id = choice_id
        else:
            db.add(QuizAnswer(attempt_id=attempt.id, item_id=item_id, choice_id=choice_id))
    attempt.answer_revision += 1
    db.add(
        QuizRequest(
            idempotency_key=request.idempotency_key,
            membership_id=attempt.membership_id,
            attempt_id=attempt.id,
            payload_hash=digest,
            revision=attempt.answer_revision,
        )
    )
    await db.flush()
    response = await serialize(db, attempt)
    await db.commit()
    return response


async def get_result(db, attempt, *, submit=False):
    await finalize(db, attempt, submit=submit)
    response = await serialize(db, attempt, result=True)
    await db.commit()
    return response


async def history(db, access, lab_id):
    member, config, lesson = await context(db, access, lab_id)
    rows = await attempt_rows(db, member.id, lesson_version(config, lesson["id"]))
    for attempt in rows:
        await finalize(db, attempt)
    response = [await serialize(db, a) for a in rows]
    await db.commit()
    return response


async def grant(db, access, lab_id, request):
    member = await student_member(db, access, lock=True, membership_id=request.membership_id)
    config = await raw_config(db, access)
    lesson = next(
        (
            q
            for lab in config["labs"]
            if lab["id"] == lab_id
            for q in lab["lessons"]
            if q["type"] == "labtest"
        ),
        None,
    )
    if not lesson:
        invalid("Không tìm thấy Lab Test.")
    version = lesson_version(config, lesson["id"])
    old = await db.get(QuizAttemptGrant, request.idempotency_key)
    if old:
        if (old.membership_id, old.lesson_version, old.extra_attempts, old.reason, old.actor) != (
            member.id,
            version,
            request.extra_attempts,
            request.reason,
            access.user.id,
        ):
            conflict()
    else:
        rows = await attempt_rows(db, member.id, version)
        if any(a.revealed_at for a in rows):
            invalid("Đã công bố đáp án; không cấp thêm lượt trên cùng bài test.")
        db.add(
            QuizAttemptGrant(
                **request.model_dump(exclude={"membership_id"}),
                membership_id=member.id,
                lesson_version=version,
                actor=access.user.id,
            )
        )
        audit(db, access.user.id, "quiz.grant", str(member.id), None, request.model_dump())
        await db.commit()
    return {"granted": request.extra_attempts, "membership_id": member.id}


async def statistics(db, access, lab_id):
    prompt = QuizAttemptItem.snapshot["prompt"].as_string()
    correct = QuizAttemptItem.snapshot["correct_choice_id"].as_string()
    rows = (
        (
            await db.execute(
                select(
                    QuizAttemptItem.question_version_id.label("question_version_id"),
                    prompt.label("prompt"),
                    func.count().label("total"),
                    func.sum(case((QuizAnswer.choice_id == correct, 1), else_=0)).label("correct"),
                )
                .join(QuizAttempt, QuizAttempt.id == QuizAttemptItem.attempt_id)
                .outerjoin(
                    QuizAnswer,
                    and_(
                        QuizAnswer.attempt_id == QuizAttempt.id,
                        QuizAnswer.item_id == QuizAttemptItem.id,
                    ),
                )
                .where(
                    QuizAttempt.class_id == access.classroom.id,
                    QuizAttempt.lab_id == lab_id,
                    QuizAttempt.status != "active",
                )
                .group_by(QuizAttemptItem.question_version_id, prompt)
            )
        )
        .mappings()
        .all()
    )
    return [{**row, "correct_ratio": row["correct"] / row["total"]} for row in rows]
