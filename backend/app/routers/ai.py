from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.ai import generate_meal_plan, get_food_calories, generate_recipe_from_ingredients

router = APIRouter()

# --- SCHEMAS (Definidos no topo para evitar NameError) ---

class FoodQuery(BaseModel):
    name: str
    quantity: float
    unit: str

class IngredientList(BaseModel):
    ingredients: List[str]

# --- ROTAS ---

@router.post("/generate-plan")
def generate_ai_plan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Perfil não encontrado.")
    
    plan = generate_meal_plan(current_user.profile)
    if not plan:
        raise HTTPException(status_code=500, detail="Erro ao gerar plano com a IA.")
        
    return plan

@router.post("/calculate-calories")
def calculate_calories(
    query: FoodQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Calcula calorias totais de um alimento (Cache ou IA)."""
    # Busca o valor unitário (1g ou 1un)
    kcal_per_unit = get_food_calories(db, query.name, query.unit)
    
    # Multiplica pela quantidade que o usuário pediu
    total = kcal_per_unit * query.quantity
    
    return {"total_calories": round(total, 1)}

@router.post("/recipe-by-ingredients")
def create_recipe_idea(
    data: IngredientList,
    current_user: User = Depends(get_current_user)
):
    """Gera uma ideia de receita baseada no que tem na geladeira."""
    recipe = generate_recipe_from_ingredients(data.ingredients)
    
    if not recipe:
        raise HTTPException(status_code=500, detail="A IA não conseguiu gerar a receita. Tente novamente.")
        
    return recipe