from pydantic import BaseModel, Field, ConfigDict
from typing import Literal

GenderType = Literal["male", "female"]
ActivityLevelType = Literal["sedentary", "lightly_active", "moderately_active", "very_active", "super_active"]
GoalType = Literal["lose_weight", "maintain", "gain_muscle"]

class ProfileBase(BaseModel):
    age: int = Field(gt=0, le=120, description="Idade em anos")
    weight: float = Field(gt=0, description="Peso em kg")
    height: float = Field(gt=0, description="Altura em cm")
    gender: GenderType
    activity_level: ActivityLevelType
    goal: GoalType

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(ProfileBase):
    pass

class ProfileResponse(ProfileBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)