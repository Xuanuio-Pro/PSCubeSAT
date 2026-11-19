"""Password recovery tokens, admin reset requests, and email/link reset confirmation."""

import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256

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
) -> None:
    stmt = update(PasswordResetToken).where(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.status.in_(("pending", "issued")),
    )
    if exclude_id is not None:
        stmt = stmt.where(PasswordResetToken.id != exclude_id)
    await db.execute(stmt.values(status="revoked"))


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
) -> dict[str, str]:
    """Create either an emailed reset token (SMTP enabled) or an admin-queued request (no SMTP).

    Always returns the same generic message to avoid leaking account existence.
    """
    settings = get_settings()
    smtp_enabled = settings.smtp_configured
    delivery_mode = "email" if smtp_enabled else "admin"
    generic_message = (
        "Nếu email tồn tại và đang hoạt động, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu qua email. "
        "Nếu không nhận được thư sau vài phút, yêu cầu sẽ được chuyển tới quản trị viên."
        if smtp_enabled
        else "Nếu email tồn tại và đang hoạt động, yêu cầu cấp lại mật khẩu đã được gửi tới quản trị viên."
    )

    email_clean = email.strip().lower()
    user = (
        await db.execute(
            select(User).where(func.lower(User.email) == email_clean, User.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if user is None or user.status != AccountStatus.active:
        return {"message": generic_message, "delivery_mode": delivery_mode}

    now = datetime.now(timezone.utc)
    if not smtp_enabled and user.role == UserRole.admin:
        # Admin accounts cannot be reset by another admin in /admin/users.
        return {"message": generic_message, "delivery_mode": delivery_mode}

    await revoke_open_resets(db, user.id)

    if smtp_enabled:
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
            logger.info("[PasswordReset] Sent reset email for {}", mask_email(user.email))
        except Exception as exc:
            logger.warning(
                "[PasswordReset] SMTP delivery failed for {} ({}); falling back to admin queue",
                mask_email(user.email),
                type(exc).__name__,
            )
            if user.role != UserRole.admin:
                row.status = "pending"
                row.token_hash = None
                row.source = "admin_request"
                row.expires_at = now + timedelta(hours=_PENDING_REQUEST_TTL_HOURS)
            else:
                row.status = "revoked"
            await db.commit()
    else:
        db.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=None,
                status="pending",
                source="admin_request",
                requested_ip=client_ip,
                expires_at=now + timedelta(hours=_PENDING_REQUEST_TTL_HOURS),
            )
        )
        await db.commit()
        logger.info("[PasswordReset] Queued admin reset request for user_id={}", user.id)

    return {"message": generic_message, "delivery_mode": delivery_mode}


def _invalid_token_error() -> LMSError:
    return LMSError(
        400,
        "CONFIG_INVALID",
        "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.",
    )


async def validate_reset_token(db: AsyncSession, raw_token: str) -> PasswordResetToken:
    token_clean = raw_token.strip()
    if len(token_clean) < 16:
        raise _invalid_token_error()
    row = (
        await db.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == hash_reset_token(token_clean)
            )
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if (
        row is None
        or row.status != "issued"
        or row.used_at is not None
        or _as_utc(row.expires_at) <= now
    ):
        raise _invalid_token_error()
    user = (
        await db.execute(
            select(User).where(
                User.id == row.user_id,
                User.deleted_at.is_(None),
                User.status == AccountStatus.active,
            )
        )
    ).scalar_one_or_none()
    if user is None:
        raise _invalid_token_error()
    return row


async def confirm_password_reset(db: AsyncSession, raw_token: str, new_password: str) -> User:
    from app.services.auth import LOGIN_FAILURES

    token_clean = raw_token.strip()
    if len(token_clean) < 16:
        raise _invalid_token_error()

    row = (
        await db.execute(
            select(PasswordResetToken)
            .where(PasswordResetToken.token_hash == hash_reset_token(token_clean))
            .with_for_update()
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if (
        row is None
        or row.status != "issued"
        or row.used_at is not None
        or _as_utc(row.expires_at) <= now
    ):
        raise _invalid_token_error()

    user = (
        await db.execute(
            select(User)
            .where(
                User.id == row.user_id,
                User.deleted_at.is_(None),
                User.status == AccountStatus.active,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if user is None:
        raise _invalid_token_error()

    user.password_hash = await run_in_threadpool(hash_password, new_password)
    user.updated_at = now
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
    LOGIN_FAILURES.reset(f"email:{user.email}")
    LOGIN_FAILURES.reset_prefix(f"pair:{user.email}:")
    logger.info("[PasswordReset] Password updated via reset token for user_id={}", user.id)
    return user


async def issue_admin_reset_link(
    db: AsyncSession,
    actor: User,
    user_id: int,
    request_origin: str | None = None,
) -> dict:
    from app.services.auth import LOGIN_FAILURES

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
    LOGIN_FAILURES.reset(f"email:{target.email}")
    LOGIN_FAILURES.reset_prefix(f"pair:{target.email}:")

    reset_path = f"/reset-password?token={raw_token}"
    reset_url = f"{resolve_frontend_base_url(request_origin)}{reset_path}"
    return {
        "user_id": target.id,
        "email": target.email,
        "reset_path": reset_path,
        "reset_url": reset_url,
        "expires_at": expires_at,
    }
