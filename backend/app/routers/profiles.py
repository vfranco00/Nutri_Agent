from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.profile import ProfileCreate, ProfileResponse
from app.crud import profile as crud_profile
from app.core.deps import get_current_user
from app.models.user import User
from app.models.weight_history import WeightHistory
from app.schemas.weight import WeightHistoryCreate, WeightHistoryResponse

router = APIRouter()

@router.get("/me", response_model=ProfileResponse)
def read_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna o perfil do usuário logado."""
    if not current_user.profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return current_user.profile

@router.put("/me", response_model=ProfileResponse)
def upsert_my_profile(
    profile_data: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cria ou Atualiza o perfil do usuário logado."""
    return crud_profile.create_or_update_profile(
        db=db,
        profile=profile_data,
        user_id=current_user.id
    )

@router.post("/weight", response_model=WeightHistoryResponse)
def track_weight(
    weight_data: WeightHistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Registra um novo peso no histórico e atualiza o perfil atual."""
    # 1. Salva no histórico
    history = WeightHistory(
        user_id=current_user.id,
        weight=weight_data.weight
    )
    db.add(history)
    
    # 2. Atualiza o perfil atual (se existir)
    if current_user.profile:
        current_user.profile.weight = weight_data.weight
        db.add(current_user.profile)
    
    db.commit()
    db.refresh(history)
    return history

@router.get("/weight/history", response_model=list[WeightHistoryResponse])
def get_weight_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pega todo o histórico para gerar o gráfico."""
    return db.query(WeightHistory).filter(WeightHistory.user_id == current_user.id).order_by(WeightHistory.date.asc()).all()