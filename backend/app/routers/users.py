from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
# CORREÇÃO AQUI: Importamos UserResponse em vez de User
from app.schemas.user import UserCreate, UserResponse 

router = APIRouter()

@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    from app.core.security import get_password_hash
    hashed_password = get_password_hash(user.password)
    
    db_user = User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        is_active=user.is_active,
        is_superuser=user.is_superuser
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# Rota de Admin
@router.get("/", response_model=List[UserResponse])
def read_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Privilégio insuficiente.")
        
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin deleta usuário"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Apenas Admins.")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    db.delete(user)
    db.commit()
    return {"message": "Usuário deletado."}

@router.put("/{user_id}/toggle-status")
def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Ativa/Desativa acesso"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Apenas Admins.")
        
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    user.is_active = not user.is_active
    db.commit()
    return {"message": "Status alterado.", "is_active": user.is_active}

@router.get("/leaderboard", response_model=List[UserResponse])
def get_leaderboard(
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Retorna os top usuários ordenados por pontuação."""
    return db.query(User).order_by(User.score.desc()).limit(limit).all()