"""Email verification for new sign-ups: single-use emailed link, hashed token, expiry."""

import secrets
from datetime import datetime, timedelta, timezone

from loguru import logger
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.lms_errors import LMSError
from app.core.logging import mask_email
from app.models.tables import AccountStatus, EmailVerificationToken, User
from app.services.email_service import resolve_frontend_base_url, send_verification_email
from app.services.password_reset import hash_reset_token

RESEND_MESSAGE = (
    "Nếu email tồn tại và chưa được xác minh, chúng tôi đã gửi lại thư xác minh. "
    "Hãy kiểm tra cả thư rác."
)


def _as_utc(value: datetime) -> datetime:
    return (
        value.replace(tzinfo=timezone.utc)
        if value.tzinfo is None
        else value.astimezone(timezone.utc)
    )


def _invalid_token_error() -> LMSError:
    return LMSError(
        400,
        "CONFIG_INVALID",
        "Liên kết xác minh email không hợp lệ hoặc đã hết hạn.",
    )


def verification_required() -> bool:
    """Verification needs outgoing mail; without SMTP new accounts are verified at sign-up."""
    return get_settings().smtp_configured


async def issue_and_send(db: AsyncSession, user: User, request_origin: str | None) -> bool:
    """Revoke older links, store a new token and email it. Returns False if sending failed."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    await db.execute(
        update(EmailVerificationToken)
        .where(EmailVerificationToken.user_id == user.id, EmailVerificationToken.used_at.is_(None))
        .values(used_at=now)
    )
    raw_token = secrets.token_urlsafe(32)
    ttl_hours = settings.email_verification_ttl_hours
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=now + timedelta(hours=ttl_hours),
        )
    )
    await db.commit()
    url = f"{resolve_frontend_base_url(request_origin)}/verify-email?token={raw_token}"
    try:
        await send_verification_email(user.email, url, ttl_hours)
        logger.info("[EmailVerification] Sent verification email for {}", mask_email(user.email))
        return True
    except Exception as exc:
        logger.warning(
            "[EmailVerification] SMTP delivery failed for {} ({})",
            mask_email(user.email),
            type(exc).__name__,
        )
        return False


async def verify_token(db: AsyncSession, raw_token: str) -> User:
    token_clean = raw_token.strip()
    if len(token_clean) < 16:
        raise _invalid_token_error()
    row = (
        await db.execute(
            select(EmailVerificationToken)
            .where(EmailVerificationToken.token_hash == hash_reset_token(token_clean))
            .with_for_update()
        )
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if row is None or row.used_at is not None or _as_utc(row.expires_at) <= now:
        raise _invalid_token_error()
    user = (
        await db.execute(
            select(User)
            .where(User.id == row.user_id, User.deleted_at.is_(None))
            .with_for_update()
        )
    ).scalar_one_or_none()
    if user is None:
        raise _invalid_token_error()
    if user.email_verified_at is None:
        user.email_verified_at = now
        user.updated_at = now
    row.used_at = now
    await db.commit()
    logger.info("[EmailVerification] Verified user_id={}", user.id)
    return user


async def resend(db: AsyncSession, email: str, request_origin: str | None) -> dict[str, str]:
    """Always answers the same way so the endpoint cannot be used to find registered emails."""
    if not verification_required():
        return {"message": RESEND_MESSAGE}
    user = (
        await db.execute(
            select(User).where(
                func.lower(User.email) == email.strip().lower(), User.deleted_at.is_(None)
            )
        )
    ).scalar_one_or_none()
    if (
        user is not None
        and user.email_verified_at is None
        and user.status == AccountStatus.active
    ):
        await issue_and_send(db, user, request_origin)
    return {"message": RESEND_MESSAGE}
