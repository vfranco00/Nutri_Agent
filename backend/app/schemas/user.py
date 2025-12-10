from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

# Base comum
class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False

# Usado para criar (tem senha)
class UserCreate(UserBase):
    password: str

# Usado para atualizar
class UserUpdate(UserBase):
    password: Optional[str] = None

# Usado para devolver na API (tem ID, sem senha)
class UserResponse(UserBase):
    id: int
    score: int = 0
    
    model_config = ConfigDict(from_attributes=True)