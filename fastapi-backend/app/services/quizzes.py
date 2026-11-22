"""Server-clock exams. Callers serialize writes by locking the class first."""

import hashlib
import json
import math
import secrets
from copy import deepcopy
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, case, func, select

from app.core.lms_errors import LMSError
from app.models.curriculum import ClassCourseVersion, ClassLessonSetting
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
from app.schemas.quiz import (
    normalize_multiple_choice_answer,
    normalize_short_answer,
    normalize_true_false_answer,
)
from app.services.classes import audit
from app.services.exam_import import PREFIX_RE, shuffle_true_false_choices
from app.services.learning_progress import (
    ensure_available,
    member_path,
    progress_row,
    raw_config,
    student_member,
)
from app.services.learning_rules import lesson_version, satisfies
from app.services.question_banks import (
    conflict,
    invalid,
    lesson_key,
    policy_json,
    questions,
    uid,
)


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


def finished_at(attempt):
    if attempt.status == "expired":
        return utc(attempt.expires_at)
    return utc(attempt.submitted_at or attempt.expires_at or attempt.started_at)


async def grant_rows(db, member_id, version):
    return list(
        (
            await db.execute(
                select(QuizAttemptGrant)
                .where(
                    QuizAttemptGrant.membership_id == member_id,
                    QuizAttemptGrant.lesson_version == version,
                )
                .order_by(QuizAttemptGrant.created_at, QuizAttemptGrant.idempotency_key)
            )
        ).scalars()
    )


