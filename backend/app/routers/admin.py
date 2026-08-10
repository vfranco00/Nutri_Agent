from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import UserResponse
from app.schemas.admin import (
    AdminMetrics,
    PlanBreakdown,
    UsageByType,
    SignupsByDay,
    AdminActivity,
    ActivityEntry,
    AdminPayments,
    PaymentEntry,
    AdminTopUsers,
    TopUserEntry,
    AdminFeedback,
    FeedbackTicketEntry,
    AdminOverview,
    AdminUsersInsights,
    UserFunnel,
    AdminFinance,
    SubscriptionStatusBreakdown,
    MonthlyRevenue,
    AdminUsage,
    AdoptionStat,
    CountByKey,
    TicketSummary,
    TicketStatusUpdate,
)
from app.models.user import User
from app.models.subscription import Subscription, UsageEvent
from app.models.recipe import Recipe
from app.models.meal_plan import MealPlan
from app.models.payment import Payment
from app.models.feedback import FeedbackTicket
from app.models.profile import Profile
from app.models.shopping import ShoppingList
from app.core.deps import get_current_active_superuser
from app.core.plan_limits import PLAN_PRICES_BRL

router = APIRouter()


# --- Helpers compartilhados pelas seções ---

def _plan_counts(db: Session) -> tuple[dict, int]:
    """Contagem de usuários por plano, contando quem não tem linha em Subscription
    como starter (mesma regra de get_user_plan). Devolve (contagens, total_usuarios)."""
    plan_counts = dict(
        db.query(Subscription.plan, func.count(Subscription.id)).group_by(Subscription.plan).all()
    )
    users_total = db.query(User).count()
    users_with_subscription = sum(plan_counts.values())
    plan_counts["starter"] = plan_counts.get("starter", 0) + (users_total - users_with_subscription)
    return plan_counts, users_total


def _plan_breakdown(plan_counts: dict) -> PlanBreakdown:
    return PlanBreakdown(
        starter=plan_counts.get("starter", 0),
        plus=plan_counts.get("plus", 0),
        pro=plan_counts.get("pro", 0),
    )


def _mrr_and_conversion(plan_counts: dict, users_total: int) -> tuple[float, int, float]:
    """Devolve (mrr_estimado, pagantes, taxa_conversao_percent)."""
    paying = plan_counts.get("plus", 0) + plan_counts.get("pro", 0)
    mrr = (
        plan_counts.get("plus", 0) * PLAN_PRICES_BRL.get("plus", 0)
        + plan_counts.get("pro", 0) * PLAN_PRICES_BRL.get("pro", 0)
    )
    conversion = round(paying / users_total * 100, 1) if users_total else 0.0
    return round(mrr, 2), paying, conversion


def _confirmed_revenue(db: Session) -> float:
    return db.query(func.coalesce(func.sum(Payment.amount_brl), 0.0)).filter(
        Payment.status == "approved"
    ).scalar()


def _active_window(db: Session, days: int) -> int:
    """Usuários cujo último login cai dentro da janela (proxy de atividade — last_login_at
    guarda só o login mais recente, não é DAU/WAU/MAU exato)."""
    since = datetime.utcnow() - timedelta(days=days)
    return db.query(User).filter(User.last_login_at.isnot(None), User.last_login_at >= since).count()


def _signups_by_day(db: Session, days: int) -> List[SignupsByDay]:
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(func.date(User.created_at), func.count(User.id))
        .filter(User.created_at.isnot(None), User.created_at >= since)
        .group_by(func.date(User.created_at))
        .order_by(func.date(User.created_at))
        .all()
    )
    return [SignupsByDay(date=str(d), count=c) for d, c in rows]


