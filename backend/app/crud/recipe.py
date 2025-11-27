from sqlalchemy.orm import Session
from app.models.recipe import Recipe
from app.schemas.recipe import RecipeCreate
from app.models.ingredient import Ingredient

def create_recipe(db: Session, recipe: RecipeCreate, user_id: int):
    recipe_data = recipe.model_dump()
    
    ingredients_data = recipe_data.pop("ingredients", [])

    db_recipe = Recipe(**recipe_data, user_id=user_id)
    
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)

    for ing in ingredients_data:
        db_ingredient = Ingredient(**ing, recipe_id=db_recipe.id)
        db.add(db_ingredient)
    
    db.commit()
    db.refresh(db_recipe)

    return db_recipe

def get_recipes(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(Recipe).filter(Recipe.user_id == user_id).offset(skip).limit(limit).all()

def get_recipe(db: Session, recipe_id: int):
    return db.query(Recipe).filter(Recipe.id == recipe_id).first()