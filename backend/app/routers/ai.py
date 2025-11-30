from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.ai import generate_meal_plan, get_food_calories, generate_recipe_from_ingredients

router = APIRouter()

# --- SCHEMAS ---
class GeneratePlanRequest(BaseModel):
    days: int = 1 # 1 ou 7

class FoodQuery(BaseModel):
    name: str
    quantity: float
    unit: str

class IngredientList(BaseModel):
    ingredients: List[str]

# --- ROTAS ---

@router.post("/generate-plan")
def generate_ai_plan(
    data: GeneratePlanRequest, # <--- Agora aceita JSON com { "days": 7 }
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Perfil não encontrado.")
    
    # Passa a quantidade de dias para o serviço
    plan = generate_meal_plan(current_user.profile, days=data.days)
    
    if not plan:
        raise HTTPException(status_code=500, detail="Erro ao gerar plano com a IA.")
        
    return plan

@router.post("/calculate-calories")
def calculate_calories(
    query: FoodQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    kcal_unit = get_food_calories(db, query.name, query.unit)
    total = kcal_unit * query.quantity
    return {"total_calories": round(total, 1)}

@router.post("/recipe-by-ingredients")
def create_recipe_idea(
    data: IngredientList,
    current_user: User = Depends(get_current_user)
):
    recipe = generate_recipe_from_ingredients(data.ingredients)
    if not recipe:
        raise HTTPException(status_code=500, detail="A IA não conseguiu gerar a receita.")
    return recipe