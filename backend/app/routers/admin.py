from collections import defaultdict
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import UserResponse
from app.schemas.admin import AdminMetrics, PlanBreakdown, UsageByType, SignupsByDay, AdminActivity, ActivityEntry
from app.models.user import User
from app.models.subscription import Subscription, UsageEvent
from app.models.recipe import Recipe
from app.models.meal_plan import MealPlan
from app.core.deps import get_current_active_superuser
from app.core.plan_limits import PLAN_PRICES_BRL

router = APIRouter()


@router.get("/users", response_model=List[UserResponse])
def read_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser), # <--- A mágica aqui
    skip: int = 0,
    limit: int = 100,
):
    """(Admin Only) Lista todos os usuários do sistema."""
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/metrics", response_model=AdminMetrics)
def read_admin_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Métricas agregadas só com dados que já existem hoje — sem tracking de requests
    HTTP nem histórico real de pagamento (Mercado Pago ainda não conectado). MRR é uma
    estimativa (planos pagos atribuídos x preço de tabela), marcada como tal na resposta."""
    users_total = db.query(User).count()
    users_active = db.query(User).filter(User.is_active.is_(True)).count()
    users_verified = db.query(User).filter(User.is_verified.is_(True)).count()

    plan_counts = dict(
        db.query(Subscription.plan, func.count(Subscription.id)).group_by(Subscription.plan).all()
    )
    # Usuário sem linha em Subscription conta como starter (mesma regra de get_user_plan).
    users_with_subscription = sum(plan_counts.values())
    plan_counts["starter"] = plan_counts.get("starter", 0) + (users_total - users_with_subscription)
    users_by_plan = PlanBreakdown(
        starter=plan_counts.get("starter", 0),
        plus=plan_counts.get("plus", 0),
        pro=plan_counts.get("pro", 0),
    )

    mrr_estimate = (
        users_by_plan.plus * PLAN_PRICES_BRL.get("plus", 0)
        + users_by_plan.pro * PLAN_PRICES_BRL.get("pro", 0)
    )

    saved_recipes_total = db.query(Recipe).count()
    saved_meal_plans_total = db.query(MealPlan).count()

    since = datetime.utcnow() - timedelta(days=30)

    # Normaliza event_type dinâmico ("meal_swap:<plan_token>") pro prefixo antes do ":"
    # em Python — evita depender de função de string específica de um banco (Postgres
    # em produção, SQLite nos testes).
    raw_usage = (
        db.query(UsageEvent.event_type, func.count(UsageEvent.id))
        .filter(UsageEvent.created_at >= since)
        .group_by(UsageEvent.event_type)
        .all()
    )
    usage_normalized: dict[str, int] = defaultdict(int)
    for event_type, count in raw_usage:
        usage_normalized[event_type.split(":")[0]] += count
    usage_last_30_days = [
        UsageByType(event_type=k, count=v) for k, v in sorted(usage_normalized.items())
    ]

    raw_signups = (
        db.query(func.date(User.created_at), func.count(User.id))
        .filter(User.created_at.isnot(None), User.created_at >= since)
        .group_by(func.date(User.created_at))
        .order_by(func.date(User.created_at))
        .all()
    )
    signups_last_30_days = [
        SignupsByDay(date=str(date), count=count) for date, count in raw_signups
    ]

    return AdminMetrics(
        users_total=users_total,
        users_active=users_active,
        users_verified=users_verified,
        users_by_plan=users_by_plan,
        mrr_estimate_brl=round(mrr_estimate, 2),
        saved_recipes_total=saved_recipes_total,
        saved_meal_plans_total=saved_meal_plans_total,
        usage_last_30_days=usage_last_30_days,
        signups_last_30_days=signups_last_30_days,
    )


@router.get("/activity", response_model=AdminActivity)
def read_admin_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
    skip: int = 0,
    limit: int = 50,
):
    """Últimos eventos de uso (quando cada usuário gerou cardápio, usou o Chef IA, etc.),
    mais recente primeiro."""
    query = db.query(UsageEvent, User.email).join(User, UsageEvent.user_id == User.id)
    total = query.count()
    rows = query.order_by(UsageEvent.created_at.desc()).offset(skip).limit(limit).all()

    entries = [
        ActivityEntry(
            user_email=email,
            event_type=event.event_type.split(":")[0],
            created_at=event.created_at.isoformat(),
        )
        for event, email in rows
    ]
    return AdminActivity(entries=entries, total=total)
