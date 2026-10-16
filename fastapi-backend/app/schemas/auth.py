from typing import Optional
from pydantic import BaseModel, Field, field_validator

try:
    from pydantic import EmailStr
except ImportError:
    EmailStr = str  # Fallback if email-validator package is missing
    
class PasswordRequest(BaseModel):
    @field_validator('password', 'new_password', check_fields=False)
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode('utf-8')) > 72:
            raise ValueError('Mật khẩu không được vượt quá 72 byte UTF-8.')
        return value


class RegisterRequest(PasswordRequest):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")
    full_name: Optional[str] = None


class LoginRequest(BaseModel):
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
