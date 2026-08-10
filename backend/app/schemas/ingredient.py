from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class IngredientBase(BaseModel):
    name: str = Field(min_length=1, max_length=120, description="Nome do ingrediente (ex: Ovos)")
    quantity: float = Field(gt=0, le=100_000, description="Quantidade numérica")
    unit: str = Field(min_length=1, max_length=40, description="Unidade de medida (ex: g, kg, und, xícara)")
    calories: Optional[float] = Field(default=0.0, ge=0, le=1_000_000)

# Para criar, precisamos saber a qual Receita isso pertence
class IngredientCreate(IngredientBase):
    recipe_id: int

class IngredientResponse(IngredientBase):
    id: int
    recipe_id: int
    model_config = ConfigDict(from_attributes=True)