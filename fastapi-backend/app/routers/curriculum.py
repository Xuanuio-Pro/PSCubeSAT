"""Authenticated, pinned classroom examples. Preserve a student's saved source."""

import hashlib
import json
import secrets
from copy import deepcopy
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.lms_errors import LMSError
from app.db import get_db
from app.models.tables import User
from app.schemas.quiz import (
    normalize_multiple_choice_answer,
    normalize_short_answer,
    normalize_true_false_answer,
    normalized,
)
from app.services.auth import get_required_user
from app.services.course_configuration import configuration, preview_curriculum
from app.services.curriculum_access import source_access
from app.services.curriculum_seed import read_seed
from app.services.exam_import import shuffle_true_false_choices
from app.services.permissions import legacy_restricted, require_class_member
from app.services.sample_questions import default_policy, sample_questions_for

router = APIRouter(
    prefix="/api/curriculum", tags=["curriculum"], dependencies=[Depends(get_required_user)]
)
SOURCE_DIR = Path(__file__).resolve().parents[1] / "firmware/curriculum"


@lru_cache(maxsize=1)
def catalog():
    return json.loads((SOURCE_DIR / "catalog.json").read_text(encoding="utf-8"))


@router.get("/exercises")
async def exercises(
    class_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_required_user),
):
    if class_id is not None and get_settings().lms_class_mode or await legacy_restricted(db, user):
        if class_id is not None:
            access = await require_class_member()(class_id=class_id, user=user, db=db)
            config = await configuration(db, access, student_view=True)
        else:
            config = await preview_curriculum(db)
        ids = set()
        for lab in config["labs"]:
            for item in lab["lessons"]:
                unlocked = (
                    lab.get("access", "available") == "available"
                    and item.get("access", "available") == "available"
                )
                if unlocked or item.get("progress", {}).get("status") in ("completed", "waived"):
                    ids.add(item["id"])
                    for ex in (item.get("content") or {}).get("exercises") or []:
                        if ex.get("id"):
                            ids.add(ex["id"])
        allowed = [item for item in catalog()["exercises"] if item["id"] in ids]
        return {**catalog(), "exercises": allowed}
    return catalog()


@router.get("/exercises/{exercise_id}/source")
async def source(
    exercise_id: str,
    class_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_required_user),
):
    if class_id is not None and get_settings().lms_class_mode or await legacy_restricted(db, user):
        await source_access(db, user, class_id, exercise_id)
    exercise = next((item for item in catalog()["exercises"] if item["id"] == exercise_id), None)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Unknown curriculum exercise")
    # Paths originate only from the checked-in allowlist, never from a user path.
    path = (SOURCE_DIR / exercise["file"]).resolve()
    if path.parent != SOURCE_DIR.resolve() or not path.is_file():
        raise HTTPException(status_code=404, detail="Curriculum source unavailable")
    return Response(
        path.read_text(encoding="utf-8-sig"),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{exercise_id}.ino"',
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/legacy")
async def legacy(db: AsyncSession = Depends(get_db), user: User = Depends(get_required_user)):
    if await legacy_restricted(db, user):
        raise LMSError(403, "MEMBERSHIP_REQUIRED", "Hãy mở chương trình học từ lớp của bạn.")
    return read_seed()["legacy"]


class LegacyQuizGradeRequest(BaseModel):
    question_ids: list[str] = Field(min_length=1, max_length=200)
    answers: dict[str, str] = Field(default_factory=dict)


def _legacy_question_id(prompt: str) -> str:
    return hashlib.sha256(normalized(prompt).encode("utf-8")).hexdigest()[:16]


def _legacy_quiz_meta(lab_id: int, lesson_id: str) -> tuple[dict, str, int]:
    labs = read_seed()["labs"]
    lab = next((item for item in labs if item["id"] == lab_id), None)
    if lab is None:
        raise HTTPException(status_code=404, detail="Unknown lab")
    lessons = lab.get("lessons", [])
    quiz_index = 0
    for item in lessons:
        if item["id"] == lesson_id:
            if item["type"] not in ("quiz", "labtest"):
                raise HTTPException(status_code=404, detail="Lesson is not a quiz")
            kind = "labtest" if item["type"] == "labtest" else "quiz"
            return item, kind, quiz_index
        if item["type"] == "quiz":
            quiz_index += 1
    raise HTTPException(status_code=404, detail="Unknown quiz lesson")


def _strip_question(question: dict, qid: str) -> dict:
    return {
        "question_id": qid,
        "question_type": question.get("question_type", "single_choice"),
        "prompt": question["prompt"],
        "choices": [{"id": c["id"], "text": c["text"]} for c in question.get("choices", [])],
        "objective": question.get("objective", ""),
        "difficulty": question.get("difficulty", "medium"),
        "source_reference": question.get("source_reference", ""),
    }


def _grade_legacy_answer(question: dict, raw_answer: str | None) -> bool:
    if not raw_answer or not isinstance(raw_answer, str):
        return False
    q_type = question.get("question_type", "single_choice")
    correct = question["correct_choice_id"]
    valid_ids = [c["id"] for c in question.get("choices", [])]
    try:
        if q_type == "multiple_choice":
            return normalize_multiple_choice_answer(raw_answer, valid_ids) == correct
        if q_type == "true_false":
            return normalize_true_false_answer(raw_answer, valid_ids) == correct
        if q_type == "short_answer":
            return normalize_short_answer(raw_answer) == normalize_short_answer(correct)
        return raw_answer.strip() == correct
    except ValueError:
        return False


@router.get("/legacy/labs/{lab_id}/questions")
async def legacy_lab_questions(
    lab_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_required_user),
):
    if await legacy_restricted(db, user):
        raise LMSError(403, "MEMBERSHIP_REQUIRED", "Hãy mở chương trình học từ lớp của bạn.")
    labs = read_seed()["labs"]
    lab = next((item for item in labs if item["id"] == lab_id), None)
    if lab is None:
        raise HTTPException(status_code=404, detail="Unknown lab")
    summary = []
    quiz_index = 0
    for item in lab.get("lessons", []):
        if item["type"] not in ("quiz", "labtest"):
            continue
        kind = "labtest" if item["type"] == "labtest" else "quiz"
        pool = sample_questions_for(lab_id, item["id"], quiz_index=quiz_index)
        policy = default_policy(kind, len(pool))
        summary.append(
            {
                "lesson_id": item["id"],
                "type": item["type"],
                "title": item["title"],
                "total_pool": len(pool),
                "num_questions": policy["num_questions"],
                "pass_score": policy["pass_score"],
                "time_limit_minutes": policy["time_limit_minutes"],
            }
        )
        if item["type"] == "quiz":
            quiz_index += 1
    return {"lab_id": lab_id, "lessons": summary}


