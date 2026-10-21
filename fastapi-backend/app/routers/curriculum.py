"""Authenticated, pinned classroom examples. Preserve a student's saved source."""

import json
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.services.auth import get_required_user

router = APIRouter(
    prefix="/api/curriculum", tags=["curriculum"], dependencies=[Depends(get_required_user)]
)
SOURCE_DIR = Path(__file__).resolve().parents[1] / "firmware/curriculum"


@lru_cache(maxsize=1)
def catalog():
    return json.loads((SOURCE_DIR / "catalog.json").read_text(encoding="utf-8"))


@router.get("/exercises")
def exercises():
    return catalog()


@router.get("/exercises/{exercise_id}/source")
def source(exercise_id: str):
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
