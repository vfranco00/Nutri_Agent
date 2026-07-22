from pydantic import BaseModel
from typing import Optional, Literal, List
from datetime import datetime

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
    max_saved_recipes: Optional[int]
    saved_recipes_used: int


class AdminSetPlanRequest(BaseModel):
    plan: PlanName
    # Opcional — só pra facilitar teste manual do fluxo de vencimento (aviso de 7 dias,
    # downgrade automático) sem precisar mexer direto no banco. Se omitido, usa +30 dias.
    current_period_end: Optional[datetime] = None


class CheckoutRequest(BaseModel):
    plan: Literal["plus", "pro"]


class CheckoutResponse(BaseModel):
    checkout_url: str
