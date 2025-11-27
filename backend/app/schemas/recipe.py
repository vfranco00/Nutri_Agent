from pydantic import BaseModel, ConfigDict
from typing import Optional
from app.schemas.ingredient import IngredientBase

class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = None
    instructions: str
    prep_time: Optional[int] = None # minutos
    calories: Optional[float] = None
    

class RecipeCreate(RecipeBase):
    ingredients: list[IngredientBase] = []

class RecipeResponse(RecipeBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)