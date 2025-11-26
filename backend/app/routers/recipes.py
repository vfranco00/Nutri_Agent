from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.recipe import RecipeCreate, RecipeResponse
from app.crud import recipe as crud_recipe
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.post("/", response_model=RecipeResponse)
def create_recipe(
    recipe: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cria uma nova receita."""
    return crud_recipe.create_recipe(db=db, recipe=recipe, user_id=current_user.id)

@router.get("/", response_model=List[RecipeResponse])
def read_recipes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lista todas as receitas do usuário logado."""
    return crud_recipe.get_recipes(db=db, user_id=current_user.id, skip=skip, limit=limit)

@router.get("/{recipe_id}", response_model=RecipeResponse)
def read_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Busca uma receita específica pelo ID."""
    db_recipe = crud_recipe.get_recipe(db, recipe_id=recipe_id)
    if db_recipe is None:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Segurança: garante que a receita pertence ao usuário logado
    if db_recipe.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this recipe")
    return db_recipe