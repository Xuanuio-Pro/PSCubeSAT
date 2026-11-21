from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class EmailRequest(BaseModel):
    @field_validator("email", mode="before", check_fields=False)
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


def validate_new_password(value: str) -> str:
    """Policy for passwords being set (register, change, reset); never applied to login."""
    if len(value) < 8:
        raise ValueError("Mật khẩu phải có ít nhất 8 ký tự.")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Mật khẩu không được vượt quá 72 byte UTF-8.")
    if not any(c.isupper() for c in value):
        raise ValueError("Mật khẩu phải có ít nhất 1 chữ cái in hoa.")
    if not any(not c.isalnum() and not c.isspace() for c in value):
        raise ValueError("Mật khẩu phải có ít nhất 1 ký tự đặc biệt (ví dụ ! @ # $ %).")
    return value


class PasswordRequest(EmailRequest):
    @field_validator("password", "new_password", check_fields=False)
    @classmethod
    def validate_password_policy(cls, value: str) -> str:
        return validate_new_password(value)


class RegisterRequest(PasswordRequest):
    model_config = ConfigDict(extra="forbid")
    email: EmailStr
    password: str = Field(..., description="Mật khẩu tối thiểu 8 ký tự, có chữ in hoa và ký tự đặc biệt")
    full_name: Optional[str] = Field(default=None, max_length=200)


class LoginRequest(EmailRequest):
    email: EmailStr
    password: str


class ChangePasswordRequest(PasswordRequest):
    current_password: str
    new_password: str = Field(..., description="Mật khẩu tối thiểu 8 ký tự, có chữ in hoa và ký tự đặc biệt")


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=1, max_length=10000)


class ForgotPasswordRequest(EmailRequest):
    email: EmailStr
    channel: Literal["email", "admin"] = "email"


class ResetPasswordConfirmRequest(PasswordRequest):
    token: str = Field(..., min_length=16, max_length=512)
    new_password: str = Field(..., description="Mật khẩu mới tối thiểu 8 ký tự, có chữ in hoa và ký tự đặc biệt")


class PasswordResetConfigResponse(BaseModel):
    smtp_enabled: bool
    token_ttl_minutes: int


class ForgotPasswordResponse(BaseModel):
    message: str
    delivery_mode: str


class ResetPasswordValidateResponse(BaseModel):
    valid: bool


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    role: str
    created_at: Optional[str] = None


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RegisterResponse(BaseModel):
    """Either a signed-in session (no email verification needed) or a verification notice."""

    access_token: Optional[str] = None
    token_type: str = "bearer"
    user: Optional[UserResponse] = None
    verification_required: bool = False
    email_sent: bool = True
    message: Optional[str] = None


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=512)


class ResendVerificationRequest(EmailRequest):
    email: EmailStr
