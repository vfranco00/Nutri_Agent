from pydantic import BaseModel
from typing import List, Optional, Literal


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

    # mrr_estimate_brl é projeção (planos atribuídos x preço de tabela); revenue_confirmed_brl
    # é receita real, soma de pagamentos aprovados registrados via webhook do Mercado Pago.
    mrr_estimate_brl: float
    is_estimate: bool = True
    revenue_confirmed_brl: float
    payments_last_30_days: int

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


class PaymentEntry(BaseModel):
    user_email: str
    plan: str
    amount_brl: float
    status: str
    created_at: str


class AdminPayments(BaseModel):
    entries: List[PaymentEntry]
    total: int


class TopUserEntry(BaseModel):
    user_email: str
    actions_count: int


class AdminTopUsers(BaseModel):
    entries: List[TopUserEntry]


class FeedbackTicketEntry(BaseModel):
    id: int
    user_id: Optional[int]
    name: Optional[str]
    email: str
    category: str
    message: str
    status: str
    resolved_at: Optional[str]
    created_at: str


class AdminFeedback(BaseModel):
    entries: List[FeedbackTicketEntry]
    total: int


# --- Sub-schemas reutilizáveis pras novas seções ---

class CountByKey(BaseModel):
    """Contagem genérica por chave (categoria, objetivo, dieta, status, origem...)."""
    key: str
    count: int


class MonthlyRevenue(BaseModel):
    month: str  # "YYYY-MM"
    total: float


class AdoptionStat(BaseModel):
    feature: str
    users: int
    pct: float  # % da base total


class SubscriptionStatusBreakdown(BaseModel):
    active: int
    canceled: int
    expiring_7d: int


# --- Visão Geral (landing) ---

class AdminOverview(BaseModel):
    users_total: int
    users_active: int
    new_users_7d: int
    new_users_30d: int

    revenue_confirmed_brl: float
    mrr_estimate_brl: float
    paying_users: int
    conversion_rate: float  # % pagantes / total

    active_24h: int
    active_7d: int
    active_30d: int
    usage_30d_total: int

    open_tickets: int
    tickets_7d: int

    signups_last_14d: List[SignupsByDay]


# --- Usuários (insights acima da tabela de gestão) ---

class UserFunnel(BaseModel):
    total: int
    verified: int
    with_profile: int
    with_activity: int
    paying: int


class AdminUsersInsights(BaseModel):
    funnel: UserFunnel
    users_by_plan: PlanBreakdown
    signups_last_30d: List[SignupsByDay]
    goal_distribution: List[CountByKey]
    diet_distribution: List[CountByKey]


# --- Finanças ---

class AdminFinance(BaseModel):
    revenue_confirmed_brl: float
    mrr_estimate_brl: float
    paying_users: int
    conversion_rate: float
    arpu_brl: float          # MRR / pagantes
    avg_ticket_brl: float    # média dos pagamentos aprovados

    revenue_by_month: List[MonthlyRevenue]
    plan_distribution: PlanBreakdown
    subscriptions: SubscriptionStatusBreakdown
    payments_by_status: List[CountByKey]


# --- Usabilidade ---

class AdminUsage(BaseModel):
    active_24h: int
    active_7d: int
    active_30d: int
    activation_rate: float          # % com perfil preenchido
    onboarding_rate: float          # % que passou pelo onboarding
    avg_actions_per_active_user: float

    feature_adoption: List[AdoptionStat]
    usage_by_type_30d: List[UsageByType]
    usage_over_time_30d: List[SignupsByDay]  # reaproveita {date,count}
    recipes_by_source: List[CountByKey]      # ai vs manual
    meal_plans_by_source: List[CountByKey]
    top_users: List[TopUserEntry]


# --- Chamados (resumo + atualização de status) ---

class TicketSummary(BaseModel):
    open_total: int
    resolved_total: int
    tickets_last_30d: int
    status_breakdown: List[CountByKey]
    category_breakdown: List[CountByKey]
    tickets_over_time_30d: List[SignupsByDay]


class TicketStatusUpdate(BaseModel):
    status: Literal["aberto", "resolvido"]
