import re
from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Literal, Optional

GenderType = Literal["male", "female"]
ActivityLevelType = Literal["sedentary", "lightly_active", "moderately_active", "very_active", "super_active"]
GoalType = Literal["lose_weight", "maintain", "gain_muscle"]

# Ao menos uma letra (com acentos) precisa estar presente para o texto ser considerado válido
_HAS_LETTER_RE = re.compile(r"[a-zA-ZÀ-ÖØ-öø-ÿ]")


class ProfileBase(BaseModel):
    age: int = Field(gt=0, le=120)
    weight: float = Field(gt=0)
    height: float = Field(gt=0)
    gender: str
    activity_level: str
    goal: str

    diet_type: Optional[str] = "omnivore"
    allergies: Optional[str] = ""
    food_likes: Optional[str] = ""
    food_dislikes: Optional[str] = ""

    eats_fruit: Optional[bool] = True
    body_fat_goal: Optional[bool] = False

    @field_validator("allergies", "food_likes", "food_dislikes")
    @classmethod
    def reject_non_text(cls, v: Optional[str]) -> Optional[str]:
        if v and v.strip() and not _HAS_LETTER_RE.search(v):
            raise ValueError("Este campo deve conter texto (ex: nomes de alimentos), não apenas números ou símbolos.")
        return v

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(ProfileBase):
    pass

class ProfileResponse(ProfileBase):
    id: int
    user_id: int

    bmr: Optional[float] = None
    daily_calories: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)