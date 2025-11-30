from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

# --- ITEM ---
class ShoppingItemBase(BaseModel):
    name: str
    checked: bool = False

class ShoppingItemCreate(ShoppingItemBase):
    pass

class ShoppingItemResponse(ShoppingItemBase):
    id: int
    list_id: int
    model_config = ConfigDict(from_attributes=True)

# --- LIST ---
class ShoppingListBase(BaseModel):
    title: str = "Minha Lista"

class ShoppingListCreate(ShoppingListBase):
    # Opcional: Já criar lista com itens
    items: List[ShoppingItemCreate] = []

class ShoppingListResponse(ShoppingListBase):
    id: int
    created_at: datetime
    items: List[ShoppingItemResponse] = []
    model_config = ConfigDict(from_attributes=True)