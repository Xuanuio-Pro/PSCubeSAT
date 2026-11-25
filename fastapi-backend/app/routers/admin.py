from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import client_ip
from app.db import get_db
from app.models.tables import AccountStatus, PasswordResetToken, User, UserRole
from app.schemas.auth import AuthTokenResponse, LoginRequest, RegisterRequest
from app.schemas.classes import (
    AdminUserPatch,
    AdminUserResponse,
    AdminUserUpdate,
    ClassModeInput,
    ClassResponse,
    PasswordResetLinkResponse,
    PasswordResetResponse,
    UserPage,
)
from app.services.auth import AuthService
from app.services.classes import (
    delete_user,
    paginate,
    reset_user_password,
    search_filter,
    set_class_mode,
    update_user,
)
from app.services.password_reset import issue_admin_reset_link, pending_reset_map
from app.services.permissions import require_lms_enabled, require_system_role
from app.services.reports import admin_dashboard

admin_user = require_system_role(UserRole.admin)
router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
)


@router.post("/signup", response_model=AuthTokenResponse, status_code=201)
async def admin_signup(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await AuthService(db).register_first_admin(req)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/login", response_model=AuthTokenResponse)
async def admin_login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        return await AuthService(db).login_user(
            req, client_ip(request.scope), require_role=UserRole.admin
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@router.get("/users", response_model=UserPage)
async def list_users(
    search: str = Query(default="", max_length=200),
    role: UserRole | None = None,
    status: AccountStatus | None = None,
    pending_reset: bool | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _actor: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(User).where(User.deleted_at.is_(None))
    if search.strip():
        query = query.where(search_filter([User.email, User.full_name], search.strip()))
    if role:
        query = query.where(User.role == role)
    if status:
        query = query.where(User.status == status)
    if pending_reset is True:
        now = datetime.now(timezone.utc)
        pending_ids = select(PasswordResetToken.user_id).where(
            PasswordResetToken.status == "pending",
            PasswordResetToken.expires_at > now,
        )
        query = query.where(User.id.in_(pending_ids))
    rows, total = await paginate(db, query.order_by(User.id), page, page_size)
    users = [row[0] for row in rows]
    pending_map = await pending_reset_map(db, [u.id for u in users])
    return {
        "items": [
            AdminUserResponse.model_validate(u).model_copy(
                update={
                    "pending_password_reset": u.id in pending_map,
                    "reset_requested_at": pending_map.get(u.id),
                }
            )
            for u in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.patch("/users", response_model=AdminUserResponse)
async def patch_user(
    request: AdminUserUpdate,
    actor: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_user(
        db, actor, request.user_id, request.model_dump(exclude_unset=True, exclude={"user_id"})
    )


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def patch_user_by_id(
    user_id: int,
    request: AdminUserPatch,
    actor: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
):
    return await update_user(db, actor, user_id, request.model_dump(exclude_unset=True))


@router.delete("/users/{user_id}", status_code=200)
async def remove_user(
    user_id: int,
    actor: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa mềm tài khoản: giữ dữ liệu học tập, chặn đăng nhập và gỡ khỏi mọi lớp."""
    return await delete_user(db, actor, user_id)


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetResponse)
async def reset_password(
    user_id: int,
    actor: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Cấp mật khẩu tạm cho người dùng quên mật khẩu; chỉ trả về một lần cho quản trị viên."""
    return await reset_user_password(db, actor, user_id)


@router.post("/users/{user_id}/reset-link", response_model=PasswordResetLinkResponse)
async def issue_reset_link(
    user_id: int,
    request: Request,
    actor: User = Depends(admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Cấp liên kết đặt lại mật khẩu dùng một lần cho người dùng; chỉ trả về một lần cho quản trị viên."""
    return await issue_admin_reset_link(db, actor, user_id, request.headers.get("origin"))


@router.get("/dashboard")
async def dashboard(actor: User = Depends(admin_user), db: AsyncSession = Depends(get_db)):
    return await admin_dashboard(db, actor)


@router.patch("/classes/{class_id}/lms-mode", response_model=ClassResponse)
async def class_mode(
    class_id: int,
    request: ClassModeInput,
    actor: User = Depends(admin_user),
    _: None = Depends(require_lms_enabled),
    db: AsyncSession = Depends(get_db),
):
    return await set_class_mode(db, actor, class_id, request)
