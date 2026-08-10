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
    slot_name: str = Field(min_length=1, max_length=80)
    recipe_id: Optional[int] = Field(default=None, ge=1)
    custom_title: Optional[str] = Field(default=None, max_length=200)
    custom_description: Optional[str] = Field(default=None, max_length=2000)
    calories: Optional[float] = Field(default=None, ge=0, le=1_000_000)

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
    day_label: str = Field(min_length=1, max_length=80)
    day_index: int = Field(default=0, ge=0, le=365)
    calories_target: Optional[float] = Field(default=None, ge=0, le=100_000)
    macros_protein: Optional[str] = Field(default=None, max_length=60)
    macros_carbs: Optional[str] = Field(default=None, max_length=60)
    macros_fats: Optional[str] = Field(default=None, max_length=60)


class MealPlanDayCreate(MealPlanDayBase):
    meals: List[MealPlanMealCreate] = Field(default_factory=list, max_length=12)


class MealPlanDayResponse(MealPlanDayBase):
    id: int
    meal_plan_id: int
    meals: List[MealPlanMealResponse] = []
    model_config = ConfigDict(from_attributes=True)


# --- PLANO ---
class MealPlanBase(BaseModel):
    title: str = Field(default="Meu Plano Alimentar", min_length=1, max_length=100)
    source: Literal["ai", "manual"] = "manual"


class MealPlanCreate(MealPlanBase):
    days: List[MealPlanDayCreate] = Field(default_factory=list, max_length=31)


class MealPlanUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=100)


class MealPlanResponse(MealPlanBase):
    id: int
    user_id: int
    created_at: datetime
    days: List[MealPlanDayResponse] = []
    model_config = ConfigDict(from_attributes=True)
