from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from app.schemas.ingredient import IngredientBase, IngredientResponse

class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = None
    instructions: str
    prep_time: Optional[int] = None
    calories: Optional[float] = None
    is_public: bool = False
    preparation_method: Optional[str] = "fogao"
    category: Optional[str] = "almoco"
    is_favorite: bool = False
    is_new: bool = True

class RecipeCreate(RecipeBase):
    ingredients: List[IngredientBase] = []

# --- ADICIONE ISTO (O que estava faltando) ---
class RecipeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    prep_time: Optional[int] = None
    calories: Optional[float] = None
    is_public: Optional[bool] = None
    preparation_method: Optional[str] = None
    category: Optional[str] = None
    is_favorite: Optional[bool] = None
    is_new: Optional[bool] = None
# ---------------------------------------------

class RecipeResponse(RecipeBase):
    id: int
    user_id: int
    ingredients: List[IngredientResponse] = []

    model_config = ConfigDict(from_attributes=True)