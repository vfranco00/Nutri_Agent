from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

# Base: Campos comuns que todo User tem
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: Optional[bool] = True

# Create: O que é preciso enviar para criar uma conta (Senha é obrigatória)
class UserCreate(UserBase):
    password: str

# Update: O que pode ser atualizado (tudo opcional)
class UserUpdate(UserBase):
    password: Optional[str] = None

# Response: O que a API devolve para o frontend (SEM SENHA!)
class UserResponse(UserBase):
    id: int
    is_superuser: bool

    model_config = ConfigDict(from_attributes=True)