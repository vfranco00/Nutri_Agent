from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

# Base comum — NÃO inclui is_active/is_superuser: esses campos são administrativos
# e nunca podem vir do payload de um endpoint público (cadastro/self-update).
class UserBase(BaseModel):
    email: EmailStr = Field(max_length=254)  # limite do RFC 5321 pro envelope
    full_name: Optional[str] = Field(default=None, max_length=120)

# Usado para criar (tem senha)
class UserCreate(UserBase):
    # O teto de 128 não é estética: Argon2 é caro de propósito, e o custo cresce com
    # o tamanho da entrada. Sem `max_length`, um POST anônimo em /users/ com uma senha
    # de alguns megabytes prende um worker inteiro derivando o hash — negação de
    # serviço barata pro atacante e cara pro servidor, numa rota pública.
    password: str = Field(min_length=8, max_length=128)

# Usado para atualizar
class UserUpdate(UserBase):
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

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
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LeaderboardEntry(BaseModel):
    """DTO segregado do ranking da comunidade.

    NUNCA reaproveitar UserResponse aqui: ele carrega email, is_superuser, is_active
    e last_login_at. Num ranking, isso entrega de bandeja a lista de emails da base e
    marca quem é administrador — que é exatamente o alvo que um atacante escolhe pra
    phishing e força bruta. Aqui só sai o que a tela realmente desenha: primeiro nome
    e pontuação."""

    id: int
    display_name: str
    score: int


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(max_length=2048)
    new_password: str = Field(min_length=8, max_length=128)
