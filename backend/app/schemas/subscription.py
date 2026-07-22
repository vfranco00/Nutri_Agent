from pydantic import BaseModel
from typing import Optional, Literal, List

PlanName = Literal["starter", "plus", "pro"]


class UsageInfo(BaseModel):
    event_type: str
    used: int
    limit: Optional[int]
    window_days: int


class SubscriptionResponse(BaseModel):
    plan: PlanName
    status: str
    current_period_end: Optional[str] = None
    usage: List[UsageInfo]
    shopping_list_access: bool
    max_saved_meal_plans: Optional[int]
    saved_meal_plans_used: int


class AdminSetPlanRequest(BaseModel):
    plan: PlanName


class CheckoutRequest(BaseModel):
    plan: Literal["plus", "pro"]


class CheckoutResponse(BaseModel):
    checkout_url: str
