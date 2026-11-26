"""Password recovery tokens, admin reset requests, and email/link reset confirmation."""

import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Literal

from loguru import logger
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.lms_errors import LMSError
from app.core.logging import mask_email
from app.core.security import hash_password
from app.models.tables import AccountStatus, AuditLog, PasswordResetToken, User, UserRole
from app.services.email_service import resolve_frontend_base_url, send_password_reset_email

_PENDING_REQUEST_TTL_HOURS = 24
_SMTP_FAILURE_COOLDOWN_SECONDS = 60
_last_smtp_failure_at: datetime | None = None


def _is_smtp_failing() -> bool:
    global _last_smtp_failure_at
    if _last_smtp_failure_at is None:
        return False
    now = datetime.now(timezone.utc)
    if (now - _last_smtp_failure_at).total_seconds() < _SMTP_FAILURE_COOLDOWN_SECONDS:
        return True
    _last_smtp_failure_at = None
    return False


def _log_smtp_failure(context: str, email: str, exc: Exception) -> None:
    smtp_code = (
        getattr(exc, "smtp_code", None)
        if isinstance(exc, smtplib.SMTPResponseException)
        else None
    )
    logger.warning(
        "[PasswordReset] {} for {} ({}{})",
        context,
        mask_email(email),
        type(exc).__name__,
        f" code={smtp_code}" if smtp_code is not None else "",
    )


def _reset_smtp_failure_state() -> None:
    global _last_smtp_failure_at
    _last_smtp_failure_at = None


async def _queue_admin_request(
    db: AsyncSession, user_id: int, client_ip: str | None, now: datetime
) -> None:
    await revoke_open_resets(db, user_id)
    db.add(
        PasswordResetToken(
            user_id=user_id,
            token_hash=None,
            status="pending",
            source="admin_request",
            requested_ip=client_ip,
            expires_at=now + timedelta(hours=_PENDING_REQUEST_TTL_HOURS),
        )
    )
    await db.commit()


def hash_reset_token(raw_token: str) -> str:
    return sha256(raw_token.strip().encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


async def revoke_open_resets(
    db: AsyncSession, user_id: int, *, exclude_id: int | None = None
) -> int:
    stmt = update(PasswordResetToken).where(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.status.in_(("pending", "issued")),
    )
    if exclude_id is not None:
        stmt = stmt.where(PasswordResetToken.id != exclude_id)
    result = await db.execute(stmt.values(status="revoked"))
    return result.rowcount or 0


async def pending_reset_map(db: AsyncSession, user_ids: list[int]) -> dict[int, datetime]:
    if not user_ids:
        return {}
    now = datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(PasswordResetToken.user_id, func.max(PasswordResetToken.created_at))
            .where(
                PasswordResetToken.user_id.in_(user_ids),
                PasswordResetToken.status == "pending",
                PasswordResetToken.expires_at > now,
            )
            .group_by(PasswordResetToken.user_id)
        )
    ).all()
    return {user_id: requested_at for user_id, requested_at in rows}


