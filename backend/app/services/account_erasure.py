"""Exclusão de conta (LGPD Art. 18, VI), usada pelo titular e pelo admin.

Ordem: 1) cancela a cobrança recorrente no Mercado Pago — se falhar, NADA é apagado;
2) numa única transação: anonimiza pagamentos (Art. 16, I), apaga eventos de uso,
chamados, inscrições de push, cache privado e a conta (cascata no resto).
"""
import logging

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.feedback import FeedbackTicket
from app.models.food_cache import FoodCache
from app.models.meal_plan import MealPlan
from app.models.payment import Payment
from app.models.push_subscription import PushSubscription
from app.models.subscription import Subscription, UsageEvent
from app.models.user import User
from app.services.mercado_pago import cancel_preapproval

logger = logging.getLogger(__name__)


class ErasureBlocked(Exception):
    """Não foi possível cancelar a assinatura no Mercado Pago; a conta segue intacta."""


def erase_account(db: Session, user: User) -> None:
    uid = user.id
    email = user.email

    sub = db.query(Subscription).filter(Subscription.user_id == uid).first()
    if sub is not None and sub.mp_subscription_id:
        if not cancel_preapproval(sub.mp_subscription_id):
            logger.error("Exclusão da conta user_id=%s bloqueada: MP não cancelou", uid)
            raise ErasureBlocked()

    try:
        db.query(Payment).filter(Payment.user_id == uid).update(
            {Payment.user_id: None}, synchronize_session=False)
        db.query(UsageEvent).filter(UsageEvent.user_id == uid).delete(synchronize_session=False)
        db.query(FeedbackTicket).filter(
            or_(FeedbackTicket.user_id == uid, FeedbackTicket.email == email)
        ).delete(synchronize_session=False)
        db.query(PushSubscription).filter(PushSubscription.user_id == uid).delete(
            synchronize_session=False)
        db.query(FoodCache).filter(
            FoodCache.created_by_user_id == uid, FoodCache.source.in_(("llm", "openfoodfacts"))
        ).delete(synchronize_session=False)
        # Planos não têm relação na User: o ORM leva dias e refeições junto.
        for plano in db.query(MealPlan).filter(MealPlan.user_id == uid).all():
            db.delete(plano)
        db.flush()
        db.expire(user)
        db.delete(user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    logger.info("Conta excluída user_id=%s", uid)
