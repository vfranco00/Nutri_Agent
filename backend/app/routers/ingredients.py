from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.ingredient import IngredientCreate, IngredientResponse
from app.crud import ingredient as crud_ingredient
from app.crud import recipe as crud_recipe
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=IngredientResponse)
def add_ingredient(
    ingredient: IngredientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Adiciona um ingrediente a uma receita existente."""
    # 1. Verifica se a receita existe
    recipe = crud_recipe.get_recipe(db, recipe_id=ingredient.recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # 2. Segurança: Verifica se a receita pertence ao usuário logado
    if recipe.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this recipe")

    return crud_ingredient.create_ingredient(db=db, ingredient=ingredient)

@router.get("/recipe/{recipe_id}", response_model=List[IngredientResponse])
def list_ingredients_by_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista ingredientes de uma receita específica."""
    recipe = crud_recipe.get_recipe(db, recipe_id=recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    if recipe.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return crud_ingredient.get_ingredients_by_recipe(db, recipe_id=recipe_id)