"""
routers/auth.py
───────────────
Authentication API Endpoints:
  POST /api/auth/register — Đăng ký tài khoản mới
  POST /api/auth/login    — Đăng nhập nhận JWT Token
  GET  /api/auth/me       — Lấy thông tin user hiện tại qua JWT Header
  POST /api/auth/logout   — Đăng xuất (thu hồi token vào PostgreSQL, cache trên Redis)
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.google_auth import verify_google_credential
from app.core.rate_limit import client_ip
from app.db import get_db
from app.models.tables import User
from app.schemas.auth import (
    AuthTokenResponse,
    ChangePasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from app.services.auth import AuthService, get_required_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


@router.get("/google/config")
async def google_config():
    return {"client_id": get_settings().google_client_id}


@router.post("/google", response_model=AuthTokenResponse)
async def google_login(req: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    claims = await verify_google_credential(req.credential)
    try:
        return await AuthService(db).login_google(claims)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/register", response_model=AuthTokenResponse, status_code=201)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Đăng ký tài khoản người dùng mới."""
    logger.info(f"[Auth] Attempting to register new user with email: {req.email.strip().lower()}")
    try:
        return await AuthService(db).register_user(req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=AuthTokenResponse)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Đăng nhập với email và mật khẩu."""
    logger.info(f"[Auth] Attempting login for email: {req.email.strip().lower()}")
    try:
        return await AuthService(db).login_user(req, client_ip(request.scope))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    """Lấy thông tin tài khoản đang đăng nhập."""
    logger.info(f"[Auth] Fetching current user info for user_id={current_user.id}")
    return await AuthService(db).get_me(current_user)


@router.patch("/password", status_code=200)
async def change_password(
    req: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    """Đổi mật khẩu tài khoản đang đăng nhập."""
    try:
        await AuthService(db).change_password(current_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"message": "Đã đổi mật khẩu thành công."}


@router.post("/logout", status_code=200)
async def logout(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_required_user),
):
    logger.info(f"[Auth] Logging out user_id={current_user.id}")
    """Đăng xuất — thu hồi JWT token hiện tại vào PostgreSQL."""
    await AuthService(db).logout_user(token)
    return {"message": "Đã đăng xuất thành công."}
