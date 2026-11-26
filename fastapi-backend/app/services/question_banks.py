"""Teacher-only authoring; published editions never change in place."""

import asyncio
import json
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4
from weakref import WeakKeyDictionary

from pydantic import ValidationError
from sqlalchemy import func, insert, select

from app.core.lms_errors import LMSError
from app.models.curriculum import ClassCourseVersion, CourseVersion, Lab, Lesson
from app.models.quiz import QuestionBank, QuestionVersion, QuizAttemptItem, QuizPolicy
from app.models.tables import Classroom
from app.schemas.quiz import QuestionInput, normalized
from app.services.classes import audit
from app.services.exam_import import (
    merge_questions_and_answers,
    parse_csv_questions,
    parse_docx_questions,
    parse_exam_text,
    parse_xlsx_questions,
)
from app.services.sample_questions import (
    default_policy,
    is_legacy_generic_prompt,
    sample_questions_for,
)


def uid():
    return str(uuid4())


def lesson_key(target):
    """Bank key: an int lab id means that lab's Lab Test, a string is a lesson id."""
    return f"labtest-{target}" if isinstance(target, int) else target


def is_labtest(key):
    return key.startswith("labtest-")


def required_questions(key, policy):
    """Approved questions a bank must hold before it can be published (every attempt uses them all)."""
    return 1


def conflict():
    raise LMSError(409, "VERSION_CONFLICT", "Dữ liệu đã thay đổi. Hãy tải lại trước khi lưu.")


def invalid(message, details=None):
    raise LMSError(422, "CONFIG_INVALID", message, details or {})


