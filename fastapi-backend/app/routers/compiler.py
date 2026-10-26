import asyncio
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from loguru import logger
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.lms_errors import LMSError
from app.db import get_db
from app.models.tables import User
from app.services import artifacts, compiler_svc
from app.services.auth import get_current_user, get_required_user
from app.services.curriculum_access import class_lesson
from app.services.lab1 import BOARD_PROFILES, get_template
from app.services.permissions import legacy_restricted
from app.services.progress import ProgressService

router = APIRouter(prefix="/api", tags=["compiler"], dependencies=[Depends(get_required_user)])


class CompileRequest(BaseModel):
    code: str = Field(min_length=1, max_length=262144)
    board: Literal["esp32s3", "esp32"] = "esp32s3"
    lab_id: Optional[int] = Field(default=None, ge=0, le=8)
    include_binary: bool = True
    class_id: Optional[int] = Field(default=None, gt=0)
    lesson_id: Optional[str] = Field(default=None, max_length=200)

    @field_validator("code")
    @classmethod
    def validate_code(cls, code: str) -> str:
        if not code.strip() or len(code.encode("utf-8")) > 262144:
            raise ValueError("Mã nguồn phải khác rỗng và không vượt quá 256 KiB UTF-8.")
        return code


@router.get("/boards")
async def list_boards():
    return {
        "boards": [
            {"board": key, **profile, "monitor_baud_rate": 115200}
            for key, profile in BOARD_PROFILES.items()
        ]
    }


@router.get("/labs/1/template")
async def lab1_template(
    board: Literal["esp32s3", "esp32"] = Query(default="esp32s3"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    if await legacy_restricted(db, current_user):
        raise LMSError(403, "MEMBERSHIP_REQUIRED", "Tải mã mẫu từ bài thực hành trong lớp.")
    return get_template(board)


@router.post("/compile")
async def compile_code(
    req: CompileRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Build unchanged source and snapshot all images required for a first flash."""
    if request.headers.get("Authorization") and current_user is None:
        raise HTTPException(
            status_code=401,
            detail="Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    owner_id = current_user.id if current_user else None
    # Class context is enforced when given, and always for students of a pilot class.
    class_build = get_settings().lms_class_mode and (
        req.class_id is not None
        or req.lesson_id is not None
        or await legacy_restricted(db, current_user)
    )
    if class_build:
        if not req.class_id or not req.lesson_id:
            raise LMSError(
                403, "MEMBERSHIP_REQUIRED", "Biên dịch yêu cầu bài thực hành đang bật trong lớp."
            )
        lesson = await class_lesson(db, current_user, req.class_id, req.lesson_id)
        if lesson["type"] != "practice" or lesson["content"].get("mode") == "exploration":
            raise LMSError(403, "LESSON_DISABLED", "Bài này không có chức năng biên dịch.")
        if req.lab_id != lesson["lab_id"] or lesson["content"].get("board", req.board) != req.board:
            raise LMSError(
                422, "CONFIG_INVALID", "Lab hoặc bo mạch không khớp cấu hình bài thực hành."
            )
    if owner_id is not None:
        # End the auth read transaction rather than retaining a DB connection for a long build.
        await db.rollback()
    result = await compiler_svc.compile_code(
        req.code,
        req.board,
        owner_id=owner_id,
        lab_id=req.lab_id,
        include_binary=req.include_binary,
    )

    if class_build:
        user = await get_current_user(
            token=request.headers.get("Authorization", "").partition(" ")[2], db=db
        )
        if user is None:
            raise HTTPException(401, "Phiên đăng nhập không còn hợp lệ.")
        await class_lesson(db, user, req.class_id, req.lesson_id)
    if (
        not class_build
        and result.get("success")
        and owner_id is not None
        and req.lab_id is not None
    ):
        try:
            await ProgressService(db).mark_compiled(owner_id, req.lab_id)
            result["progress_saved"] = True
        except Exception as exc:
            try:
                await db.rollback()
            except Exception:
                logger.warning("[Compiler] Không thể rollback phiên lưu progress")
            # No diagnosed traceback: endpoint locals can contain user source/secrets.
            logger.warning(f"[Compiler] Chưa lưu được progress: {type(exc).__name__}")
            result["progress_saved"] = False
            result["warning"] = "Firmware đã sẵn sàng; chưa lưu được tiến độ học."

    return result


def _artifact_error(exc: Exception) -> HTTPException:
    if isinstance(exc, artifacts.ArtifactExpired):
        return HTTPException(status_code=410, detail="Artifact đã hết hạn. Vui lòng biên dịch lại.")
    return HTTPException(status_code=404, detail="Không tìm thấy artifact.")


@router.get("/artifacts/{artifact_id}")
async def artifact_manifest(
    artifact_id: str, current_user: Optional[User] = Depends(get_current_user)
):
    try:
        info = await asyncio.to_thread(
            artifacts.get_artifact, artifact_id, current_user.id if current_user else None
        )
    except (artifacts.ArtifactNotFound, artifacts.ArtifactExpired) as exc:
        raise _artifact_error(exc) from exc
    return JSONResponse(info, headers={"Cache-Control": "no-store"})


@router.get("/artifacts/{artifact_id}/files/{filename}")
async def artifact_file(
    artifact_id: str, filename: str, current_user: Optional[User] = Depends(get_current_user)
):
    try:
        path, entry = await asyncio.to_thread(
            artifacts.get_file, artifact_id, filename, current_user.id if current_user else None
        )
    except (artifacts.ArtifactNotFound, artifacts.ArtifactExpired) as exc:
        raise _artifact_error(exc) from exc
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=entry["name"],
        headers={"Cache-Control": "no-store", "X-Content-SHA256": entry["sha256"]},
    )
