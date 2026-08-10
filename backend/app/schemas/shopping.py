from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime

# --- ITEM ---
class ShoppingItemBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    checked: bool = False

class ShoppingItemCreate(ShoppingItemBase):
    pass

class ShoppingItemResponse(ShoppingItemBase):
    id: int
    list_id: int
    model_config = ConfigDict(from_attributes=True)

# --- LIST ---
class ShoppingListBase(BaseModel):
    title: str = Field(default="Minha Lista", min_length=1, max_length=120)

class ShoppingListCreate(ShoppingListBase):
    # Opcional: Já criar lista com itens
    items: List[ShoppingItemCreate] = Field(default_factory=list, max_length=200)

class ShoppingListResponse(ShoppingListBase):
    id: int
    created_at: datetime
    items: List[ShoppingItemResponse] = []
    model_config = ConfigDict(from_attributes=True)