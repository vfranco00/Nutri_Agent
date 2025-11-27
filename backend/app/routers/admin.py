from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user import UserResponse
from app.models.user import User
from app.core.deps import get_current_active_superuser

router = APIRouter()

@router.get("/users", response_model=List[UserResponse])
def read_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser), # <--- A mágica aqui
    skip: int = 0,
    limit: int = 100,
):
    """(Admin Only) Lista todos os usuários do sistema."""
    users = db.query(User).offset(skip).limit(limit).all()
    return users