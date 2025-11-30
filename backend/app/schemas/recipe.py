from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from app.schemas.ingredient import IngredientBase
from app.schemas.ingredient import IngredientBase, IngredientResponse

class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = None
    instructions: str
    prep_time: Optional[int] = None # minutos
    calories: Optional[float] = None
    preparation_method: Optional[str] = "fogao"
    

class RecipeCreate(RecipeBase):
    ingredients: list[IngredientBase] = []

class RecipeResponse(RecipeBase):
    id: int
    user_id: int

    ingredients: List[IngredientResponse] = []

    model_config = ConfigDict(from_attributes=True)