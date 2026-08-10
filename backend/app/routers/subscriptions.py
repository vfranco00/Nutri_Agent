import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.plan_limits import PLAN_PRICES_BRL
from app.models.user import User
from app.models.subscription import Subscription
from app.models.payment import Payment
from app.schemas.subscription import SubscriptionResponse, CheckoutRequest, CheckoutResponse
from app.services.subscription import get_subscription_status
from app.services.mercado_pago import create_subscription_checkout, fetch_preapproval, fetch_authorized_payment

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


def _parse_external_reference(raw: object) -> tuple[int, str] | None:
    """Lê "user:<id>:plan:<plan>" e devolve (user_id, plan) já validados.

    O formato é escrito pela nossa própria integração, mas volta pela rede: `int()`
    cru estourava ValueError (500 numa rota pública) e o plano entrava sem conferência
    contra a lista de planos existentes. Fail-closed nos dois casos."""
    parts = (raw or "").split(":") if isinstance(raw, str) else []
    if len(parts) != 4 or parts[0] != "user" or parts[2] != "plan":
        return None
    if not parts[1].isdigit() or parts[3] not in PLAN_PRICES_BRL:
        return None
    return int(parts[1]), parts[3]


def _handle_preapproval_update(db: Session, preapproval_id: str) -> None:
    """Tópico subscription_preapproval — criação/autorização/cancelamento da assinatura
    em si (não é uma cobrança individual)."""
    resource = fetch_preapproval(preapproval_id)
    if not resource:
        return

    # external_reference foi setado na criação como "user:<id>:plan:<plan>"
    parsed = _parse_external_reference(resource.get("external_reference"))
    if not parsed:
        return
    user_id, plan = parsed

    # Assinatura de usuário que não existe mais (conta deletada) violaria a FK e
    # derrubaria a rota — o webhook precisa engolir isso em silêncio.
    if not db.query(User.id).filter(User.id == user_id).first():
        return

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

    sub.mp_subscription_id = preapproval_id
    db.commit()


def _handle_authorized_payment(db: Session, payment_id: str) -> None:
    """Tópico subscription_authorized_payment — dispara uma vez por cobrança recorrente
    (mensal). É a "venda" de verdade — sem tratar isso, cobranças de renovação não
    deixam nenhum rastro no sistema."""
    resource = fetch_authorized_payment(payment_id)
    if not resource:
        return

    user_id = plan = None
    parsed = _parse_external_reference(resource.get("external_reference"))
    if parsed:
        user_id, plan = parsed
    else:
        # Nem toda integração propaga external_reference pro authorized_payment —
        # fallback: resolve pela assinatura já vinculada via preapproval_id.
        preapproval_id = resource.get("preapproval_id")
        sub = (
            db.query(Subscription).filter(Subscription.mp_subscription_id == preapproval_id).first()
            if preapproval_id else None
        )
        if not sub:
            return
        user_id, plan = sub.user_id, sub.plan

    # Mesma razão do _handle_preapproval_update: usuário inexistente viola a FK e
    # transforma um webhook numa exceção não tratada em rota pública.
    if not db.query(User.id).filter(User.id == user_id).first():
        return

    # payment.status é o status real da cobrança (aprovado/rejeitado); o status no
    # nível raiz é sobre o agendamento da fatura — prioriza o aninhado quando presente.
    payment_node = resource.get("payment")
    status = (payment_node or {}).get("status") if isinstance(payment_node, dict) else None
    status = status or resource.get("status") or "unknown"
    amount = resource.get("transaction_amount") or PLAN_PRICES_BRL.get(plan, 0)

    existing = db.query(Payment).filter(Payment.mp_payment_id == payment_id).first()
    if existing:
        existing.status = status
    else:
        db.add(Payment(
            user_id=user_id,
            mp_payment_id=payment_id,
            plan=plan,
            amount_brl=amount,
            status=status,
        ))
    db.commit()


# IDs de recurso do Mercado Pago são opacos (dígitos e hex). O ID chega do corpo de
# uma rota PÚBLICA e é interpolado na URL de fetch_preapproval/fetch_authorized_payment:
# sem essa validação, um "id" como "../../v1/users/me" faz o nosso backend chamar
# outro endpoint da API do MP carregando o NOSSO access token — o atacante escolhe
# qual rota da conta do Mercado Pago é acionada.
_MP_RESOURCE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


@router.post("/webhook/mercadopago")
@limiter.limit("120/minute")
def mercadopago_webhook(request: Request, payload: dict, db: Session = Depends(get_db)):
    """Rota pública — o Mercado Pago chama direto, sem token de usuário.
    Por segurança, nunca confiamos no corpo do webhook: rebuscamos o recurso
    pela API do MP usando só o ID recebido.

    O rate limit existe porque a rota é aberta e cada chamada dispara uma requisição
    de saída pra API do MP: sem teto, qualquer um que descubra a URL usa o backend
    como amplificador e estoura a cota da nossa conta no Mercado Pago."""
    data = payload.get("data")
    resource_id = (data.get("id") if isinstance(data, dict) else None) or payload.get("id")

    # str() de um dict/lista aninhado viraria um "id" absurdo — só aceita escalar.
    if not isinstance(resource_id, (str, int)):
        return {"received": True}

    resource_id = str(resource_id)
    if not _MP_RESOURCE_ID_RE.match(resource_id):
        return {"received": True}

    topic = payload.get("type") or payload.get("topic")
    if topic == "subscription_authorized_payment":
        _handle_authorized_payment(db, resource_id)
    else:
        # subscription_preapproval (ou formato antigo sem "type") — mesmo
        # comportamento de sempre, mantém compatibilidade.
        _handle_preapproval_update(db, resource_id)

    return {"received": True}
