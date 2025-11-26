from sqlalchemy.orm import Session
from app.models.recipe import Recipe
from app.schemas.recipe import RecipeCreate

def create_recipe(db: Session, recipe: RecipeCreate, user_id: int):
    db_recipe = Recipe(**recipe.model_dump(), user_id=user_id)
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    return db_recipe

def get_recipes(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(Recipe).filter(Recipe.user_id == user_id).offset(skip).limit(limit).all()

def get_recipe(db: Session, recipe_id: int):
    return db.query(Recipe).filter(Recipe.id == recipe_id).first()