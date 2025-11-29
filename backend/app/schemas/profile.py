from pydantic import BaseModel, Field, ConfigDict
from typing import Literal, Optional

GenderType = Literal["male", "female"]
ActivityLevelType = Literal["sedentary", "lightly_active", "moderately_active", "very_active", "super_active"]
GoalType = Literal["lose_weight", "maintain", "gain_muscle"]

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

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(ProfileBase):
    pass

class ProfileResponse(ProfileBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)