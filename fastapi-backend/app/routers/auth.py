"""
routers/auth.py
───────────────
Authentication API Endpoints:
  POST /api/auth/register — Đăng ký tài khoản mới
  POST /api/auth/login    — Đăng nhập nhận JWT Token
  GET  /api/auth/me       — Lấy thông tin user hiện tại qua JWT Header
  POST /api/auth/logout   — Đăng xuất (thu hồi token vào PostgreSQL, cache trên Redis)
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordBearer
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.google_auth import verify_google_credential
from app.core.logging import mask_email
from app.core.rate_limit import client_ip
from app.db import get_db
from app.models.tables import User
from app.schemas.auth import (
    AuthTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleLoginRequest,
    LoginRequest,
    PasswordResetConfigResponse,
    RegisterRequest,
    RegisterResponse,
    ResendVerificationRequest,
    ResetPasswordConfirmRequest,
    ResetPasswordValidateResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services import email_verification
from app.services.auth import AuthService, get_required_user
from app.services.password_reset import (
    confirm_password_reset,
    request_password_reset,
    validate_reset_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


@router.get("/google/config")
async def google_config():
    return {"client_id": get_settings().google_client_id}


@router.post("/google", response_model=AuthTokenResponse)
async def google_login(req: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    logger.info("[Auth] Attempting Google Sign-In")
    claims = await verify_google_credential(req.credential)
    try:
        result = await AuthService(db).login_google(claims)
    except ValueError as exc:
        logger.warning(
            "[Auth] Google Sign-In rejected for {}: {}",
            mask_email(claims.get("email", "")),
            str(exc),
        )
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    logger.info(f"[Auth] ✅ Google Sign-In succeeded for {mask_email(result.user.email)}")
    return result


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Đăng ký tài khoản người dùng mới (cần xác minh email khi hệ thống đã cấu hình SMTP)."""
    logger.info(f"[Auth] Attempting to register new user with email: {mask_email(req.email)}")
    try:
        return await AuthService(db).register_user(req, request.headers.get("origin"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/verify-email", status_code=200)
async def verify_email(req: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """Xác minh email bằng token dùng một lần trong thư."""
    await email_verification.verify_token(db, req.token)
    return {"message": "Đã xác minh email. Bạn có thể đăng nhập ngay bây giờ."}


@router.post("/resend-verification", status_code=200)
async def resend_verification(
    req: ResendVerificationRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    """Gửi lại thư xác minh; phản hồi luôn giống nhau dù email có tồn tại hay không."""
    return await email_verification.resend(db, str(req.email), request.headers.get("origin"))


@router.post("/login", response_model=AuthTokenResponse)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Đăng nhập với email và mật khẩu."""
    logger.info(f"[Auth] Attempting login for email: {mask_email(req.email)}")
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


@router.get("/password-reset/config", response_model=PasswordResetConfigResponse)
async def password_reset_config():
    settings = get_settings()
    return {
        "smtp_enabled": settings.smtp_configured,
        "token_ttl_minutes": settings.password_reset_token_ttl_minutes,
    }


@router.post("/forgot-password", response_model=ForgotPasswordResponse, status_code=200)
async def forgot_password(
    req: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Gửi yêu cầu đặt lại mật khẩu qua email (khi có SMTP) hoặc hàng chờ quản trị viên."""
    return await request_password_reset(
        db,
        str(req.email),
        client_ip(request.scope),
        request.headers.get("origin"),
    )


@router.get("/reset-password/validate", response_model=ResetPasswordValidateResponse)
async def check_reset_token(
    token: str = Query(..., min_length=16, max_length=512),
    db: AsyncSession = Depends(get_db),
):
    await validate_reset_token(db, token)
    return {"valid": True}


@router.post("/reset-password", status_code=200)
async def reset_password(
    req: ResetPasswordConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    """Đặt lại mật khẩu mới bằng token dùng một lần."""
    await confirm_password_reset(db, req.token, req.new_password)
    return {"message": "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới."}
