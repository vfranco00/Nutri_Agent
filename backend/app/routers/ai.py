from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.shopping import ShoppingList, ShoppingItem
from app.services.ai import generate_meal_plan, get_food_calories, generate_recipe_from_ingredients, generate_shopping_list_from_plan

router = APIRouter()

# --- SCHEMAS ---
class FoodQuery(BaseModel):
    name: str
    quantity: float
    unit: str

class IngredientList(BaseModel):
    ingredients: List[str]

class GeneratePlanRequest(BaseModel):
    days: int = 1
    variety: str = "varied" # varied ou repetitive

# --- ROTAS ---

@router.post("/generate-plan") # <--- A Rota que estava dando 404
def generate_ai_plan(
    data: GeneratePlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Perfil não encontrado.")
    
    plan = generate_meal_plan(current_user.profile, days=data.days, variety_mode=data.variety)
    
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

@router.post("/plan-to-shopping-list")
def create_shopping_list_from_plan(
    plan_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    shopping_data = generate_shopping_list_from_plan(plan_data)
    
    if not shopping_data:
        raise HTTPException(status_code=500, detail="Erro ao gerar lista de compras.")
    
    db_list = ShoppingList(title=shopping_data.get("title", "Lista Automática"), user_id=current_user.id)
    db.add(db_list)
    db.commit()
    db.refresh(db_list)
    
    for item_name in shopping_data.get("items", []):
        db_item = ShoppingItem(name=item_name, list_id=db_list.id)
        db.add(db_item)
    
    db.commit()
    return {"message": "Lista criada!", "list_id": db_list.id}