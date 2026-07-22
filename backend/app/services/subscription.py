from sqlalchemy.orm import Session

from app.core.plan_limits import PLAN_LIMITS
from app.core.quotas import get_user_plan, get_usage_count
from app.models.user import User
from app.models.subscription import Subscription
from app.models.meal_plan import MealPlan
from app.schemas.subscription import SubscriptionResponse, UsageInfo


def get_subscription_status(db: Session, user: User) -> SubscriptionResponse:
    plan = get_user_plan(db, user)
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    limits = PLAN_LIMITS.get(plan, {})

    usage = []
    for event_type, rule in limits.items():
        if not isinstance(rule, dict) or "limit" not in rule:
            continue
        used = get_usage_count(db, user.id, event_type, rule["window_days"])
        usage.append(
            UsageInfo(event_type=event_type, used=used, limit=rule["limit"], window_days=rule["window_days"])
        )

    saved_meal_plans_used = db.query(MealPlan).filter(MealPlan.user_id == user.id).count()

    return SubscriptionResponse(
        plan=plan,
        status=sub.status if sub else "active",
        current_period_end=sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        usage=usage,
        shopping_list_access=limits.get("shopping_list_access", True),
        max_saved_meal_plans=limits.get("max_saved_meal_plans"),
        saved_meal_plans_used=saved_meal_plans_used,
    )
