"""
Ciclo de vida da assinatura: aviso de vencimento próximo e downgrade automático
pra Starter quando o período pago acaba sem renovação. Pensado pra rodar como job
periódico (ver app/core/scheduler.py) — cada função recebe a sessão de banco e não
tem nenhuma dependência do agendador em si, então dá pra chamar direto em teste.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.plan_limits import PLAN_LABELS
from app.models.subscription import Subscription
from app.models.user import User
from app.services.email import send_subscription_expiring_email

EXPIRY_WARNING_WINDOW_DAYS = 7


def send_expiry_warnings(db: Session) -> int:
    """Manda o email de 'sua assinatura vence em breve' pra quem está a até 7 dias do
    vencimento e ainda não foi avisado nesse ciclo. Retorna quantos avisos foram enviados."""
    now = datetime.utcnow()
    threshold = now + timedelta(days=EXPIRY_WARNING_WINDOW_DAYS)

    subs = (
        db.query(Subscription)
        .filter(
            Subscription.status == "active",
            Subscription.plan != "starter",
            Subscription.current_period_end.isnot(None),
            Subscription.current_period_end > now,
            Subscription.current_period_end <= threshold,
            Subscription.expiry_warned_at.is_(None),
        )
        .all()
    )

    sent = 0
    for sub in subs:
        user = db.query(User).filter(User.id == sub.user_id).first()
        if not user:
            continue
        ok = send_subscription_expiring_email(
            user.email, PLAN_LABELS.get(sub.plan, sub.plan), sub.current_period_end
        )
        if ok:
            sub.expiry_warned_at = now
            sent += 1
    db.commit()
    return sent


def downgrade_expired_subscriptions(db: Session) -> int:
    """Rebaixa pra Starter quem passou do current_period_end sem renovar. O resto do
    app (contadores de uso, bloqueio de lista de compras, limites de receitas/planos)
    já reage sozinho a partir daqui, porque tudo lê o plano atual em tempo real."""
    now = datetime.utcnow()

    expired = (
        db.query(Subscription)
        .filter(
            Subscription.status == "active",
            Subscription.plan != "starter",
            Subscription.current_period_end.isnot(None),
            Subscription.current_period_end < now,
        )
        .all()
    )

    for sub in expired:
        sub.plan = "starter"
        sub.status = "canceled"
        sub.current_period_end = None
        sub.expiry_warned_at = None
    db.commit()
    return len(expired)


def run_subscription_lifecycle(db: Session) -> None:
    """Ponto de entrada único chamado pelo scheduler."""
    send_expiry_warnings(db)
    downgrade_expired_subscriptions(db)