@router.get("/legacy/labs/{lab_id}/quiz/{lesson_id}")
async def legacy_draw_quiz(
    lab_id: int,
    lesson_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_required_user),
):
    if await legacy_restricted(db, user):
        raise LMSError(403, "MEMBERSHIP_REQUIRED", "Hãy mở chương trình học từ lớp của bạn.")
    lesson, kind, quiz_index = _legacy_quiz_meta(lab_id, lesson_id)
    pool = sample_questions_for(lab_id, lesson_id, quiz_index=quiz_index)
    if not pool:
        raise HTTPException(status_code=404, detail="Question bank unavailable")
    policy = default_policy(kind, len(pool))
    draw = min(int(policy["num_questions"] or len(pool)), len(pool))
    rng = secrets.SystemRandom()
    picked = rng.sample(pool, draw) if draw < len(pool) else list(pool)
    if draw == len(pool):
        rng.shuffle(picked)

    items = []
    for raw in picked:
        content = deepcopy(raw)
        q_type = content.get("question_type", "single_choice")
        if q_type == "true_false":
            content["choices"] = shuffle_true_false_choices(rng, content["choices"])
        elif q_type in ("single_choice", "multiple_choice"):
            rng.shuffle(content["choices"])
        items.append(_strip_question(content, _legacy_question_id(content["prompt"])))

    return {
        "lab_id": lab_id,
        "lesson_id": lesson_id,
        "title": lesson["title"],
        "kind": kind,
        "total_pool": len(pool),
        "num_questions": draw,
        "pass_score": min(int(policy["pass_score"]), draw),
        "time_limit_minutes": policy["time_limit_minutes"],
        "items": items,
    }


@router.post("/legacy/labs/{lab_id}/quiz/{lesson_id}/grade")
async def legacy_grade_quiz(
    lab_id: int,
    lesson_id: str,
    request: LegacyQuizGradeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_required_user),
):
    if await legacy_restricted(db, user):
        raise LMSError(403, "MEMBERSHIP_REQUIRED", "Hãy mở chương trình học từ lớp của bạn.")
    _lesson, kind, quiz_index = _legacy_quiz_meta(lab_id, lesson_id)
    pool = sample_questions_for(lab_id, lesson_id, quiz_index=quiz_index)
    by_qid = {_legacy_question_id(q["prompt"]): q for q in pool}

    seen: set[str] = set()
    ordered_ids: list[str] = []
    for qid in request.question_ids:
        if qid not in by_qid:
            raise HTTPException(status_code=400, detail="Unknown question_id")
        if qid not in seen:
            seen.add(qid)
            ordered_ids.append(qid)

    policy = default_policy(kind, len(pool))
    total = len(ordered_ids)
    pass_score = min(int(policy["pass_score"]), total)
    score = 0
    graded_items = []
    for qid in ordered_ids:
        question = by_qid[qid]
        selected = request.answers.get(qid, "")
        is_correct = _grade_legacy_answer(question, selected)
        if is_correct:
            score += 1
        graded_items.append(
            {
                "question_id": qid,
                "question_type": question.get("question_type", "single_choice"),
                "prompt": question["prompt"],
                "choices": question.get("choices", []),
                "selected": selected,
                "correct_choice_id": question["correct_choice_id"],
                "is_correct": is_correct,
                "explanation": question.get("explanation", ""),
                "choice_explanations": question.get("choice_explanations", {}),
                "source_reference": question.get("source_reference", ""),
            }
        )

    return {
        "lab_id": lab_id,
        "lesson_id": lesson_id,
        "kind": kind,
        "score": score,
        "total": total,
        "pass_score": pass_score,
        "passed": score >= pass_score,
        "items": graded_items,
    }