@router.get("/users", response_model=List[UserResponse])
def read_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser), # <--- A mágica aqui
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
):
    """(Admin Only) Lista todos os usuários do sistema."""
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.get("/metrics", response_model=AdminMetrics)
def read_admin_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Métricas agregadas — sem tracking de requests HTTP, mas com receita real (Payment,
    populado via webhook do Mercado Pago) ao lado da estimativa de MRR (planos atribuídos
    x preço de tabela, marcada como tal na resposta)."""
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

    revenue_confirmed = (
        db.query(func.coalesce(func.sum(Payment.amount_brl), 0.0))
        .filter(Payment.status == "approved")
        .scalar()
    )
    payments_last_30_days = db.query(Payment).filter(Payment.created_at >= since).count()

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
        revenue_confirmed_brl=round(revenue_confirmed, 2),
        payments_last_30_days=payments_last_30_days,
        saved_recipes_total=saved_recipes_total,
        saved_meal_plans_total=saved_meal_plans_total,
        usage_last_30_days=usage_last_30_days,
        signups_last_30_days=signups_last_30_days,
    )


@router.get("/activity", response_model=AdminActivity)
def read_admin_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
    user_id: Optional[int] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Últimos eventos de uso (quando cada usuário gerou cardápio, usou o Chef IA, etc.),
    mais recente primeiro. Com user_id, vira o histórico de um usuário específico."""
    query = db.query(UsageEvent, User.email).join(User, UsageEvent.user_id == User.id)
    if user_id is not None:
        query = query.filter(UsageEvent.user_id == user_id)
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


@router.get("/payments", response_model=AdminPayments)
def read_admin_payments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Confirmações de cobrança recebidas do Mercado Pago (tópico
    subscription_authorized_payment), mais recente primeiro."""
    query = db.query(Payment, User.email).join(User, Payment.user_id == User.id)
    total = query.count()
    rows = query.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()

    entries = [
        PaymentEntry(
            user_email=email,
            plan=payment.plan,
            amount_brl=payment.amount_brl,
            status=payment.status,
            created_at=payment.created_at.isoformat(),
        )
        for payment, email in rows
    ]
    return AdminPayments(entries=entries, total=total)


@router.get("/top-users", response_model=AdminTopUsers)
def read_admin_top_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
    limit: int = Query(default=10, ge=1, le=100),
):
    """Usuários mais ativos por número total de ações registradas (UsageEvent)."""
    rows = (
        db.query(User.email, func.count(UsageEvent.id).label("actions_count"))
        .join(UsageEvent, UsageEvent.user_id == User.id)
        .group_by(User.email)
        .order_by(func.count(UsageEvent.id).desc())
        .limit(limit)
        .all()
    )
    entries = [TopUserEntry(user_email=email, actions_count=count) for email, count in rows]
    return AdminTopUsers(entries=entries)


def _ticket_entry(ticket: FeedbackTicket) -> FeedbackTicketEntry:
    return FeedbackTicketEntry(
        id=ticket.id,
        user_id=ticket.user_id,
        name=ticket.name,
        email=ticket.email,
        category=ticket.category,
        message=ticket.message,
        status=ticket.status,
        resolved_at=ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        created_at=ticket.created_at.isoformat(),
    )


@router.get("/feedback", response_model=AdminFeedback)
def read_admin_feedback(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
    user_id: Optional[int] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Chamados de ajuda/feedback (persistidos independente do envio de email dar
    certo). Filtros opcionais: user_id (chamados de um usuário), status (aberto/resolvido)
    e category."""
    query = db.query(FeedbackTicket)
    if user_id is not None:
        query = query.filter(FeedbackTicket.user_id == user_id)
    if status is not None:
        query = query.filter(FeedbackTicket.status == status)
    if category is not None:
        query = query.filter(FeedbackTicket.category == category)
    total = query.count()
    rows = query.order_by(FeedbackTicket.created_at.desc()).offset(skip).limit(limit).all()

    return AdminFeedback(entries=[_ticket_entry(t) for t in rows], total=total)


