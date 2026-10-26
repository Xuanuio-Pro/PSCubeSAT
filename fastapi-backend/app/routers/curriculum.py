"""Authenticated, pinned classroom examples. Preserve a student's saved source."""

import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.lms_errors import LMSError
from app.db import get_db
from app.models.tables import User
from app.services.auth import get_required_user
from app.services.course_configuration import configuration, preview_curriculum
from app.services.curriculum_access import source_access
from app.services.curriculum_seed import read_seed
from app.services.permissions import legacy_restricted, require_class_member

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
        ids = {
            item["id"]
            for lab in config["labs"]
            for item in lab["lessons"]
            if lab.get("access", "available") == "available"
            or item.get("progress", {}).get("status") in ("completed", "waived")
        }
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
