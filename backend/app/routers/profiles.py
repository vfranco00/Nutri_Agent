from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.profile import ProfileCreate, ProfileResponse
from app.crud import profile as crud_profile
from app.core.deps import get_current_user
from app.models.user import User

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