async def request_password_reset(
    db: AsyncSession,
    email: str,
    client_ip: str | None,
    request_origin: str | None,
    channel: Literal["email", "admin"] = "email",
) -> dict[str, str]:
    """Create either an emailed reset token (SMTP enabled) or an admin-queued request.

    Always returns the same generic message per mode/outcome to avoid leaking account existence.
    """
    settings = get_settings()
    smtp_enabled = settings.smtp_configured
    use_email = smtp_enabled and channel != "admin"

    admin_message = (
        "Nếu email tồn tại và đang hoạt động, yêu cầu cấp lại mật khẩu đã được gửi tới quản trị viên."
    )
    email_message = (
        "Nếu email tồn tại và đang hoạt động, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu qua email. "
        "Nếu không nhận được thư sau vài phút, yêu cầu sẽ được chuyển tới quản trị viên."
    )
    smtp_error_message = (
        "Hệ thống gửi email tự động đang gặp sự cố. "
        "Nếu email tồn tại và đang hoạt động, yêu cầu cấp lại mật khẩu đã được chuyển tới quản trị viên."
    )

    email_clean = email.strip().lower()
    user = (
        await db.execute(
            select(User).where(func.lower(User.email) == email_clean, User.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if not use_email:
        if user is not None and user.status == AccountStatus.active and user.role != UserRole.admin:
            # Admin accounts cannot be reset by another admin in /admin/users.
            await _queue_admin_request(db, user.id, client_ip, now)
            logger.info("[PasswordReset] Queued admin reset request for user_id={}", user.id)
        return {"message": admin_message, "delivery_mode": "admin"}

    if _is_smtp_failing():
        # Still persist valid requests in DB during cooldown while keeping responses identical.
        if user is not None and user.status == AccountStatus.active and user.role != UserRole.admin:
            await _queue_admin_request(db, user.id, client_ip, now)
            logger.info(
                "[PasswordReset] SMTP recently failed; queued admin reset request for user_id={}",
                user.id,
            )
        return {"message": smtp_error_message, "delivery_mode": "smtp_error"}

    if user is None or user.status != AccountStatus.active:
        return {"message": email_message, "delivery_mode": "email"}

    await revoke_open_resets(db, user.id)
    raw_token = secrets.token_urlsafe(32)
    ttl_minutes = settings.password_reset_token_ttl_minutes
    row = PasswordResetToken(
        user_id=user.id,
        token_hash=hash_reset_token(raw_token),
        status="issued",
        source="email",
        requested_ip=client_ip,
        expires_at=now + timedelta(minutes=ttl_minutes),
    )
    db.add(row)
    await db.commit()
    reset_url = f"{resolve_frontend_base_url(request_origin)}/reset-password?token={raw_token}"
    try:
        await send_password_reset_email(user.email, reset_url, ttl_minutes)
        _reset_smtp_failure_state()
        logger.info("[PasswordReset] Sent reset email for {}", mask_email(user.email))
    except Exception as exc:
        global _last_smtp_failure_at
        _last_smtp_failure_at = now
        _log_smtp_failure("SMTP delivery failed; falling back to admin queue", user.email, exc)
        if user.role != UserRole.admin:
            row.status = "pending"
            row.token_hash = None
            row.source = "admin_request"
            row.expires_at = now + timedelta(hours=_PENDING_REQUEST_TTL_HOURS)
        else:
            row.status = "revoked"
        await db.commit()
        return {"message": smtp_error_message, "delivery_mode": "smtp_error"}

    return {"message": email_message, "delivery_mode": "email"}


def _invalid_token_error() -> LMSError:
    return LMSError(
        400,
        "CONFIG_INVALID",
        "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
    )


async def _load_valid_reset_token(
    db: AsyncSession, raw_token: str, *, for_update: bool = False
) -> tuple[PasswordResetToken, User, datetime]:
    token_clean = raw_token.strip()
    if len(token_clean) < 16:
        raise _invalid_token_error()
    token_stmt = select(PasswordResetToken).where(
        PasswordResetToken.token_hash == hash_reset_token(token_clean)
    )
    if for_update:
        token_stmt = token_stmt.with_for_update()
    row = (await db.execute(token_stmt)).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if (
        row is None
        or row.status != "issued"
        or row.used_at is not None
        or _as_utc(row.expires_at) <= now
    ):
        raise _invalid_token_error()
    user_stmt = select(User).where(
        User.id == row.user_id,
        User.deleted_at.is_(None),
        User.status == AccountStatus.active,
    )
    if for_update:
        user_stmt = user_stmt.with_for_update()
    user = (await db.execute(user_stmt)).scalar_one_or_none()
    if user is None:
        raise _invalid_token_error()
    return row, user, now


async def validate_reset_token(db: AsyncSession, raw_token: str) -> PasswordResetToken:
    row, _, _ = await _load_valid_reset_token(db, raw_token)
    return row


async def confirm_password_reset(db: AsyncSession, raw_token: str, new_password: str) -> User:
    from app.services.auth import clear_login_failures_for_email

    row, user, now = await _load_valid_reset_token(db, raw_token, for_update=True)

    user.password_hash = await run_in_threadpool(hash_password, new_password)
    user.updated_at = now
    if user.email_verified_at is None:
        user.email_verified_at = now  # the reset link proved ownership of the mailbox
    row.status = "used"
    row.used_at = now
    await revoke_open_resets(db, user.id, exclude_id=row.id)
    db.add(
        AuditLog(
            actor=user.id,
            action="user.password_reset_self",
            target=f"user:{user.id}",
            before=None,
            after={"source": row.source},
        )
    )
    await db.commit()
    clear_login_failures_for_email(user.email)
    logger.info("[PasswordReset] Password updated via reset token for user_id={}", user.id)
    return user


async def issue_admin_reset_link(
    db: AsyncSession,
    actor: User,
    user_id: int,
    request_origin: str | None = None,
) -> dict:
    from app.services.auth import clear_login_failures_for_email

    target = (
        await db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None)).with_for_update()
        )
    ).scalar_one_or_none()
    if target is None:
        raise LMSError(404, "CONFIG_INVALID", "Không tìm thấy tài khoản.")
    if target.id == actor.id or target.role == UserRole.admin:
        raise LMSError(
            403, "FORBIDDEN_ROLE", "Không thể cấp liên kết đặt lại cho tài khoản quản trị."
        )

    await revoke_open_resets(db, target.id)

    now = datetime.now(timezone.utc)
    ttl_minutes = get_settings().password_reset_token_ttl_minutes
    expires_at = now + timedelta(minutes=ttl_minutes)
    raw_token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=target.id,
            token_hash=hash_reset_token(raw_token),
            status="issued",
            source="admin_link",
            issued_by=actor.id,
            expires_at=expires_at,
        )
    )
    db.add(
        AuditLog(
            actor=actor.id,
            action="user.password_reset_link",
            target=f"user:{target.id}",
            before=None,
            after=None,
        )
    )
    await db.commit()
    clear_login_failures_for_email(target.email)

    reset_path = f"/reset-password?token={raw_token}"
    reset_url = f"{resolve_frontend_base_url(request_origin)}{reset_path}"

    # With SMTP configured, also mail the link to the user. A failed send never blocks the
    # admin: the link is still returned once so it can be handed over manually.
    email_sent = False
    if get_settings().smtp_configured:
        try:
            await send_password_reset_email(target.email, reset_url, ttl_minutes)
            email_sent = True
            _reset_smtp_failure_state()
            logger.info("[PasswordReset] Admin link emailed to {}", mask_email(target.email))
        except Exception as exc:
            _log_smtp_failure("SMTP delivery of admin link failed", target.email, exc)

    return {
        "user_id": target.id,
        "email": target.email,
        "reset_path": reset_path,
        "reset_url": reset_url,
        "expires_at": expires_at,
        "email_sent": email_sent,
    }
