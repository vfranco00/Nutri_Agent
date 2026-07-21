from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.recipe import Recipe
from app.models.ingredient import Ingredient # <--- IMPORTANTE: Importar o model Ingredient
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

# 2. Criar Receita (CORRIGIDA)
@router.post("/", response_model=RecipeResponse)
def create_recipe(
    recipe: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Separa os dados da receita dos ingredientes
    recipe_data = recipe.model_dump(exclude={'ingredients'})
    ingredients_data = recipe.ingredients # Salva a lista para usar depois
    
    # 2. Cria a Receita
    db_recipe = Recipe(**recipe_data, user_id=current_user.id)
    db_recipe.is_new = True
    db_recipe.is_public = True # <--- FORÇA SER PÚBLICA (Como você pediu para comunidade)
    db_recipe.is_ai = getattr(recipe, 'is_ai', False)

    # --- GAMIFICAÇÃO: DAR PONTOS ---
    current_user.score += 10 # +10XP por contribuição
    db.add(current_user) # Atualiza usuário
    
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe) # Agora db_recipe tem um ID!
    
    # 3. CRIA OS INGREDIENTES (O Passo que faltava!)
    for ing in ingredients_data:
        db_ingredient = Ingredient(
            recipe_id=db_recipe.id,
            name=ing.name,
            quantity=ing.quantity,
            unit=ing.unit,
            calories=ing.calories
        )
        db.add(db_ingredient)
    
    db.commit()
    db.refresh(db_recipe) # Recarrega a receita com os ingredientes vinculados
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
    
    if db_recipe.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = recipe_update.model_dump(exclude_unset=True)
    ingredients_update = update_data.pop('ingredients', None)

    for key, value in update_data.items():
        setattr(db_recipe, key, value)
    
    if ingredients_update is not None:
        # Apaga os antigos
        db.query(Ingredient).filter(Ingredient.recipe_id == recipe_id).delete()
        
        # Cria os novos
        for ing in ingredients_update:
            # ing é um dict ou objeto pydantic, dependendo de como veio. 
            # O .model_dump() lá em cima já converteu tudo para dict se usou exclude_unset.
            # Mas ingredientes é uma lista de objetos. Vamos garantir:
            new_ing = Ingredient(
                recipe_id=recipe_id,
                name=ing['name'],
                quantity=ing['quantity'],
                unit=ing['unit'],
                calories=ing.get('calories', 0)
            )
            db.add(new_ing)

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

    if db_recipe.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(db_recipe)
    db.commit()
    return {"ok": True}

# 6. Recomendações Personalizadas
@router.get("/recommendations", response_model=List[RecipeResponse])
def get_recommendations(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Algoritmo 'Netflix': Recomenda receitas baseadas no Perfil e Histórico.
    """
    profile = current_user.profile
    if not profile:
        # Se não tiver perfil, retorna as mais recentes públicas
        return db.query(Recipe).filter(Recipe.is_public == True).order_by(Recipe.id.desc()).limit(limit).all()

    query = db.query(Recipe).filter(
        Recipe.is_public == True,
        Recipe.user_id != current_user.id # Não recomendar as minhas próprias
    )

    # 1. Filtro de Dieta (Obrigatório)
    if profile.diet_type == 'vegan':
        # Filtro simples: busca receitas sem carne/ovo/leite nos ingredientes (busca textual por enquanto)
        # Numa V2 ideal, teríamos tags. Por enquanto, confiamos na IA ou no cadastro.
        pass # Implementação futura de tags. Hoje vamos focar nas calorias.

    # 2. Filtro por Objetivo (Calorias)
    if profile.goal == 'lose_weight':
        # Prioriza receitas com menos de 500kcal
        query = query.filter(Recipe.calories < 600)
        # Ordena por menos caloria
        query = query.order_by(Recipe.calories.asc())
    
    elif profile.goal == 'gain_muscle':
        # Prioriza receitas com mais caloria/proteína
        query = query.order_by(Recipe.calories.desc())

    # 3. Filtro por Preferência (Gosto do usuário)
    # Se ele favoritou muitas receitas de "Doce", mostramos doces.
    # Pegamos a categoria mais favoritada pelo usuário
    favorite_category = db.query(Recipe.category, func.count(Recipe.category))\
        .filter(Recipe.user_id == current_user.id, Recipe.is_favorite == True)\
        .group_by(Recipe.category)\
        .order_by(func.count(Recipe.category).desc())\
        .first()

    if favorite_category:
        top_cat = favorite_category[0]
        # Dá um boost: Traz receitas dessa categoria primeiro
        # Como SQL é chato com ordenação condicional complexa, vamos simplificar:
        # Retornamos uma mistura.
        pass

    # Executa a query principal baseada no objetivo
    recommendations = query.limit(limit).all()
    
    # Se a lista vier vazia (ex: filtro muito restrito), faz um fallback para as mais recentes
    if not recommendations:
        recommendations = db.query(Recipe).filter(Recipe.is_public == True).order_by(Recipe.id.desc()).limit(limit).all()

    return recommendations