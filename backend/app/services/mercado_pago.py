import logging

import httpx

from app.core.config import settings
from app.core.plan_limits import PLAN_LABELS, PLAN_PRICES_BRL
from app.models.user import User

MP_API_BASE = "https://api.mercadopago.com"


logger = logging.getLogger(__name__)


def create_subscription_checkout(user: User, plan: str) -> str | None:
    """Cria uma assinatura recorrente (preapproval) no Mercado Pago.

    Devolve a URL de checkout hospedada pelo Mercado Pago, ou None se
    MERCADO_PAGO_ACCESS_TOKEN não estiver configurado (ainda não tem conta) —
    o router trata isso como "assinatura em breve", sem quebrar nada.
    """
    if not settings.MERCADO_PAGO_ACCESS_TOKEN:
        return None

    price = PLAN_PRICES_BRL.get(plan)
    if not price:
        return None

    try:
        with httpx.Client() as client:
            response = client.post(
                f"{MP_API_BASE}/preapproval",
                headers={"Authorization": f"Bearer {settings.MERCADO_PAGO_ACCESS_TOKEN}"},
                json={
                    "reason": f"NutriAgent — Plano {PLAN_LABELS.get(plan, plan)}",
                    "payer_email": user.email,
                    "external_reference": f"user:{user.id}:plan:{plan}",
                    "auto_recurring": {
                        "frequency": 1,
                        "frequency_type": "months",
                        "transaction_amount": price,
                        "currency_id": "BRL",
                    },
                    "back_url": f"{settings.FRONTEND_URL}/dashboard",
                    "status": "pending",
                },
                timeout=15.0,
            )
            if response.status_code >= 300:
                logger.error("Erro ao criar assinatura pro user %s: %s %s", user.id, response.status_code, response.text)
                return None
            return response.json().get("init_point")
    except httpx.HTTPError as e:
        logger.error("Falha de conexão com o Mercado Pago: %s", e)
        return None


def fetch_preapproval(preapproval_id: str) -> dict | None:
    """Rebusca o preapproval direto na API do MP usando o ID — nunca confia no
    corpo do webhook em si, que pode ser forjado por qualquer um que descubra a URL."""
    if not settings.MERCADO_PAGO_ACCESS_TOKEN:
        return None
    try:
        with httpx.Client() as client:
            response = client.get(
                f"{MP_API_BASE}/preapproval/{preapproval_id}",
                headers={"Authorization": f"Bearer {settings.MERCADO_PAGO_ACCESS_TOKEN}"},
                timeout=15.0,
            )
            if response.status_code != 200:
                return None
            return response.json()
    except httpx.HTTPError:
        return None


def fetch_authorized_payment(payment_id: str) -> dict | None:
    """Rebusca uma cobrança recorrente (tópico de webhook subscription_authorized_payment —
    uma por ciclo, diferente do preapproval que é a assinatura em si) direto na API do MP
    usando o ID — mesma regra de segurança do fetch_preapproval, nunca confia no webhook."""
    if not settings.MERCADO_PAGO_ACCESS_TOKEN:
        return None
    try:
        with httpx.Client() as client:
            response = client.get(
                f"{MP_API_BASE}/authorized_payments/{payment_id}",
                headers={"Authorization": f"Bearer {settings.MERCADO_PAGO_ACCESS_TOKEN}"},
                timeout=15.0,
            )
            if response.status_code != 200:
                return None
            return response.json()
    except httpx.HTTPError:
        return None
