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
    weight: float = Field(gt=0, le=1000)
    height: float = Field(gt=0, le=300)
    gender: str = Field(max_length=20)
    activity_level: str = Field(max_length=30)
    goal: str = Field(max_length=30)

    diet_type: Optional[str] = Field(default="omnivore", max_length=50)
    # Os três campos abaixo são interpolados no prompt enviado ao Gemini
    # (services/ai.py::_diet_restrictions_prompt). Sem teto, o perfil vira um campo
    # de texto livre de tamanho ilimitado dentro do prompt — custo de LLM inflado a
    # cada geração de cardápio e espaço de sobra pra tentativa de injeção de prompt.
    allergies: Optional[str] = Field(default="", max_length=500)
    food_likes: Optional[str] = Field(default="", max_length=500)
    food_dislikes: Optional[str] = Field(default="", max_length=500)

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