from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

class IngredientBase(BaseModel):
    name: str = Field(description="Nome do ingrediente (ex: Ovos)")
    quantity: float = Field(gt=0, description="Quantidade numérica")
    unit: str = Field(description="Unidade de medida (ex: g, kg, und, xícara)")
    calories: Optional[float] = 0.0

# Para criar, precisamos saber a qual Receita isso pertence
class IngredientCreate(IngredientBase):
    recipe_id: int

class IngredientResponse(IngredientBase):
    id: int
    recipe_id: int
    model_config = ConfigDict(from_attributes=True)