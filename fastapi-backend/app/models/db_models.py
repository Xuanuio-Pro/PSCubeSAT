"""Compatibility imports; all ORM models share app.db.database.Base."""

from app.models.tables import (
    Base,
    EmailVerificationToken,
    GoogleIdentity,
    PasswordResetToken,
    RevokedToken,
    User,
    UserRole,
)

__all__ = [
    "Base",
    "EmailVerificationToken",
    "GoogleIdentity",
    "PasswordResetToken",
    "RevokedToken",
    "User",
    "UserRole",
]
