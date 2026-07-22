from datetime import datetime, timedelta

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.plan_limits import PLAN_LIMITS
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.subscription import Subscription, UsageEvent
from app.models.meal_plan import MealPlan


def get_user_plan(db: Session, user: User) -> str:
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    return sub.plan if sub else "starter"


def get_usage_count(db: Session, user_id: int, event_type: str, window_days: int) -> int:
    since = datetime.utcnow() - timedelta(days=window_days)
    return (
        db.query(UsageEvent)
        .filter(
            UsageEvent.user_id == user_id,
            UsageEvent.event_type == event_type,
            UsageEvent.created_at >= since,
        )
        .count()
    )


def _limit_reached_error(plan: str, event_type: str, limit: int, used: int) -> HTTPException:
    return HTTPException(
        status_code=403,
        detail={
            "code": "PLAN_LIMIT_REACHED",
            "message": f"Você atingiu o limite do plano {plan} para essa ação. Faça upgrade pra continuar.",
            "event_type": event_type,
            "limit": limit,
            "used": used,
        },
    )


def check_quota(db: Session, user: User, event_type: str) -> None:
    """Levanta 403 se o usuário já bateu o limite do plano pra esse evento.
    Não registra o uso — quem chamar precisa chamar log_usage() depois do sucesso."""
    plan = get_user_plan(db, user)
    rule = PLAN_LIMITS.get(plan, {}).get(event_type)
    if not rule or rule.get("limit") is None:
        return

    used = get_usage_count(db, user.id, event_type, rule["window_days"])
    if used >= rule["limit"]:
        raise _limit_reached_error(plan, event_type, rule["limit"], used)


def log_usage(db: Session, user_id: int, event_type: str) -> None:
    db.add(UsageEvent(user_id=user_id, event_type=event_type))
    db.commit()


def require_shopping_access(db: Session, user: User) -> None:
    plan = get_user_plan(db, user)
    if not PLAN_LIMITS.get(plan, {}).get("shopping_list_access", True):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_LIMIT_REACHED",
                "message": "Lista de compras disponível a partir do plano Plus.",
                "event_type": "shopping_list_access",
            },
        )


def shopping_access_dependency(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Dependency de router inteiro — bloqueia todas as rotas de /shopping pro Starter."""
    require_shopping_access(db, current_user)


def check_meal_plan_slot(db: Session, user: User) -> None:
    plan = get_user_plan(db, user)
    max_plans = PLAN_LIMITS.get(plan, {}).get("max_saved_meal_plans")
    if max_plans is None:
        return

    current = db.query(MealPlan).filter(MealPlan.user_id == user.id).count()
    if current >= max_plans:
        raise _limit_reached_error(plan, "max_saved_meal_plans", max_plans, current)
