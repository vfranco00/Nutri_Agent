"""Busca e resolução de alimento.

Arquivo SEPARADO de `diary.py` de propósito: a busca é barata e a resolução é o único
caminho pago da feature. Uma rota só, que cai no LLM quando não acha, transformaria cada
tecla digitada num gasto potencial e tornaria impossível aplicar cota e rate limit
diferentes aos dois caminhos (RS-16). A separação também é o que os greps do RS-13 e do
RS-16 verificam.

Este módulo NÃO importa `FoodCache` e NÃO importa nada de `services/ai.py`: a busca lê
`food_catalog` e mais nada.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.quotas import check_quota, log_usage
from app.db.session import get_db
from app.models.user import User
from app.schemas.diary import FoodOption, FoodResolveRequest, FoodSearchResponse
from app.services import diary_foods as svc

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/search", response_model=FoodSearchResponse)
@limiter.limit("30/minute")
def buscar_alimentos(
    request: Request,
    # min_length=2 não é capricho: com 1 caractere o fallback de substring casa com quase
    # tudo ("a" está contido em "arroz branco cozido") e devolveria um alimento
    # arbitrário. E busca de 1 caractere é sempre varredura completa sem valor de UX.
    q: str = Query(min_length=2, max_length=60),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Catálogo curado apenas. Não lê cache de usuário, não chama LLM.

    Termo não encontrado devolve 200 com lista vazia e `suggest_resolve: true` — chamar o
    caminho caro é uma ação explícita e separada do usuário.
    """
    termo = q.strip()
    if len(termo) < 2:
        # `.strip()` pode derrubar o termo abaixo do mínimo depois da validação do Query.
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "type": "string_too_short",
                    "loc": ["query", "q"],
                    "msg": "String should have at least 2 characters",
                }
            ],
        )

    linhas = svc.buscar_no_catalogo(db, termo)
    # RS-26: nem o termo nem o resultado entram no log. Só identificadores e contagem.
    logger.info(
        "diary_food_search user_id=%s resultados=%s", current_user.id, len(linhas)
    )
    resultados = [svc.opcao_do_catalogo(linha) for linha in linhas]
    return FoodSearchResponse(
        results=resultados,
        # true se e somente se `results` está vazio.
        suggest_resolve=not resultados,
    )


@router.post("/resolve", response_model=FoodOption)
@limiter.limit("5/minute")
def resolver_alimento(
    request: Request,
    payload: FoodResolveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Único caminho pago: rate limit E cota por plano.

    O limit contém a rajada por origem; a cota contém o gasto por conta. `log_usage` só
    depois do sucesso — falha de rede não pode debitar a cota do usuário. Acerto em
    `food_catalog` ou em `food_cache` não consome cota: não custou nada.
    """
    check_quota(db, current_user, "diary_food_resolve")

    try:
        opcao, consumiu_caminho_pago = svc.resolver_alimento(
            db, current_user.id, payload.name, payload.unit
        )
    except svc.ResolverUnavailable:
        # 503 e não 404 (divergência Δ3 do ADR-0001): um 404 durante indisponibilidade é
        # a mesma mentira que o `0.0` do achado A-5, um nível acima — o usuário conclui
        # "esse alimento não existe" e desiste. O disjuntor é global, não por usuário,
        # então o 503 não revela nada sobre ninguém.
        raise HTTPException(
            status_code=503,
            detail={
                "code": "FOOD_RESOLVER_UNAVAILABLE",
                "message": "Serviço de estimativa indisponível. Tente novamente em alguns minutos.",
            },
        )
    except svc.FoodNotFound as nao_encontrado:
        # A cota debita quando a CHAMADA PAGA ACONTECEU, não quando ela deu certo.
        # "Só debita no sucesso" deixava o caminho caro de graça: uma resposta do modelo
        # reprovada no parsing estrito ou na faixa de plausibilidade custa exatamente o
        # mesmo que uma aceita, e um nome escolhido para produzir resposta fora da faixa
        # dava chamadas ilimitadas sem nunca mover o contador de `diary_food_resolve`.
        # Falha de rede e disjuntor aberto continuam não debitando (§ 8.2 do ADR-0001):
        # ali não houve chamada faturável.
        if nao_encontrado.consumiu_caminho_pago:
            log_usage(db, current_user.id, "diary_food_resolve")
        # RS-27: a mensagem NUNCA repete o alimento enviado. Essa string vai para o
        # Sentry, para o log do proxy e para a tela — inclusive uma tela compartilhada.
        raise HTTPException(
            status_code=404,
            detail={"code": "FOOD_NOT_FOUND", "message": "Alimento não encontrado."},
        )

    if consumiu_caminho_pago:
        log_usage(db, current_user.id, "diary_food_resolve")

    logger.info(
        "diary_food_resolved user_id=%s source=%s pago=%s",
        current_user.id,
        opcao.source,
        consumiu_caminho_pago,
    )
    return opcao
