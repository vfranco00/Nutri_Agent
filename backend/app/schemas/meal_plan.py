from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import List, Optional, Literal
from datetime import datetime


class MealPlanRecipeSummary(BaseModel):
    id: int
    title: str
    calories: Optional[float] = None
    category: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# --- REFEIÇÃO ---
class MealPlanMealBase(BaseModel):
    slot_name: str
    recipe_id: Optional[int] = None
    custom_title: Optional[str] = None
    custom_description: Optional[str] = None
    calories: Optional[float] = None

    @model_validator(mode="after")
    def must_have_recipe_or_custom_content(self):
        if not self.recipe_id and not self.custom_title and not self.custom_description:
            raise ValueError("Cada refeição precisa de uma receita (recipe_id) ou de um título/descrição.")
        return self


class MealPlanMealCreate(MealPlanMealBase):
    pass


class MealPlanMealResponse(MealPlanMealBase):
    id: int
    meal_plan_day_id: int
    recipe: Optional[MealPlanRecipeSummary] = None
    model_config = ConfigDict(from_attributes=True)


# --- DIA ---
class MealPlanDayBase(BaseModel):
    day_label: str
    day_index: int = 0
    calories_target: Optional[float] = None
    macros_protein: Optional[str] = None
    macros_carbs: Optional[str] = None
    macros_fats: Optional[str] = None


class MealPlanDayCreate(MealPlanDayBase):
    meals: List[MealPlanMealCreate] = []


class MealPlanDayResponse(MealPlanDayBase):
    id: int
    meal_plan_id: int
    meals: List[MealPlanMealResponse] = []
    model_config = ConfigDict(from_attributes=True)


# --- PLANO ---
class MealPlanBase(BaseModel):
    title: str = "Meu Plano Alimentar"
    source: Literal["ai", "manual"] = "manual"


class MealPlanCreate(MealPlanBase):
    days: List[MealPlanDayCreate] = []


class MealPlanUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class MealPlanResponse(MealPlanBase):
    id: int
    user_id: int
    created_at: datetime
    days: List[MealPlanDayResponse] = []
    model_config = ConfigDict(from_attributes=True)
