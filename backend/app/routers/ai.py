from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services.ai import generate_meal_plan, get_food_calories, generate_recipe_from_ingredients, generate_shopping_list_from_plan
from app.services.ai import generate_shopping_list_from_plan
from app.models.shopping import ShoppingList, ShoppingItem

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

@router.post("/plan-to-shopping-list")
def create_shopping_list_from_plan(
    plan_data: Dict[str, Any], # Recebe o JSON do cardápio inteiro
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Transforma um cardápio em lista de compras e salva no banco."""
    
    # 1. Chama a IA para extrair e consolidar itens
    shopping_data = generate_shopping_list_from_plan(plan_data)
    
    if not shopping_data:
        raise HTTPException(status_code=500, detail="Erro ao gerar lista de compras.")
    
    # 2. Cria a Lista no Banco
    db_list = ShoppingList(
        title=shopping_data.get("title", "Lista Automática"),
        user_id=current_user.id
    )
    db.add(db_list)
    db.commit()
    db.refresh(db_list)
    
    # 3. Cria os Itens
    for item_name in shopping_data.get("items", []):
        db_item = ShoppingItem(name=item_name, list_id=db_list.id)
        db.add(db_item)
    
    db.commit()
    
    return {"message": "Lista de compras gerada com sucesso!", "list_id": db_list.id}