@router.get("/feedback/summary", response_model=TicketSummary)
def read_admin_feedback_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Resumo dos chamados pro painel: quantos abertos/resolvidos, por categoria, e a
    tendência dos últimos 30 dias."""
    status_rows = (
        db.query(FeedbackTicket.status, func.count(FeedbackTicket.id))
        .group_by(FeedbackTicket.status)
        .all()
    )
    status_map = {s: c for s, c in status_rows}

    category_rows = (
        db.query(FeedbackTicket.category, func.count(FeedbackTicket.id))
        .group_by(FeedbackTicket.category)
        .all()
    )

    since = datetime.utcnow() - timedelta(days=30)
    tickets_last_30d = db.query(FeedbackTicket).filter(FeedbackTicket.created_at >= since).count()
    over_time_rows = (
        db.query(func.date(FeedbackTicket.created_at), func.count(FeedbackTicket.id))
        .filter(FeedbackTicket.created_at >= since)
        .group_by(func.date(FeedbackTicket.created_at))
        .order_by(func.date(FeedbackTicket.created_at))
        .all()
    )

    return TicketSummary(
        open_total=status_map.get("aberto", 0),
        resolved_total=status_map.get("resolvido", 0),
        tickets_last_30d=tickets_last_30d,
        status_breakdown=[CountByKey(key=s, count=c) for s, c in status_rows],
        category_breakdown=[CountByKey(key=cat, count=c) for cat, c in category_rows],
        tickets_over_time_30d=[SignupsByDay(date=str(d), count=c) for d, c in over_time_rows],
    )


@router.put("/feedback/{ticket_id}/status", response_model=FeedbackTicketEntry)
def update_ticket_status(
    ticket_id: int,
    data: TicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Marca um chamado como resolvido ou reabre. resolved_at é preenchido ao resolver
    e zerado ao reabrir."""
    ticket = db.query(FeedbackTicket).filter(FeedbackTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Chamado não encontrado.")

    ticket.status = data.status
    ticket.resolved_at = datetime.utcnow() if data.status == "resolvido" else None
    db.commit()
    db.refresh(ticket)
    return _ticket_entry(ticket)


# ============================================================================
# Seções do painel: Visão Geral, Usuários (insights), Finanças, Usabilidade
# ============================================================================

@router.get("/overview", response_model=AdminOverview)
def read_admin_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """KPIs cross-área pra landing do painel."""
    plan_counts, users_total = _plan_counts(db)
    mrr, paying, conversion = _mrr_and_conversion(plan_counts, users_total)

    now = datetime.utcnow()
    users_active = db.query(User).filter(User.is_active.is_(True)).count()
    new_users_7d = db.query(User).filter(User.created_at.isnot(None), User.created_at >= now - timedelta(days=7)).count()
    new_users_30d = db.query(User).filter(User.created_at.isnot(None), User.created_at >= now - timedelta(days=30)).count()

    usage_30d_total = db.query(UsageEvent).filter(UsageEvent.created_at >= now - timedelta(days=30)).count()

    open_tickets = db.query(FeedbackTicket).filter(FeedbackTicket.status == "aberto").count()
    tickets_7d = db.query(FeedbackTicket).filter(FeedbackTicket.created_at >= now - timedelta(days=7)).count()

    return AdminOverview(
        users_total=users_total,
        users_active=users_active,
        new_users_7d=new_users_7d,
        new_users_30d=new_users_30d,
        revenue_confirmed_brl=round(_confirmed_revenue(db), 2),
        mrr_estimate_brl=mrr,
        paying_users=paying,
        conversion_rate=conversion,
        active_24h=_active_window(db, 1),
        active_7d=_active_window(db, 7),
        active_30d=_active_window(db, 30),
        usage_30d_total=usage_30d_total,
        open_tickets=open_tickets,
        tickets_7d=tickets_7d,
        signups_last_14d=_signups_by_day(db, 14),
    )


@router.get("/users/insights", response_model=AdminUsersInsights)
def read_admin_users_insights(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Funil de ativação + distribuições de perfil pra seção de Usuários."""
    plan_counts, users_total = _plan_counts(db)

    verified = db.query(User).filter(User.is_verified.is_(True)).count()
    with_profile = db.query(func.count(func.distinct(Profile.user_id))).scalar() or 0
    with_activity = db.query(func.count(func.distinct(UsageEvent.user_id))).scalar() or 0
    paying = plan_counts.get("plus", 0) + plan_counts.get("pro", 0)

    goal_rows = (
        db.query(Profile.goal, func.count(Profile.id))
        .filter(Profile.goal.isnot(None))
        .group_by(Profile.goal)
        .all()
    )
    diet_rows = (
        db.query(Profile.diet_type, func.count(Profile.id))
        .filter(Profile.diet_type.isnot(None))
        .group_by(Profile.diet_type)
        .all()
    )

    return AdminUsersInsights(
        funnel=UserFunnel(
            total=users_total,
            verified=verified,
            with_profile=with_profile,
            with_activity=with_activity,
            paying=paying,
        ),
        users_by_plan=_plan_breakdown(plan_counts),
        signups_last_30d=_signups_by_day(db, 30),
        goal_distribution=[CountByKey(key=k, count=c) for k, c in goal_rows],
        diet_distribution=[CountByKey(key=k, count=c) for k, c in diet_rows],
    )


@router.get("/finance", response_model=AdminFinance)
def read_admin_finance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Seção de Finanças: receita real, MRR, conversão, ARPU, ticket médio, receita
    mensal, assinaturas e pagamentos por status."""
    plan_counts, users_total = _plan_counts(db)
    mrr, paying, conversion = _mrr_and_conversion(plan_counts, users_total)
    revenue_confirmed = round(_confirmed_revenue(db), 2)

    arpu = round(mrr / paying, 2) if paying else 0.0
    avg_ticket = db.query(func.coalesce(func.avg(Payment.amount_brl), 0.0)).filter(
        Payment.status == "approved"
    ).scalar()

    # Receita por mês (últimos 12) — agrupa em Python pra não depender de função de data
    # específica do banco. Preenche os meses sem venda com zero pro gráfico ficar contínuo.
    now = datetime.utcnow()
    approved = (
        db.query(Payment.amount_brl, Payment.created_at)
        .filter(Payment.status == "approved", Payment.created_at >= now - timedelta(days=365))
        .all()
    )
    monthly: dict[str, float] = defaultdict(float)
    for amount, created in approved:
        monthly[created.strftime("%Y-%m")] += amount
    # Gera os 12 rótulos de mês (mais antigo → atual) iterando mês a mês, sem depender
    # de aritmética de dias (que pularia/duplicaria meses).
    year, month = now.year, now.month
    labels: List[str] = []
    for _ in range(12):
        labels.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    labels.reverse()
    revenue_by_month = [MonthlyRevenue(month=m, total=round(monthly.get(m, 0.0), 2)) for m in labels]

    active = db.query(Subscription).filter(Subscription.status == "active").count()
    canceled = db.query(Subscription).filter(Subscription.status == "canceled").count()
    expiring_7d = db.query(Subscription).filter(
        Subscription.status == "active",
        Subscription.plan != "starter",
        Subscription.current_period_end.isnot(None),
        Subscription.current_period_end >= now,
        Subscription.current_period_end <= now + timedelta(days=7),
    ).count()

    payment_status_rows = (
        db.query(Payment.status, func.count(Payment.id)).group_by(Payment.status).all()
    )

    return AdminFinance(
        revenue_confirmed_brl=revenue_confirmed,
        mrr_estimate_brl=mrr,
        paying_users=paying,
        conversion_rate=conversion,
        arpu_brl=arpu,
        avg_ticket_brl=round(avg_ticket, 2),
        revenue_by_month=revenue_by_month,
        plan_distribution=_plan_breakdown(plan_counts),
        subscriptions=SubscriptionStatusBreakdown(active=active, canceled=canceled, expiring_7d=expiring_7d),
        payments_by_status=[CountByKey(key=s, count=c) for s, c in payment_status_rows],
    )


@router.get("/usage", response_model=AdminUsage)
def read_admin_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Seção de Usabilidade: janelas de atividade, ativação, adoção de features, uso no
    tempo e origem das receitas/planos."""
    users_total = db.query(User).count()
    now = datetime.utcnow()
    since_30 = now - timedelta(days=30)

    with_profile = db.query(func.count(func.distinct(Profile.user_id))).scalar() or 0
    onboarded = db.query(User).filter(User.has_seen_onboarding.is_(True)).count()
    activation_rate = round(with_profile / users_total * 100, 1) if users_total else 0.0
    onboarding_rate = round(onboarded / users_total * 100, 1) if users_total else 0.0

    # Adoção de features: distinct de usuários que usaram cada uma pelo menos uma vez.
    chef_users = db.query(func.count(func.distinct(UsageEvent.user_id))).filter(
        UsageEvent.event_type == "chef_ai"
    ).scalar() or 0
    plan_users = db.query(func.count(func.distinct(UsageEvent.user_id))).filter(
        UsageEvent.event_type.like("generate_plan%")
    ).scalar() or 0
    recipe_users = db.query(func.count(func.distinct(Recipe.user_id))).scalar() or 0
    mealplan_users = db.query(func.count(func.distinct(MealPlan.user_id))).scalar() or 0
    shopping_users = db.query(func.count(func.distinct(ShoppingList.user_id))).scalar() or 0

    def _adoption(feature: str, users: int) -> AdoptionStat:
        pct = round(users / users_total * 100, 1) if users_total else 0.0
        return AdoptionStat(feature=feature, users=users, pct=pct)

    feature_adoption = [
        _adoption("Chef IA", chef_users),
        _adoption("Gerou cardápio", plan_users),
        _adoption("Salvou receita", recipe_users),
        _adoption("Criou plano alimentar", mealplan_users),
        _adoption("Lista de compras", shopping_users),
    ]

    # Uso por tipo (30d), normalizando "meal_swap:<token>" pro prefixo.
    raw_usage = (
        db.query(UsageEvent.event_type, func.count(UsageEvent.id))
        .filter(UsageEvent.created_at >= since_30)
        .group_by(UsageEvent.event_type)
        .all()
    )
    usage_normalized: dict[str, int] = defaultdict(int)
    for event_type, count in raw_usage:
        usage_normalized[event_type.split(":")[0]] += count
    usage_by_type = [UsageByType(event_type=k, count=v) for k, v in sorted(usage_normalized.items())]
    usage_30d_total = sum(usage_normalized.values())

    over_time_rows = (
        db.query(func.date(UsageEvent.created_at), func.count(UsageEvent.id))
        .filter(UsageEvent.created_at >= since_30)
        .group_by(func.date(UsageEvent.created_at))
        .order_by(func.date(UsageEvent.created_at))
        .all()
    )
    usage_over_time = [SignupsByDay(date=str(d), count=c) for d, c in over_time_rows]

    active_30d = _active_window(db, 30)
    avg_actions = round(usage_30d_total / active_30d, 1) if active_30d else 0.0

    recipes_ai = db.query(Recipe).filter(Recipe.is_ai.is_(True)).count()
    recipes_manual = db.query(Recipe).filter(Recipe.is_ai.is_(False)).count()
    recipes_by_source = [
        CountByKey(key="IA", count=recipes_ai),
        CountByKey(key="Manual", count=recipes_manual),
    ]

    plan_source_rows = db.query(MealPlan.source, func.count(MealPlan.id)).group_by(MealPlan.source).all()
    meal_plans_by_source = [CountByKey(key=s, count=c) for s, c in plan_source_rows]

    top_rows = (
        db.query(User.email, func.count(UsageEvent.id).label("actions_count"))
        .join(UsageEvent, UsageEvent.user_id == User.id)
        .group_by(User.email)
        .order_by(func.count(UsageEvent.id).desc())
        .limit(10)
        .all()
    )
    top_users = [TopUserEntry(user_email=email, actions_count=count) for email, count in top_rows]

    return AdminUsage(
        active_24h=_active_window(db, 1),
        active_7d=_active_window(db, 7),
        active_30d=active_30d,
        activation_rate=activation_rate,
        onboarding_rate=onboarding_rate,
        avg_actions_per_active_user=avg_actions,
        feature_adoption=feature_adoption,
        usage_by_type_30d=usage_by_type,
        usage_over_time_30d=usage_over_time,
        recipes_by_source=recipes_by_source,
        meal_plans_by_source=meal_plans_by_source,
        top_users=top_users,
    )