async def effective_retry_policy(db, class_id, lesson_id, fallback_policy=None):
    fallback = fallback_policy or {}
    policy = await db.get(QuizPolicy, (class_id, lesson_id))
    published = (
        await db.execute(
            select(ClassCourseVersion)
            .where(
                ClassCourseVersion.class_id == class_id,
                ClassCourseVersion.status == "published",
            )
            .order_by(ClassCourseVersion.version.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    setting = None
    if published is not None:
        setting = (
            await db.execute(
                select(ClassLessonSetting).where(
                    ClassLessonSetting.class_id == class_id,
                    ClassLessonSetting.version == published.version,
                    ClassLessonSetting.lesson_id == lesson_id,
                )
            )
        ).scalar_one_or_none()
    params = setting.params if setting else {}
    max_attempts = (
        params["max_attempts"]
        if "max_attempts" in params
        else (policy.max_attempts if policy else fallback.get("max_attempts"))
    )
    cooldown_minutes = (
        params["cooldown_minutes"]
        if "cooldown_minutes" in params
        else (policy.cooldown_minutes if policy else fallback.get("cooldown_minutes", 0))
    )
    reveal_policy = policy.reveal_policy if policy else fallback.get("reveal_policy", "after_pass")
    closes_at = policy.closes_at if policy else fallback.get("closes_at")
    return {
        "max_attempts": max_attempts,
        "cooldown_minutes": int(cooldown_minutes or 0),
        "reveal_policy": reveal_policy,
        "closes_at": closes_at,
    }


def compute_retry_state(
    rows,
    grants,
    *,
    max_attempts,
    cooldown_minutes,
    reveal_policy,
    closes_at,
    current_time,
):
    current_time = utc(current_time)
    has_active = any(a.status == "active" for a in rows)
    has_passed = any(
        a.status != "active" and a.score is not None and a.score >= a.policy["pass_score"]
        for a in rows
    )
    close_dt = (
        utc(datetime.fromisoformat(closes_at))
        if isinstance(closes_at, str)
        else utc(closes_at)
        if closes_at is not None
        else None
    )
    closed = close_dt is not None and current_time >= close_dt
    unlimited = max_attempts is None
    cooldown = int(cooldown_minutes or 0)
    repeatable = unlimited or cooldown > 0

    if closed:
        locked = True
    elif reveal_policy == "after_pass" and has_passed:
        locked = True
    elif reveal_policy == "immediate" and any(a.revealed_at for a in rows):
        locked = True
    elif not repeatable and any(a.revealed_at for a in rows):
        locked = True
    elif repeatable and any(
        a.revealed_at
        and (
            a.policy.get("reveal_policy") in ("immediate", "after_close")
            or (
                a.score is not None
                and a.score >= a.policy["pass_score"]
                and a.policy.get("reveal_policy") == "after_pass"
            )
        )
        for a in rows
    ):
        locked = True
    else:
        locked = False

    cooldown_until = None
    cooldown_remaining_seconds = 0

    if unlimited:
        remaining_attempts = None
        can_start = not has_active and not locked
    elif cooldown == 0:
        limit = max_attempts + sum(g.extra_attempts for g in grants)
        remaining_attempts = max(0, limit - len(rows))
        can_start = not has_active and not locked and remaining_attempts > 0
    else:
        ordered_grants = sorted(grants, key=lambda g: (utc(g.created_at), g.idempotency_key))
        grant_idx = 0
        used_in_batch = 0
        batch_limit = max_attempts
        batch_end = None
        cooldown_delta = timedelta(minutes=cooldown)

        def apply_grant(grant):
            nonlocal used_in_batch, batch_limit, batch_end
            grant_time = utc(grant.created_at)
            if batch_end is not None and grant_time >= batch_end + cooldown_delta:
                used_in_batch = 0
                batch_limit = max_attempts
                batch_end = None
            batch_limit += grant.extra_attempts
            if used_in_batch < batch_limit:
                batch_end = None

        for attempt in rows:
            attempt_start = utc(attempt.started_at)
            while (
                grant_idx < len(ordered_grants)
                and utc(ordered_grants[grant_idx].created_at) <= attempt_start
            ):
                apply_grant(ordered_grants[grant_idx])
                grant_idx += 1
            if batch_end is not None and attempt_start >= batch_end + cooldown_delta:
                used_in_batch = 0
                batch_limit = max_attempts
                batch_end = None
            used_in_batch += 1
            if attempt.status != "active" and used_in_batch >= batch_limit:
                batch_end = finished_at(attempt)

        while grant_idx < len(ordered_grants):
            apply_grant(ordered_grants[grant_idx])
            grant_idx += 1

        if not has_active and batch_end is not None:
            until = batch_end + cooldown_delta
            if current_time >= until:
                used_in_batch = 0
                batch_limit = max_attempts
                batch_end = None
            else:
                cooldown_until = until
                cooldown_remaining_seconds = max(
                    1, math.ceil((until - current_time).total_seconds())
                )

        remaining_attempts = max(0, batch_limit - used_in_batch)
        can_start = (
            not has_active and not locked and remaining_attempts > 0 and cooldown_until is None
        )

    return {
        "remaining_attempts": remaining_attempts,
        "unlimited": unlimited,
        "cooldown_minutes": cooldown,
        "cooldown_until": cooldown_until,
        "cooldown_remaining_seconds": cooldown_remaining_seconds,
        "can_start": can_start,
        "locked": locked,
        "has_passed": has_passed,
        "repeatable": repeatable,
    }


async def receipt(db, key, member_id, payload):
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    old = await db.get(QuizRequest, key)
    if old and (old.membership_id != member_id or old.payload_hash != digest):
        conflict()
    return old, digest


def find_quiz_lesson(config, target):
    """The Lab Test of a lab (int target) or a quiz lesson by id (str target)."""
    key = lesson_key(target)
    for lab in config["labs"]:
        for q in lab["lessons"]:
            if q["id"] == key and q["type"] in ("labtest", "quiz"):
                return lab["id"], q
    return None, None


async def context(db, access, target):
    member = await student_member(db, access, lock=True)
    config = await raw_config(db, access)
    lab_id, lesson = find_quiz_lesson(config, target)
    if lesson is None:
        invalid("Không tìm thấy bài kiểm tra.")
    await ensure_available(db, access, config, lesson["id"])
    return member, config, lesson, lab_id


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
    grants = await grant_rows(db, attempt.membership_id, attempt.lesson_version)
    eff = await effective_retry_policy(db, attempt.class_id, attempt.lesson_id, attempt.policy)
    current = now()
    retry = compute_retry_state(all_attempts, grants, **eff, current_time=current)
    finished = attempt.status != "active"
    reveal = False
    if result and finished:
        rule = attempt.policy["reveal_policy"]
        close = attempt.policy.get("closes_at")
        attempt_repeatable = (
            attempt.policy.get("max_attempts") is None
            or int(attempt.policy.get("cooldown_minutes") or 0) > 0
        )
        attempts_done = (
            (not attempt_repeatable)
            and (not retry["unlimited"])
            and (retry["remaining_attempts"] == 0)
            and not any(a.status == "active" for a in all_attempts)
        )
        passed_now = attempt.score is not None and attempt.score >= attempt.policy["pass_score"]
        reveal = (
            attempt.revealed_at is not None
            or rule == "immediate"
            or (rule == "after_attempts" and attempts_done)
            # Passing opens explanations at once; failed attempts stay hidden while retakes/cooldown exist.
            or (rule == "after_pass" and (passed_now or attempts_done))
            or (rule == "after_close" and close and current >= utc(datetime.fromisoformat(close)))
        )
        if reveal and attempt.revealed_at is None:
            attempt.revealed_at = current
            retry = compute_retry_state(all_attempts, grants, **eff, current_time=current)
    selected = await answers(db, attempt)
    public_items = []
    for item in await items(db, attempt):
        q_type = item.snapshot.get("question_type", "single_choice")
        raw_choices = [] if q_type == "short_answer" else item.snapshot["choices"]
        if q_type == "true_false":
            raw_choices = [
                {"id": c["id"], "text": PREFIX_RE.sub("", c["text"]).strip() or c["text"]}
                for c in raw_choices
            ]
        public = {
            "id": item.id,
            "prompt": item.snapshot["prompt"],
            "choices": raw_choices,
        }
        if q_type != "single_choice":
            public["question_type"] = q_type
        if reveal:
            public.update(
                {
                    k: item.snapshot[k]
                    for k in (
                        "correct_choice_id",
                        "explanation",
                        "choice_explanations",
                        "source_reference",
                    )
                    if k in item.snapshot
                }
            )
        public_items.append(public)
    return {
        "id": attempt.id,
        "class_id": attempt.class_id,
        "lab_id": attempt.lab_id,
        "lesson_id": attempt.lesson_id,
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
        "remaining_attempts": retry["remaining_attempts"],
        "unlimited_attempts": retry["unlimited"],
        "can_retry": retry["can_start"],
        "cooldown_minutes": retry["cooldown_minutes"],
        "cooldown_until": retry["cooldown_until"].isoformat() if retry["cooldown_until"] else None,
        "cooldown_remaining_seconds": retry["cooldown_remaining_seconds"],
        "revealed": bool(reveal),
    }


async def start(db, access, target, request):
    member, config, lesson, lab_id = await context(db, access, target)
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
            # Only the Lab Test waits for the whole lab; a lesson quiz is gated by the lesson order.
            missing = [
                q["id"]
                for q in lab["lessons"]
                if lesson["type"] == "labtest"
                and q["id"] != lesson["id"]
                and q["required"]
                and not satisfies(q["status"])
            ]
            if missing:
                raise LMSError(
                    403,
                    "PREREQUISITE_NOT_MET",
                    "Hoàn thành các bài bắt buộc trước khi làm Lab Test.",
                    {"lesson_ids": missing},
                )
            policy = await db.get(QuizPolicy, (access.classroom.id, lesson["id"]))
            bank = await db.get(QuestionBank, policy.bank_id) if policy and policy.bank_id else None
            if (
                not bank
                or bank.status != "published"
                or bank.course_version_id != config["course_version_id"]
            ):
                raise LMSError(409, "BANK_NOT_READY", "Ngân hàng chưa sẵn sàng.")
            snapshot = policy_json(policy)
            # Class configuration may explicitly override these settings (including None for unlimited).
            snapshot.update(
                {
                    k: lesson["params"][k]
                    for k in (
                        "time_limit_minutes",
                        "pass_score",
                        "max_attempts",
                        "cooldown_minutes",
                    )
                    if k in lesson["params"]
                }
            )
            current = now()
            grants = await grant_rows(db, member.id, version)
            retry = compute_retry_state(
                rows,
                grants,
                max_attempts=snapshot["max_attempts"],
                cooldown_minutes=snapshot.get("cooldown_minutes", 0),
                reveal_policy=snapshot["reveal_policy"],
                closes_at=policy.closes_at,
                current_time=current,
            )
            if not retry["can_start"]:
                if retry["cooldown_until"]:
                    raise LMSError(
                        409,
                        "ATTEMPT_LIMIT_REACHED",
                        (
                            f"Đã hết {snapshot['max_attempts']} lượt trong đợt này. "
                            "Vui lòng chờ để làm đợt tiếp theo."
                        ),
                        {
                            "cooldown_until": retry["cooldown_until"].isoformat(),
                            "retry_after_seconds": retry["cooldown_remaining_seconds"],
                        },
                    )
                if policy.closes_at and current >= utc(policy.closes_at):
                    raise LMSError(409, "ATTEMPT_EXPIRED", "Bài test đã đóng.")
                raise LMSError(
                    409, "ATTEMPT_LIMIT_REACHED", "Đã hết lượt thi hoặc đáp án đã được công bố."
                )
            deadline = current + timedelta(minutes=snapshot["time_limit_minutes"])
            if policy.closes_at:
                deadline = min(deadline, utc(policy.closes_at))
                if deadline <= current:
                    raise LMSError(409, "ATTEMPT_EXPIRED", "Bài test đã đóng.")
            pool = [q for q in await questions(db, bank.id) if q.status == "approved"]
            if not pool:
                raise LMSError(409, "BANK_NOT_READY", "Ngân hàng chưa có câu hỏi đã duyệt.")
            # Every approved question is on the paper: the teacher decides the size by what they add.
            draw = len(pool)
            snapshot["num_questions"] = draw
            snapshot["pass_score"] = min(snapshot["pass_score"], draw)
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
            for position, question in enumerate(rng.sample(pool, draw)):
                content = deepcopy(question.content)
                q_type = content.get("question_type", "single_choice")
                if q_type == "true_false":
                    content["choices"] = shuffle_true_false_choices(rng, content["choices"])
                elif q_type in ("single_choice", "multiple_choice"):
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
    normalized_answers: dict[str, str] = {}
    for item_id, choice_id in request.answers.items():
        if item_id not in by_id:
            invalid("Lựa chọn không thuộc đề thi này.")
        snapshot = by_id[item_id].snapshot
        q_type = snapshot.get("question_type", "single_choice")
        valid_ids = [c["id"] for c in snapshot["choices"]]
        try:
            if q_type == "single_choice":
                if choice_id not in set(valid_ids):
                    raise ValueError("Invalid single choice")
                normalized_answers[item_id] = choice_id
            elif q_type == "multiple_choice":
                normalized_answers[item_id] = normalize_multiple_choice_answer(choice_id, valid_ids)
            elif q_type == "true_false":
                normalized_answers[item_id] = normalize_true_false_answer(
                    choice_id, valid_ids, partial=True
                )
            elif q_type == "short_answer":
                ans = normalize_short_answer(choice_id)
                if not ans or len(ans) > 64:
                    raise ValueError("Invalid short answer")
                normalized_answers[item_id] = ans
            else:
                raise ValueError("Unknown question type")
        except ValueError:
            invalid("Lựa chọn không thuộc đề thi này.")
    for item_id, choice_id in normalized_answers.items():
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


async def history(db, access, target):
    member, config, lesson, _ = await context(db, access, target)
    rows = await attempt_rows(db, member.id, lesson_version(config, lesson["id"]))
    for attempt in rows:
        await finalize(db, attempt)
    response = [await serialize(db, a) for a in rows]
    await db.commit()
    return response


async def grant(db, access, target, request):
    member = await student_member(db, access, lock=True, membership_id=request.membership_id)
    config = await raw_config(db, access)
    _, lesson = find_quiz_lesson(config, target)
    if not lesson:
        invalid("Không tìm thấy bài kiểm tra.")
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
        grants = await grant_rows(db, member.id, version)
        eff = await effective_retry_policy(db, access.classroom.id, lesson["id"])
        retry = compute_retry_state(rows, grants, **eff, current_time=now())
        if retry["locked"]:
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


async def statistics(db, access, target):
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
                    QuizAttempt.lesson_id == lesson_key(target),
                    QuizAttempt.status != "active",
                )
                .group_by(QuizAttemptItem.question_version_id, prompt)
            )
        )
        .mappings()
        .all()
    )
    return [{**row, "correct_ratio": row["correct"] / row["total"]} for row in rows]
