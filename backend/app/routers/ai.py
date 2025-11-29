from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.ai import generate_meal_plan

router = APIRouter()

@router.post("/generate-plan")
def generate_ai_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Verifica se o usuário tem perfil
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Você precisa criar um perfil nutricional antes.")

    # 2. Chama o serviço de IA
    plan = generate_meal_plan(current_user.profile)
    
    if not plan:
        raise HTTPException(status_code=500, detail="Erro ao gerar plano com a IA.")
        
    return plan