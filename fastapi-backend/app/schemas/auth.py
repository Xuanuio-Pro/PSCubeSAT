from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class EmailRequest(BaseModel):
    @field_validator("email", mode="before", check_fields=False)
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class PasswordRequest(EmailRequest):
    @field_validator("password", "new_password", check_fields=False)
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Mật khẩu không được vượt quá 72 byte UTF-8.")
        return value


class RegisterRequest(PasswordRequest):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")
    full_name: Optional[str] = Field(default=None, max_length=200)


class LoginRequest(EmailRequest):
    email: EmailStr
    password: str


class ChangePasswordRequest(PasswordRequest):
    current_password: str
    new_password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")


class GoogleLoginRequest(BaseModel):
    credential: str = Field(..., min_length=1, max_length=10000)


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