async def current_course_id(db, access):
    course_id = (
        await db.execute(
            select(ClassCourseVersion.course_version_id)
            .where(ClassCourseVersion.class_id == access.classroom.id)
            .order_by(ClassCourseVersion.version.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if not course_id:
        course_id = (
            await db.execute(
                select(CourseVersion.id)
                .where(CourseVersion.status == "published")
                .order_by(CourseVersion.version.desc(), CourseVersion.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
    return course_id


_SEED_LOCKS: WeakKeyDictionary = WeakKeyDictionary()


def _seed_lock(class_id: int) -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    locks = _SEED_LOCKS.get(loop)
    if locks is None:
        locks = {}
        _SEED_LOCKS[loop] = locks
    lock = locks.get(class_id)
    if lock is None:
        lock = asyncio.Lock()
        locks[class_id] = lock
    return lock


async def _bulk_insert_question_versions(db, rows: list[dict], *, chunk_size: int = 100) -> None:
    """Insert QuestionVersion rows in chunks so large banks stay fast in SQLite and PostgreSQL."""
    for idx in range(0, len(rows), chunk_size):
        await db.execute(insert(QuestionVersion), rows[idx : idx + chunk_size])


async def _seed_lesson_bank_and_policy(
    db,
    *,
    class_id: int,
    actor_id: int,
    course_version_id: str,
    lab_id: int,
    key: str,
    version: int,
    quiz_index: int,
    need_bank: bool,
    need_policy: bool,
    seeded_at: datetime,
):
    samples = (
        sample_questions_for(lab_id, key, quiz_index=quiz_index)
        if (need_bank or need_policy)
        else []
    )
    if need_bank:
        bank = QuestionBank(
            id=uid(),
            class_id=class_id,
            course_version_id=course_version_id,
            lab_id=lab_id,
            lesson_id=key,
            version=version,
            created_by=actor_id,
        )
        db.add(bank)
        await db.flush()
        await _bulk_insert_question_versions(
            db,
            [
                {
                    "id": uid(),
                    "bank_id": bank.id,
                    "question_id": uid(),
                    "content": sample,
                    "status": "approved",
                    "reviewer": actor_id,
                    "reviewed_at": seeded_at,
                }
                for sample in samples
            ],
        )
    if need_policy:
        defaults = default_policy(
            "labtest" if is_labtest(key) else "quiz",
            sample_count=len(samples) or None,
        )
        db.add(QuizPolicy(class_id=class_id, lesson_id=key, lab_id=lab_id, **defaults))


async def seed_banks(db, access, course_id, *, commit=False):
    async with _seed_lock(access.classroom.id):
        await db.execute(
            select(Classroom.id).where(Classroom.id == access.classroom.id).with_for_update()
        )
        existing = set(
            (
                await db.execute(
                    select(QuestionBank.lesson_id).where(
                        QuestionBank.class_id == access.classroom.id,
                        QuestionBank.course_version_id == course_id,
                    )
                )
            ).scalars()
        )
        max_versions = dict(
            (
                await db.execute(
                    select(QuestionBank.lesson_id, func.max(QuestionBank.version))
                    .where(QuestionBank.class_id == access.classroom.id)
                    .group_by(QuestionBank.lesson_id)
                )
            ).all()
        )
        quiz_lessons = (
            await db.execute(
                select(Lesson.id, Lesson.lab_id)
                .where(Lesson.course_version_id == course_id, Lesson.type == "quiz")
                .order_by(Lesson.lab_id, Lesson.order_no, Lesson.id)
            )
        ).all()
        per_lab_count: dict[int, int] = {}
        quiz_indices: dict[str, int] = {}
        for lesson_id, lab_id in quiz_lessons:
            idx = per_lab_count.get(lab_id, 0)
            quiz_indices[lesson_id] = idx
            per_lab_count[lab_id] = idx + 1

        # One Lab Test bank per lab plus one bank per quiz lesson of this course version.
        targets = [(f"labtest-{lab_id}", lab_id) for lab_id in range(9)] + [
            (lesson_id, lab_id) for lesson_id, lab_id in quiz_lessons
        ]
        seeded_at = datetime.now(timezone.utc)
        for key, lab_id in targets:
            need_bank = key not in existing
            need_policy = await db.get(QuizPolicy, (access.classroom.id, key)) is None
            await _seed_lesson_bank_and_policy(
                db,
                class_id=access.classroom.id,
                actor_id=access.user.id,
                course_version_id=course_id,
                lab_id=lab_id,
                key=key,
                version=(max_versions.get(key) or 0) + 1,
                quiz_index=quiz_indices.get(key, 0),
                need_bank=need_bank,
                need_policy=need_policy,
                seeded_at=seeded_at,
            )
        await db.flush()
        if commit:
            await db.commit()


def _clone_question_payloads(target_bank_id: str, rows) -> list[dict]:
    return [
        {
            "id": uid(),
            "bank_id": target_bank_id,
            "question_id": q.question_id,
            "content": deepcopy(q.content),
            "status": q.status,
            "reviewer": q.reviewer,
            "reviewed_at": q.reviewed_at,
        }
        for q in rows
    ]


async def _clone_bank_to_course_version(
    db, old_bank, *, target_course_version_id: str, lab_id: int, next_version: int, actor_id: int
):
    """Copy a bank onto a new course version cleanly without mutating published source rows."""
    old_questions = await questions(db, old_bank.id)
    new_bank = QuestionBank(
        id=uid(),
        class_id=old_bank.class_id,
        course_version_id=target_course_version_id,
        lab_id=lab_id,
        lesson_id=old_bank.lesson_id,
        version=next_version,
        revision=1,
        status="draft",
        reason=old_bank.reason or "",
        created_by=old_bank.created_by,
    )
    db.add(new_bank)
    await db.flush()
    await _bulk_insert_question_versions(db, _clone_question_payloads(new_bank.id, old_questions))
    if old_bank.status == "published":
        new_bank.status = "published"
        new_bank.published_by = old_bank.published_by or actor_id
        await db.flush()
    return new_bank


async def _load_banks_by_lesson(db, class_id: int) -> dict[str, list[QuestionBank]]:
    all_banks = list(
        (
            await db.execute(
                select(QuestionBank)
                .where(QuestionBank.class_id == class_id)
                .order_by(QuestionBank.lesson_id, QuestionBank.version.desc())
            )
        ).scalars()
    )
    by_key: dict[str, list[QuestionBank]] = {}
    for bank in all_banks:
        by_key.setdefault(bank.lesson_id, []).append(bank)
    return by_key


def _quiz_indices_and_targets(labs, lessons) -> tuple[dict[str, int], list[tuple[str, int]]]:
    quiz_lessons = sorted(
        (item for item in lessons if item.type == "quiz"),
        key=lambda item: (item.lab_id, item.order_no, item.id),
    )
    per_lab_count: dict[int, int] = {}
    quiz_indices: dict[str, int] = {}
    for item in quiz_lessons:
        idx = per_lab_count.get(item.lab_id, 0)
        quiz_indices[item.id] = idx
        per_lab_count[item.lab_id] = idx + 1
    targets = [(f"labtest-{lab.id}", lab.id) for lab in labs] + [
        (item.id, item.lab_id) for item in quiz_lessons
    ]
    return quiz_indices, targets


async def upgrade_banks_for_course_version(
    db, class_id: int, actor_id: int, target_course_version_id: str, labs, lessons
):
    """Clone existing banks onto `target_course_version_id` and seed missing quiz/labtest banks."""
    async with _seed_lock(class_id):
        by_key = await _load_banks_by_lesson(db, class_id)
        quiz_indices, targets = _quiz_indices_and_targets(labs, lessons)
        seeded_at = datetime.now(timezone.utc)
        for key, lab_id in targets:
            banks_for_key = by_key.get(key, [])
            policy = await db.get(QuizPolicy, (class_id, key))
            target_banks = [
                b for b in banks_for_key if b.course_version_id == target_course_version_id
            ]
            if target_banks:
                if policy and policy.bank_id:
                    linked = next((b for b in banks_for_key if b.id == policy.bank_id), None)
                    target_pub = next((b for b in target_banks if b.status == "published"), None)
                    if (
                        linked
                        and linked.course_version_id != target_course_version_id
                        and target_pub
                    ):
                        policy.bank_id = target_pub.id
                if policy is None:
                    await _seed_lesson_bank_and_policy(
                        db,
                        class_id=class_id,
                        actor_id=actor_id,
                        course_version_id=target_course_version_id,
                        lab_id=lab_id,
                        key=key,
                        version=(banks_for_key[0].version if banks_for_key else 0) + 1,
                        quiz_index=quiz_indices.get(key, 0),
                        need_bank=False,
                        need_policy=True,
                        seeded_at=seeded_at,
                    )
                continue

            if banks_for_key:
                next_ver = banks_for_key[0].version + 1
                latest_old = banks_for_key[0]
                pub_old = (
                    next(
                        (
                            b
                            for b in banks_for_key
                            if b.id == policy.bank_id and b.status == "published"
                        ),
                        None,
                    )
                    if policy and policy.bank_id
                    else None
                )
                if pub_old is None and latest_old.status == "published":
                    pub_old = latest_old
                if pub_old is not None and pub_old.id != latest_old.id:
                    cloned_pub = await _clone_bank_to_course_version(
                        db,
                        pub_old,
                        target_course_version_id=target_course_version_id,
                        lab_id=lab_id,
                        next_version=next_ver,
                        actor_id=actor_id,
                    )
                    next_ver += 1
                    if policy and policy.bank_id == pub_old.id:
                        policy.bank_id = cloned_pub.id
                    await _clone_bank_to_course_version(
                        db,
                        latest_old,
                        target_course_version_id=target_course_version_id,
                        lab_id=lab_id,
                        next_version=next_ver,
                        actor_id=actor_id,
                    )
                else:
                    cloned = await _clone_bank_to_course_version(
                        db,
                        latest_old,
                        target_course_version_id=target_course_version_id,
                        lab_id=lab_id,
                        next_version=next_ver,
                        actor_id=actor_id,
                    )
                    if (
                        latest_old.status == "published"
                        and policy
                        and policy.bank_id == latest_old.id
                    ):
                        policy.bank_id = cloned.id
                if policy is None:
                    await _seed_lesson_bank_and_policy(
                        db,
                        class_id=class_id,
                        actor_id=actor_id,
                        course_version_id=target_course_version_id,
                        lab_id=lab_id,
                        key=key,
                        version=next_ver,
                        quiz_index=quiz_indices.get(key, 0),
                        need_bank=False,
                        need_policy=True,
                        seeded_at=seeded_at,
                    )
            else:
                await _seed_lesson_bank_and_policy(
                    db,
                    class_id=class_id,
                    actor_id=actor_id,
                    course_version_id=target_course_version_id,
                    lab_id=lab_id,
                    key=key,
                    version=1,
                    quiz_index=quiz_indices.get(key, 0),
                    need_bank=True,
                    need_policy=policy is None,
                    seeded_at=seeded_at,
                )
        await db.flush()


async def refresh_default_banks_for_class(
    db, class_id: int, actor_id: int | None = None, *, commit: bool = False
) -> dict[str, int]:
    """Safely replace legacy CPU/RAM/IPv4 sample questions and defaults on an existing class.

    Never mutates published QuestionBank rows (PostgreSQL immutability trigger): creates
    `version + 1`, keeps any non-legacy teacher questions, and auto-publishes if the prior
    latest bank on the active course version was published.
    """
    classroom = await db.get(Classroom, class_id)
    if classroom is None:
        return {"class_id": class_id, "refreshed_banks": 0, "updated_policies": 0}
    actor = actor_id or classroom.created_by
    course_version_id = (
        await db.execute(
            select(ClassCourseVersion.course_version_id)
            .where(ClassCourseVersion.class_id == class_id)
            .order_by(ClassCourseVersion.version.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if not course_version_id:
        course_version_id = (
            await db.execute(
                select(CourseVersion.id)
                .where(CourseVersion.status == "published")
                .order_by(CourseVersion.version.desc(), CourseVersion.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
    if not course_version_id:
        return {"class_id": class_id, "refreshed_banks": 0, "updated_policies": 0}

    labs = list(
        (
            await db.execute(
                select(Lab)
                .where(Lab.course_version_id == course_version_id)
                .order_by(Lab.order_no, Lab.id)
            )
        ).scalars()
    )
    lessons = list(
        (
            await db.execute(
                select(Lesson)
                .where(Lesson.course_version_id == course_version_id)
                .order_by(Lesson.lab_id, Lesson.order_no, Lesson.id)
            )
        ).scalars()
    )
    quiz_indices, targets = _quiz_indices_and_targets(labs, lessons)
    refreshed_banks = 0
    updated_policies = 0
    async with _seed_lock(class_id):
        by_key = await _load_banks_by_lesson(db, class_id)

        seeded_at = datetime.now(timezone.utc)
        for key, lab_id in targets:
            kind = "labtest" if is_labtest(key) else "quiz"
            samples = sample_questions_for(lab_id, key, quiz_index=quiz_indices.get(key, 0))
            target_policy = default_policy(kind, len(samples))

            policy = await db.get(QuizPolicy, (class_id, key))
            if policy is None:
                policy = QuizPolicy(
                    class_id=class_id, lesson_id=key, lab_id=lab_id, **target_policy
                )
                db.add(policy)
                await db.flush()
                updated_policies += 1
            else:
                sig = (policy.num_questions, policy.pass_score, policy.time_limit_minutes)
                is_legacy_quiz_policy = kind == "quiz" and sig == (3, 2, 10)
                is_legacy_labtest_policy = kind == "labtest" and sig in {
                    (10, 8, 15),
                    (5, 4, 10),
                }
                if is_legacy_quiz_policy or is_legacy_labtest_policy:
                    policy.num_questions = target_policy["num_questions"]
                    policy.pass_score = target_policy["pass_score"]
                    policy.time_limit_minutes = target_policy["time_limit_minutes"]
                    policy.revision += 1
                    await db.flush()
                    updated_policies += 1

            banks_for_key = by_key.get(key, [])
            target_banks = [b for b in banks_for_key if b.course_version_id == course_version_id]
            max_ver = banks_for_key[0].version if banks_for_key else 0
            bank = target_banks[0] if target_banks else None
            if bank is None:
                await _seed_lesson_bank_and_policy(
                    db,
                    class_id=class_id,
                    actor_id=actor,
                    course_version_id=course_version_id,
                    lab_id=lab_id,
                    key=key,
                    version=max_ver + 1,
                    quiz_index=quiz_indices.get(key, 0),
                    need_bank=True,
                    need_policy=False,
                    seeded_at=seeded_at,
                )
                refreshed_banks += 1
                continue

            old_rows = await questions(db, bank.id)
            has_legacy = any(
                is_legacy_generic_prompt((q.content or {}).get("prompt")) for q in old_rows
            )
            if not has_legacy and len(old_rows) > 0:
                continue

            kept = [
                q
                for q in old_rows
                if q.status != "retired"
                and not is_legacy_generic_prompt((q.content or {}).get("prompt"))
            ]
            seen_prompts = {normalized((q.content or {}).get("prompt", "")) for q in kept}
            to_add = []
            for sample in samples:
                prompt_key = normalized(sample["prompt"])
                if not prompt_key or prompt_key in seen_prompts:
                    continue
                if len(kept) + len(to_add) >= 500:
                    break
                seen_prompts.add(prompt_key)
                to_add.append(sample)

            new_bank = QuestionBank(
                id=uid(),
                class_id=class_id,
                course_version_id=course_version_id,
                lab_id=lab_id,
                lesson_id=key,
                version=max_ver + 1,
                revision=1,
                status="draft",
                reason="Cập nhật ngân hàng câu hỏi CubeSAT mặc định",
                created_by=actor,
            )
            db.add(new_bank)
            await db.flush()

            await _bulk_insert_question_versions(
                db,
                _clone_question_payloads(new_bank.id, kept)
                + [
                    {
                        "id": uid(),
                        "bank_id": new_bank.id,
                        "question_id": uid(),
                        "content": sample,
                        "status": "approved",
                        "reviewer": actor,
                        "reviewed_at": seeded_at,
                    }
                    for sample in to_add
                ],
            )
            if bank.status == "published" and (to_add or any(q.status == "approved" for q in kept)):
                await publish_bank_row(db, actor, new_bank, policy)
            refreshed_banks += 1

        await db.flush()
    if commit:
        await db.commit()
    return {
        "class_id": class_id,
        "refreshed_banks": refreshed_banks,
        "updated_policies": updated_policies,
    }


async def latest_bank(db, access, key):
    return (
        await db.execute(
            select(QuestionBank)
            .where(QuestionBank.class_id == access.classroom.id, QuestionBank.lesson_id == key)
            .order_by(QuestionBank.version.desc())
            .limit(1)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()


async def bank_for(db, access, target, expected=None, *, editable=False):
    """Latest bank of a lab's Lab Test (int target) or of a quiz lesson (lesson id target)."""
    key = lesson_key(target)
    bank = await latest_bank(db, access, key)
    if bank is None and (not isinstance(target, int) or 0 <= target <= 8):
        course_id = await current_course_id(db, access)
        if course_id:
            await seed_banks(db, access, course_id, commit=True)
            bank = await latest_bank(db, access, key)
    if bank is None:
        invalid("Lưu cấu hình giáo trình trước khi soạn ngân hàng.")
    if expected is not None and bank.revision != expected:
        conflict()
    if editable and bank.status != "draft":
        invalid("Ngân hàng đã xuất bản. Tạo phiên bản mới để chỉnh sửa.")
    return bank


async def questions(db, bank_id):
    return list(
        (
            await db.execute(
                select(QuestionVersion)
                .where(QuestionVersion.bank_id == bank_id)
                .order_by(QuestionVersion.id)
            )
        ).scalars()
    )


def policy_json(policy):
    result = {
        key: getattr(policy, key)
        for key in (
            "revision",
            "num_questions",
            "time_limit_minutes",
            "pass_score",
            "max_attempts",
            "cooldown_minutes",
            "score_rule",
            "reveal_policy",
        )
    }
    result["closes_at"] = policy.closes_at.isoformat() if policy.closes_at else None
    return result


async def view(db, access, target):
    from app.services.question_generation import available

    bank = await bank_for(db, access, target)
    rows = await questions(db, bank.id)
    policy = await db.get(QuizPolicy, (access.classroom.id, bank.lesson_id))
    return {
        "id": bank.id,
        "lesson_id": bank.lesson_id,
        "lab_id": bank.lab_id,
        "kind": "labtest" if is_labtest(bank.lesson_id) else "quiz",
        "required_questions": required_questions(bank.lesson_id, policy),
        "version": bank.version,
        "revision": bank.revision,
        "status": bank.status,
        "approved_count": sum(q.status == "approved" for q in rows),
        "ai_available": available(),
        "policy": policy_json(policy),
        "questions": [
            {
                "id": q.id,
                "question_id": q.question_id,
                "status": q.status,
                "reviewer": q.reviewer,
                **q.content,
            }
            for q in rows
        ],
    }


def validate_distinct(existing, incoming):
    seen = {normalized(q["prompt"]) for q in existing}
    for index, question in enumerate(incoming):
        prompt = normalized(question["prompt"])
        if prompt in seen:
            invalid(
                "Có câu hỏi trùng hoặc gần trùng; hãy sửa nội dung trước khi lưu.",
                {"row": index + 1, "field": "prompt"},
            )
        seen.add(prompt)


async def add_questions(db, bank, content):
    rows = await questions(db, bank.id)
    if len(rows) + len(content) > 500:
        invalid("Mỗi phiên bản ngân hàng chứa tối đa 500 câu nháp.")
    validate_distinct([q.content for q in rows if q.status != "retired"], content)
    for question in content:
        db.add(
            QuestionVersion(
                id=uid(), bank_id=bank.id, question_id=uid(), content=question, status="draft"
            )
        )
    bank.revision += 1
    await db.flush()


def parse_import(request):
    try:
        if request.format == "json":
            data = json.loads(request.content)
            data = data["questions"] if isinstance(data, dict) else data
        elif request.format == "xlsx":
            data = parse_xlsx_questions(request.content)
        elif request.format == "docx":
            data = parse_docx_questions(request.content)
        elif request.format == "text":
            data = parse_exam_text(request.content)
        else:
            data = parse_csv_questions(request.content)
        if not isinstance(data, list) or not 1 <= len(data) <= 200:
            invalid("Nhập từ 1 đến 200 câu hỏi mỗi lần.")
        data = merge_questions_and_answers(
            data,
            getattr(request, "answer_format", None),
            getattr(request, "answer_content", None),
        )
        return [QuestionInput.model_validate(q).model_dump() for q in data]
    except (ValueError, KeyError, TypeError, ValidationError) as exc:
        # Do not echo potentially sensitive imported content in validation errors.
        invalid(
            "Tệp không đúng mẫu: cần đủ nội dung câu hỏi, lựa chọn và đáp án hợp lệ (kiểm tra cả File câu hỏi và File đáp án).",
            {"error_type": type(exc).__name__},
        )


async def change_question(db, access, target, request, question_id=None, action="save"):
    bank = await bank_for(db, access, target, request.expected_revision, editable=True)
    rows = await questions(db, bank.id)
    row = next((q for q in rows if q.id == question_id), None)
    if question_id and row is None:
        invalid("Không tìm thấy câu hỏi trong phiên bản này.")
    if action == "import":
        await add_questions(db, bank, parse_import(request))
    elif action == "review":
        QuestionInput.model_validate(row.content)
        row.status = request.status
        row.reviewer = access.user.id if request.status == "approved" else None
        row.reviewed_at = datetime.now(timezone.utc) if row.reviewer else None
        bank.revision += 1
    elif action == "delete":
        await db.delete(row)
        bank.revision += 1
    elif row:
        content = request.question.model_dump()
        if {c["id"] for c in content["choices"]} != {c["id"] for c in row.content["choices"]}:
            invalid("Giữ nguyên ID của bốn lựa chọn khi sửa câu hỏi.")
        validate_distinct(
            [q.content for q in rows if q.id != row.id and q.status != "retired"], [content]
        )
        row.content, row.status, row.reviewer, row.reviewed_at = content, "draft", None, None
        bank.revision += 1
    else:
        await add_questions(db, bank, [request.question.model_dump()])
    audit(db, access.user.id, "question." + action, bank.id, None, {"question_id": question_id})
    await db.commit()
    return await view(db, access, target)


async def publish_bank_row(db, actor_id, bank, policy):
    approved = [q for q in await questions(db, bank.id) if q.status == "approved"]
    need = required_questions(bank.lesson_id, policy)
    if len(approved) < need:
        raise LMSError(
            409,
            "BANK_NOT_READY",
            "Cần ít nhất 1 câu hỏi đã được giảng viên duyệt.",
            {"approved_count": len(approved), "required": need},
        )
    validate_distinct([], [q.content for q in approved])
    for q in approved:
        QuestionInput.model_validate(q.content)
        if not q.reviewer:
            invalid("Câu đã duyệt cần người duyệt.")
    bank.status, bank.published_by = "published", actor_id
    bank.revision += 1
    policy.bank_id = bank.id
    policy.revision += 1
    audit(db, actor_id, "bank.publish", bank.id, None, {"version": bank.version})
    await db.flush()


async def publish(db, access, target, request):
    bank = await bank_for(db, access, target, request.expected_revision, editable=True)
    policy = await db.get(QuizPolicy, (access.classroom.id, bank.lesson_id))
    await publish_bank_row(db, access.user.id, bank, policy)
    await db.commit()
    return await view(db, access, target)


async def quiz_index_for(db, course_version_id, lab_id, lesson_id):
    if is_labtest(lesson_id):
        return 0
    quiz_ids = list(
        (
            await db.execute(
                select(Lesson.id)
                .where(
                    Lesson.course_version_id == course_version_id,
                    Lesson.lab_id == lab_id,
                    Lesson.type == "quiz",
                )
                .order_by(Lesson.order_no, Lesson.id)
            )
        ).scalars()
    )
    return quiz_ids.index(lesson_id) if lesson_id in quiz_ids else 0


async def load_samples(db, access, target, request):
    bank = await bank_for(db, access, target, request.expected_revision, editable=True)
    quiz_index = await quiz_index_for(db, bank.course_version_id, bank.lab_id, bank.lesson_id)
    samples = sample_questions_for(bank.lab_id, bank.lesson_id, quiz_index=quiz_index)
    rows = await questions(db, bank.id)
    active_prompts = {normalized(q.content["prompt"]) for q in rows if q.status != "retired"}
    to_add = []
    for sample in samples:
        prompt = normalized(sample["prompt"])
        if prompt in active_prompts:
            continue
        active_prompts.add(prompt)
        to_add.append(sample)
    if len(rows) + len(to_add) > 500:
        invalid("Mỗi phiên bản ngân hàng chứa tối đa 500 câu nháp.")
    if to_add:
        seeded_at = datetime.now(timezone.utc)
        await _bulk_insert_question_versions(
            db,
            [
                {
                    "id": uid(),
                    "bank_id": bank.id,
                    "question_id": uid(),
                    "content": sample,
                    "status": "approved",
                    "reviewer": access.user.id,
                    "reviewed_at": seeded_at,
                }
                for sample in to_add
            ],
        )
        bank.revision += 1
        audit(
            db,
            access.user.id,
            "question.load_samples",
            bank.id,
            None,
            {"added": len(to_add)},
        )
        await db.commit()
    return {**await view(db, access, target), "added_count": len(to_add)}


async def fork(db, access, target, request):
    bank = await bank_for(db, access, target, request.expected_revision)
    if bank.status != "published":
        invalid("Đã có phiên bản nháp đang soạn.")
    rows = await questions(db, bank.id)
    retired = next((q for q in rows if q.question_id == request.retire_question_id), None)
    if request.retire_question_id and retired is None:
        invalid("Không tìm thấy câu cần thu hồi.")
    new = QuestionBank(
        id=uid(),
        class_id=bank.class_id,
        course_version_id=bank.course_version_id,
        lab_id=bank.lab_id,
        lesson_id=bank.lesson_id,
        version=bank.version + 1,
        created_by=access.user.id,
        reason=request.reason,
    )
    db.add(new)
    await db.flush()
    for q in rows:
        db.add(
            QuestionVersion(
                id=uid(),
                bank_id=new.id,
                question_id=q.question_id,
                content=deepcopy(q.content),
                status="retired" if q == retired else q.status,
                reviewer=None if q == retired else q.reviewer,
                reviewed_at=None if q == retired else q.reviewed_at,
            )
        )
    affected = 0
    if retired:
        affected = (
            await db.execute(
                select(func.count())
                .select_from(QuizAttemptItem)
                .where(QuizAttemptItem.question_version_id == retired.id)
            )
        ).scalar_one()
        # Stop new attempts until a corrected edition is published. Existing snapshots remain valid.
        policy = await db.get(QuizPolicy, (bank.class_id, bank.lesson_id))
        policy.bank_id = None
        policy.revision += 1
    audit(
        db,
        access.user.id,
        "bank.fork",
        new.id,
        None,
        {
            "reason": request.reason,
            "retired_question_id": request.retire_question_id,
            "affected_attempts": affected,
        },
    )
    await db.commit()
    return {**await view(db, access, target), "affected_attempts": affected}


async def update_policy(db, access, target, request):
    key = lesson_key(target)
    policy = await db.get(QuizPolicy, (access.classroom.id, key))
    if not policy or policy.revision != request.expected_revision:
        conflict()
    for field, value in request.model_dump(exclude={"expected_revision"}).items():
        setattr(policy, field, value)
    policy.revision += 1
    audit(
        db,
        access.user.id,
        "quiz.policy",
        f"{access.classroom.id}:{key}",
        None,
        policy_json(policy),
    )
    await db.commit()
    return await view(db, access, target)
