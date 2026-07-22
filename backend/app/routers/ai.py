import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Dict, Any

from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.quotas import check_quota, log_usage, get_user_plan, check_meal_swap_quota, get_usage_count
from app.core.plan_limits import PLAN_LIMITS
from app.models.user import User
from app.models.shopping import ShoppingList, ShoppingItem
from app.services.ai import (
    generate_meal_plan,
    get_food_calories,
    generate_recipe_from_ingredients,
    generate_shopping_list_from_plan,
    swap_meal_suggestion,
)

router = APIRouter()

# --- SCHEMAS ---
class FoodQuery(BaseModel):
    name: str
    quantity: float
    unit: str

class IngredientList(BaseModel):
    ingredients: List[str]
    servings: int = Field(default=1, ge=1, le=20)

class GeneratePlanRequest(BaseModel):
    days: int = 1
    variety: str = "varied" # varied ou repetitive
    meals_count: int = 4

class SwapMealRequest(BaseModel):
    plan_token: str
    slot_name: str
    calories_target: float
    current_suggestion: str
    avoid_suggestions: List[str] = []

# --- ROTAS ---

@router.post("/generate-plan") # <--- A Rota que estava dando 404
def generate_ai_plan(
    data: GeneratePlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Perfil não encontrado.")

    user_plan = get_user_plan(db, current_user)
    event_type = "generate_plan_starter" if user_plan == "starter" else (
        "generate_plan_weekly" if data.days >= 7 else "generate_plan_daily"
    )
    check_quota(db, current_user, event_type)

    # Passa o meals_count para a função
    plan = generate_meal_plan(
        current_user.profile,
        days=data.days,
        variety_mode=data.variety,
        meals_count=data.meals_count
    )

    if not plan:
        raise HTTPException(status_code=500, detail="Erro ao gerar plano.")

    log_usage(db, current_user.id, event_type)
    # Identificador desse cardápio gerado — usado só pra contar trocas de refeição
    # (POST /ai/swap-meal), já que o plano ainda não existe no banco até ser salvo.
    plan["plan_token"] = uuid.uuid4().hex
    return plan

@router.post("/swap-meal")
def swap_meal(
    data: SwapMealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Perfil não encontrado.")

    check_meal_swap_quota(db, current_user, data.plan_token)

    suggestion = swap_meal_suggestion(
        current_user.profile,
        slot_name=data.slot_name,
        calories_target=data.calories_target,
        current_suggestion=data.current_suggestion,
        avoid_suggestions=data.avoid_suggestions,
    )
    if not suggestion:
        raise HTTPException(status_code=500, detail="A IA não conseguiu gerar uma alternativa.")

    event_type = f"meal_swap:{data.plan_token}"
    log_usage(db, current_user.id, event_type)

    plan = get_user_plan(db, current_user)
    rule = PLAN_LIMITS.get(plan, {}).get("meal_swap") or {"limit": 0, "window_days": 3650}
    swaps_used = get_usage_count(db, current_user.id, event_type, rule["window_days"])

    return {"suggestion": suggestion, "swaps_used": swaps_used, "swaps_limit": rule["limit"]}

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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_quota(db, current_user, "chef_ai")

    recipe = generate_recipe_from_ingredients(data.ingredients, servings=data.servings)
    if not recipe:
        raise HTTPException(status_code=500, detail="A IA não conseguiu gerar a receita.")

    log_usage(db, current_user.id, "chef_ai")
    return recipe

@router.post("/plan-to-shopping-list")
def create_shopping_list_proposal(
    plan_data: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """
    1. Recebe o cardápio completo.
    2. Usa a IA para extrair e somar os ingredientes.
    3. Retorna a lista para o usuário aprovar (NÃO SALVA NO BANCO AINDA).
    """
    shopping_data = generate_shopping_list_from_plan(plan_data)
    
    if not shopping_data:
        raise HTTPException(status_code=500, detail="A IA não conseguiu ler os ingredientes.")
    
    # Retorna JSON puro: { "title": "Compras da Semana", "items": ["Arroz", "Feijão"] }
    return shopping_data