from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from app.schemas.ingredient import IngredientBase, IngredientResponse

# Tetos de tamanho em todo campo de texto: sem eles, uma receita é um canal de
# escrita ilimitada no banco por qualquer conta autenticada (exaustão de storage), e
# `is_public` faz esse conteúdo aparecer no feed de todo mundo.
class RecipeBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: str = Field(min_length=1, max_length=20000)
    prep_time: Optional[int] = Field(default=None, ge=0, le=100000)
    calories: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    is_public: bool = False
    preparation_method: Optional[str] = Field(default="fogao", max_length=50)
    category: Optional[str] = Field(default="almoco", max_length=50)
    is_favorite: bool = False
    is_new: bool = True
    is_ai: bool = False

class RecipeCreate(RecipeBase):
    ingredients: List[IngredientBase] = Field(default_factory=list, max_length=100)

# --- ADICIONE ISTO (O que estava faltando) ---
class RecipeUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    instructions: Optional[str] = Field(default=None, min_length=1, max_length=20000)
    prep_time: Optional[int] = Field(default=None, ge=0, le=100000)
    calories: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    is_public: Optional[bool] = None
    preparation_method: Optional[str] = Field(default=None, max_length=50)
    category: Optional[str] = Field(default=None, max_length=50)
    is_favorite: Optional[bool] = None
    is_new: Optional[bool] = None
    is_ai: Optional[bool] = None
    ingredients: Optional[List[IngredientBase]] = Field(default=None, max_length=100)
# ---------------------------------------------

class RecipeResponse(RecipeBase):
    id: int
    user_id: int
    ingredients: List[IngredientResponse] = []

    model_config = ConfigDict(from_attributes=True)