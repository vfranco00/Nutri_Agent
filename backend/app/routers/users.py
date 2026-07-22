from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.deps import get_current_user, get_current_active_superuser
from app.core.limiter import limiter
from app.models.user import User
from app.models.subscription import Subscription
# CORREÇÃO AQUI: Importamos UserResponse em vez de User
from app.schemas.user import UserCreate, UserResponse
from app.schemas.subscription import SubscriptionResponse, AdminSetPlanRequest
from app.services.email import send_verification_email
from app.services.subscription import get_subscription_status

router = APIRouter()

@router.post("/", response_model=UserResponse)
@limiter.limit("10/hour")
def create_user(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    from app.core.security import get_password_hash
    hashed_password = get_password_hash(user.password)

    # is_active/is_superuser NUNCA vêm do payload do cliente — cadastro público
    # sempre nasce como usuário comum, ativo e com email ainda não confirmado.
    db_user = User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed_password,
        is_active=True,
        is_superuser=False,
        is_verified=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Best-effort: se o envio falhar, o cadastro não é derrubado por isso.
    send_verification_email(db_user.email)

    return db_user

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me/onboarding-complete", response_model=UserResponse)
def complete_onboarding(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marca que o usuário já viu o tour de boas-vindas (não mostra de novo)."""
    current_user.has_seen_onboarding = True
    db.commit()
    db.refresh(current_user)
    return current_user

# Rota de Admin
@router.get("/", response_model=List[UserResponse])
def read_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """Admin deleta usuário"""
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
    current_user: User = Depends(get_current_active_superuser)
):
    """Ativa/Desativa acesso"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    user.is_active = not user.is_active
    db.commit()
    return {"message": "Status alterado.", "is_active": user.is_active}

@router.put("/{user_id}/subscription", response_model=SubscriptionResponse)
def admin_set_subscription(
    user_id: int,
    data: AdminSetPlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Atribui um plano manualmente (usado enquanto não há pagamento self-service)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Starter não vence (é o plano gratuito) — plus/pro ganham um período de 30 dias por
    # padrão, ou a data explícita passada (útil pra testar o aviso/downgrade automático).
    period_end = None
    if data.plan != "starter":
        period_end = data.current_period_end or (datetime.utcnow() + timedelta(days=30))

    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if not sub:
        sub = Subscription(user_id=user_id, plan=data.plan, status="active", current_period_end=period_end)
        db.add(sub)
    else:
        sub.plan = data.plan
        sub.status = "active"
        sub.current_period_end = period_end
        sub.expiry_warned_at = None
    db.commit()

    return get_subscription_status(db, target)

@router.get("/leaderboard", response_model=List[UserResponse])
def get_leaderboard(
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Retorna os top usuários ordenados por pontuação."""
    return db.query(User).order_by(User.score.desc()).limit(limit).all()