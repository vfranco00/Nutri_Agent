from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional

# Base comum — NÃO inclui is_active/is_superuser: esses campos são administrativos
# e nunca podem vir do payload de um endpoint público (cadastro/self-update).
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

# Usado para criar (tem senha)
class UserCreate(UserBase):
    password: str = Field(min_length=8)

# Usado para atualizar
class UserUpdate(UserBase):
    password: Optional[str] = None

# Usado para devolver na API (tem ID, sem senha)
class UserResponse(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    is_verified: bool
    has_profile: bool = False
    has_seen_onboarding: bool
    plan: str = "starter"
    score: int = 0

    model_config = ConfigDict(from_attributes=True)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)
