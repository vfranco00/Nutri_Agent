from pydantic import BaseModel
from typing import List


class PlanBreakdown(BaseModel):
    starter: int
    plus: int
    pro: int


class UsageByType(BaseModel):
    event_type: str
    count: int


class SignupsByDay(BaseModel):
    date: str
    count: int


class AdminMetrics(BaseModel):
    users_total: int
    users_active: int
    users_verified: int
    users_by_plan: PlanBreakdown

    mrr_estimate_brl: float
    is_estimate: bool = True

    saved_recipes_total: int
    saved_meal_plans_total: int

    usage_last_30_days: List[UsageByType]
    signups_last_30_days: List[SignupsByDay]


class ActivityEntry(BaseModel):
    user_email: str
    event_type: str
    created_at: str


class AdminActivity(BaseModel):
    entries: List[ActivityEntry]
    total: int
