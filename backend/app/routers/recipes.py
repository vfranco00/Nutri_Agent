from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.recipe import Recipe
from app.schemas.recipe import RecipeCreate, RecipeResponse, RecipeUpdate

router = APIRouter()

# 1. Rota de Comunidade (Públicas)
@router.get("/public", response_model=List[RecipeResponse])
def read_public_recipes(
    skip: int = 0, 
    limit: int = 50, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    recipes = db.query(Recipe).filter(Recipe.is_public == True).offset(skip).limit(limit).all()
    return recipes

# 2. Criar Receita
@router.post("/", response_model=RecipeResponse)
def create_recipe(
    recipe: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Converte para dicionário e remove ingredientes para tratar separado se necessário
    recipe_data = recipe.model_dump(exclude={'ingredients'})
    
    db_recipe = Recipe(**recipe_data, user_id=current_user.id)
    db_recipe.is_new = True 
    
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    return db_recipe

# 3. Minhas Receitas
@router.get("/", response_model=List[RecipeResponse])
def read_recipes(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    recipes = db.query(Recipe).filter(Recipe.user_id == current_user.id).offset(skip).limit(limit).all()
    return recipes

# 4. Atualizar Receita
@router.put("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(
    recipe_id: int,
    recipe_update: RecipeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Atualiza apenas os campos enviados
    update_data = recipe_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_recipe, key, value)

    db.commit()
    db.refresh(db_recipe)
    return db_recipe

# 5. Deletar Receita
@router.delete("/{recipe_id}")
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not db_recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    db.delete(db_recipe)
    db.commit()
    return {"ok": True}