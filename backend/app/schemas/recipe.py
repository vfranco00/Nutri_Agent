from pydantic import BaseModel, ConfigDict
from typing import Optional

class RecipeBase(BaseModel):
    title: str
    description: Optional[str] = None
    instructions: str
    prep_time: Optional[int] = None # minutos
    calories: Optional[float] = None

class RecipeCreate(RecipeBase):
    pass

class RecipeResponse(RecipeBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)