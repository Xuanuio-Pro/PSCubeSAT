"""Teacher-only authoring; published editions never change in place."""

import csv
import io
import json
from copy import deepcopy
from datetime import datetime, timezone
from difflib import SequenceMatcher
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import func, select

from app.core.lms_errors import LMSError
from app.models.quiz import QuestionBank, QuestionVersion, QuizAttemptItem, QuizPolicy
from app.schemas.quiz import QuestionInput, normalized
from app.services.classes import audit


def uid():
    return str(uuid4())


def conflict():
    raise LMSError(409, "VERSION_CONFLICT", "Dữ liệu đã thay đổi. Hãy tải lại trước khi lưu.")


def invalid(message, details=None):
    raise LMSError(422, "CONFIG_INVALID", message, details or {})


async def seed_banks(db, access, course_id):
    incompatible = (
        await db.execute(
            select(QuestionBank.id)
            .where(
                QuestionBank.class_id == access.classroom.id,
                QuestionBank.course_version_id != course_id,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    if incompatible:
        invalid("Lớp đã có ngân hàng cho phiên bản giáo trình khác. Hãy tạo lớp mới.")
    existing = set(
        (
            await db.execute(
                select(QuestionBank.lab_id).where(QuestionBank.class_id == access.classroom.id)
            )
        ).scalars()
    )
    for lab_id in range(9):
        if lab_id not in existing:
            db.add(
                QuestionBank(
                    id=uid(),
                    class_id=access.classroom.id,
                    course_version_id=course_id,
                    lab_id=lab_id,
                    version=1,
                    created_by=access.user.id,
                )
            )
        if await db.get(QuizPolicy, (access.classroom.id, lab_id)) is None:
            db.add(QuizPolicy(class_id=access.classroom.id, lab_id=lab_id))
    await db.flush()


async def bank_for(db, access, lab_id, expected=None, *, editable=False):
    bank = (
        await db.execute(
            select(QuestionBank)
            .where(QuestionBank.class_id == access.classroom.id, QuestionBank.lab_id == lab_id)
            .order_by(QuestionBank.version.desc())
            .limit(1)
            .execution_options(populate_existing=True)
        )
    ).scalar_one_or_none()
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
            "score_rule",
            "reveal_policy",
        )
    }
    result["closes_at"] = policy.closes_at.isoformat() if policy.closes_at else None
    return result


async def view(db, access, lab_id):
    from app.services.question_generation import available

    bank = await bank_for(db, access, lab_id)
    rows = await questions(db, bank.id)
    policy = await db.get(QuizPolicy, (access.classroom.id, lab_id))
    return {
        "id": bank.id,
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
    prompts = [normalized(q["prompt"]) for q in existing]
    for index, question in enumerate(incoming):
        prompt = normalized(question["prompt"])
        if any(SequenceMatcher(None, prompt, old).ratio() >= 0.9 for old in prompts):
            invalid(
                "Có câu hỏi trùng hoặc gần trùng; hãy sửa nội dung trước khi lưu.",
                {"row": index + 1, "field": "prompt"},
            )
        prompts.append(prompt)


async def add_questions(db, bank, content):
    rows = await questions(db, bank.id)
    if len(rows) + len(content) > 200:
        invalid("Mỗi phiên bản ngân hàng chứa tối đa 200 câu nháp.")
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
        else:
            data = []
            for row in csv.DictReader(io.StringIO(request.content.lstrip("\ufeff"))):
                data.append(
                    {
                        key: row.get(key, "")
                        for key in (
                            "prompt",
                            "correct_choice_id",
                            "explanation",
                            "objective",
                            "difficulty",
                            "source_reference",
                        )
                    }
                    | {
                        "choices": [
                            {
                                "id": row.get(f"choice_{i}_id", ""),
                                "text": row.get(f"choice_{i}_text", ""),
                            }
                            for i in range(1, 5)
                        ]
                    }
                )
        if not isinstance(data, list) or not 1 <= len(data) <= 200:
            invalid("Nhập từ 1 đến 200 câu hỏi mỗi lần.")
        return [QuestionInput.model_validate(q).model_dump() for q in data]
    except (ValueError, KeyError, TypeError, ValidationError) as exc:
        # Do not echo potentially sensitive imported content in validation errors.
        invalid(
            "Tệp không đúng mẫu: cần 4 lựa chọn khác nhau, đáp án hợp lệ và đầy đủ nội dung.",
            {"error_type": type(exc).__name__},
        )


async def change_question(db, access, lab_id, request, question_id=None, action="save"):
    bank = await bank_for(db, access, lab_id, request.expected_revision, editable=True)
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
    return await view(db, access, lab_id)


async def publish(db, access, lab_id, request):
    bank = await bank_for(db, access, lab_id, request.expected_revision, editable=True)
    approved = [q for q in await questions(db, bank.id) if q.status == "approved"]
    if len(approved) != 20:
        raise LMSError(
            409,
            "BANK_NOT_READY",
            "Cần đúng 20 câu đã được giảng viên duyệt.",
            {"approved_count": len(approved), "required": 20},
        )
    validate_distinct([], [q.content for q in approved])
    for q in approved:
        QuestionInput.model_validate(q.content)
        if not q.reviewer:
            invalid("Câu đã duyệt cần người duyệt.")
    bank.status, bank.published_by = "published", access.user.id
    bank.revision += 1
    policy = await db.get(QuizPolicy, (access.classroom.id, lab_id))
    policy.bank_id = bank.id
    policy.revision += 1
    audit(db, access.user.id, "bank.publish", bank.id, None, {"version": bank.version})
    await db.commit()
    return await view(db, access, lab_id)


async def fork(db, access, lab_id, request):
    bank = await bank_for(db, access, lab_id, request.expected_revision)
    if bank.status != "published":
        invalid("Đã có phiên bản nháp đang soạn.")
    rows = await questions(db, bank.id)
    target = next((q for q in rows if q.question_id == request.retire_question_id), None)
    if request.retire_question_id and target is None:
        invalid("Không tìm thấy câu cần thu hồi.")
    new = QuestionBank(
        id=uid(),
        class_id=bank.class_id,
        course_version_id=bank.course_version_id,
        lab_id=lab_id,
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
                status="retired" if q == target else q.status,
                reviewer=None if q == target else q.reviewer,
                reviewed_at=None if q == target else q.reviewed_at,
            )
        )
    affected = 0
    if target:
        affected = (
            await db.execute(
                select(func.count())
                .select_from(QuizAttemptItem)
                .where(QuizAttemptItem.question_version_id == target.id)
            )
        ).scalar_one()
        # Stop new attempts until a corrected edition is published. Existing snapshots remain valid.
        policy = await db.get(QuizPolicy, (bank.class_id, lab_id))
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
    return {**await view(db, access, lab_id), "affected_attempts": affected}


async def update_policy(db, access, lab_id, request):
    policy = await db.get(QuizPolicy, (access.classroom.id, lab_id))
    if not policy or policy.revision != request.expected_revision:
        conflict()
    for key, value in request.model_dump(exclude={"expected_revision"}).items():
        setattr(policy, key, value)
    policy.revision += 1
    audit(
        db,
        access.user.id,
        "quiz.policy",
        f"{access.classroom.id}:{lab_id}",
        None,
        policy_json(policy),
    )
    await db.commit()
    return await view(db, access, lab_id)
