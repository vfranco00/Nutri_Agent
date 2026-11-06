"""Retenção e descarte (LGPD Arts. 15 e 16; ADR-0001 § 8.4). Job diário.

| Dado                                   | Regra                                       |
| food_cache llm/openfoodfacts           | sem uso há 90 dias, ou órfão (sem dono)     |
| usage_events                           | mais de 12 meses                            |
| conta não verificada                   | mais de 30 dias                             |
| feedback_tickets resolvidos            | mais de 24 meses                            |
| push_subscriptions                     | sem envio com sucesso há 90 dias            |
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.models.feedback import FeedbackTicket
from app.models.food_cache import FoodCache
from app.models.push_subscription import PushSubscription
from app.models.subscription import UsageEvent
from app.models.user import User
from app.services.account_erasure import ErasureBlocked, erase_account

logger = logging.getLogger(__name__)

CACHE_DIAS = 90
USAGE_DIAS = 365
NAO_VERIFICADA_DIAS = 30
CHAMADO_FECHADO_DIAS = 730
PUSH_DIAS = 90
_FONTES_PRIVADAS = ("llm", "openfoodfacts")


def run_retention(db: Session, agora: datetime | None = None) -> dict[str, int]:
    agora = agora or datetime.now(timezone.utc).replace(tzinfo=None)
    corte = lambda d: agora - timedelta(days=d)  # noqa: E731
    r: dict[str, int] = {}

    r["food_cache"] = db.query(FoodCache).filter(
        FoodCache.source.in_(_FONTES_PRIVADAS),
        or_(FoodCache.created_by_user_id.is_(None), FoodCache.created_at < corte(CACHE_DIAS)),
    ).delete(synchronize_session=False)

    r["usage_events"] = db.query(UsageEvent).filter(
        UsageEvent.created_at < corte(USAGE_DIAS)
    ).delete(synchronize_session=False)

    r["feedback_tickets"] = db.query(FeedbackTicket).filter(
        FeedbackTicket.status == "resolvido",
        FeedbackTicket.resolved_at.isnot(None),
        FeedbackTicket.resolved_at < corte(CHAMADO_FECHADO_DIAS),
    ).delete(synchronize_session=False)

    r["push_subscriptions"] = db.query(PushSubscription).filter(
        func.coalesce(PushSubscription.last_success_at, PushSubscription.created_at)
        < corte(PUSH_DIAS)
    ).delete(synchronize_session=False)
    db.commit()

    # Contas que nunca confirmaram o e-mail (o e-mail pode ser de terceiro).
    r["unverified_accounts"] = 0
    velhas = db.query(User).filter(
        User.is_verified.is_(False), User.created_at < corte(NAO_VERIFICADA_DIAS)
    ).all()
    for u in velhas:
        try:
            erase_account(db, u)
            r["unverified_accounts"] += 1
        except ErasureBlocked:
            logger.warning("Retenção: conta user_id=%s não apagada (assinatura)", u.id)

    logger.info("Retenção concluída: %s", r)
    return r
