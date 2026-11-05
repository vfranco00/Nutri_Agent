"""`POST /agent/parse`: o Agente Nuvi lê texto ou foto e devolve itens para confirmar.

Não grava nada. Conta UMA vez na cota `diary_food_resolve` quando o Gemini respondeu
(a chamada foi paga, sirva a resposta ou não); falha de rede e disjuntor aberto não
debitam (§ 8.2 do ADR-0001).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.plan_limits import PLAN_LIMITS
from app.core.quotas import get_usage_count, get_user_plan, log_usage
from app.db.session import get_db
from app.models.user import User
from app.schemas.agent import AgentParseRequest, AgentParseResponse
from app.services import agent_parse as svc

router = APIRouter()
logger = logging.getLogger(__name__)

EVENTO_COTA = "diary_food_resolve"
NOMES_DE_PLANO = {"starter": "Starter", "plus": "Plus", "pro": "Pro"}


def _checar_cota(db: Session, user: User) -> None:
    """Mesma regra de `check_quota`, mas com `429` e a mensagem do plano.

    `check_quota` responde 403 genérico; a tela do Agente precisa dizer quantas leituras
    o plano dá e levar para `/assinatura` sem apagar o que a pessoa escreveu.
    """
    plano = get_user_plan(db, user)
    regra = PLAN_LIMITS.get(plano, {}).get(EVENTO_COTA)
    if not regra or regra.get("limit") is None:
        return
    usados = get_usage_count(db, user.id, EVENTO_COTA, regra["window_days"])
    if usados >= regra["limit"]:
        nome = NOMES_DE_PLANO.get(plano, plano.capitalize())
        raise HTTPException(
            status_code=429,
            detail={
                "code": "PLAN_LIMIT_REACHED",
                "message": (
                    f"Você usou as {regra['limit']} leituras do Agente de hoje no plano "
                    f"{nome}. Assine um plano maior para continuar."
                ),
                "event_type": EVENTO_COTA,
                "limit": regra["limit"],
                "used": usados,
                "upgrade_url": "/assinatura",
            },
        )


@router.post("/parse", response_model=AgentParseResponse)
@limiter.limit("10/minute")
def interpretar_refeicao(
    request: Request,
    payload: AgentParseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    imagem = None
    if payload.image_base64:
        # Antes da cota: foto recusada não gasta leitura.
        try:
            imagem = svc.decodificar_imagem(payload.image_base64)
        except svc.ImagemGrande:
            raise HTTPException(
                status_code=413,
                detail={
                    "code": "IMAGE_TOO_LARGE",
                    "message": "A foto é grande demais. Envie uma de até 4 MB.",
                },
            )
        except svc.ImagemInvalida:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "IMAGE_INVALID",
                    "message": "Não consegui abrir essa foto. Envie um JPG, PNG ou WebP.",
                },
            )

    _checar_cota(db, current_user)

    try:
        extracao, respondeu = svc.extrair_itens(db, payload.text, imagem)
    except svc.AgenteIndisponivel:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "AGENT_UNAVAILABLE",
                "message": "O Agente está indisponível agora. Tente de novo em alguns minutos.",
            },
        )
    if respondeu:
        log_usage(db, current_user.id, EVENTO_COTA)

    itens = [svc.casar_item(db, current_user.id, item) for item in extracao.items]
    logger.info(
        "agent_parse user_id=%s itens=%s alta=%s foto=%s",
        current_user.id,
        len(itens),
        sum(1 for i in itens if i.confidence == "alta"),
        imagem is not None,
    )
    return AgentParseResponse(
        date=payload.date,
        meal_slot=extracao.meal_slot or payload.meal_slot,
        items=itens,
    )
