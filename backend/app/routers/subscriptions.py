from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.models.user import User
from app.models.subscription import Subscription
from app.schemas.subscription import SubscriptionResponse, CheckoutRequest, CheckoutResponse
from app.services.subscription import get_subscription_status
from app.services.mercado_pago import create_subscription_checkout, fetch_preapproval

router = APIRouter()


@router.get("/me", response_model=SubscriptionResponse)
def read_my_subscription(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_subscription_status(db, current_user)


@router.post("/checkout", response_model=CheckoutResponse)
@limiter.limit("10/hour")
def checkout(
    request: Request,
    data: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    checkout_url = create_subscription_checkout(current_user, data.plan)
    if not checkout_url:
        raise HTTPException(
            status_code=501,
            detail={
                "code": "CHECKOUT_UNAVAILABLE",
                "message": "Assinatura online ainda não está disponível. Fale com a gente pra ativar seu plano.",
            },
        )
    return CheckoutResponse(checkout_url=checkout_url)


@router.post("/webhook/mercadopago")
def mercadopago_webhook(payload: dict, db: Session = Depends(get_db)):
    """Rota pública — o Mercado Pago chama direto, sem token de usuário.
    Por segurança, nunca confiamos no corpo do webhook: rebuscamos o preapproval
    pela API do MP usando só o ID recebido."""
    preapproval_id = (payload.get("data") or {}).get("id") or payload.get("id")
    if not preapproval_id:
        return {"received": True}

    resource = fetch_preapproval(str(preapproval_id))
    if not resource:
        return {"received": True}

    # external_reference foi setado na criação como "user:<id>:plan:<plan>"
    parts = (resource.get("external_reference") or "").split(":")
    if len(parts) != 4 or parts[0] != "user" or parts[2] != "plan":
        return {"received": True}

    user_id, plan = int(parts[1]), parts[3]
    mp_status = resource.get("status")

    sub = db.query(Subscription).filter(Subscription.user_id == user_id).first()
    if not sub:
        sub = Subscription(user_id=user_id, plan="starter", status="active")
        db.add(sub)

    if mp_status == "authorized":
        sub.plan = plan
        sub.status = "active"
        # A API de preapproval não devolve de forma confiável a data do próximo débito
        # aqui — melhor esforço: ciclo de 30 dias a partir de agora, igual cobrado.
        sub.current_period_end = datetime.utcnow() + timedelta(days=30)
        sub.expiry_warned_at = None  # reseta o aviso pro próximo ciclo poder avisar de novo
    elif mp_status in ("cancelled", "paused"):
        sub.status = "canceled"
        sub.plan = "starter"
        sub.current_period_end = None
        sub.expiry_warned_at = None

    sub.mp_subscription_id = str(preapproval_id)
    db.commit()
    return {"received": True}
