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

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.quotas import check_quota, log_usage
from app.db.session import get_db
from app.models.user import User
from app.schemas.diary import FoodOption, FoodResolveRequest, FoodSearchResponse
from app.schemas.diary_registro import (
    BARCODE_PATTERN,
    QuickFoodList,
    UserFoodCreate,
    UserFoodList,
    UserFoodResponse,
    UserFoodUpdate,
)
from app.models.user_food import UserFood
from app.services import diary_foods as svc
from app.services import diary_registro, openfoodfacts

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


@router.get("/barcode/{code}", response_model=FoodOption)
@limiter.limit("30/minute")
def buscar_por_codigo_de_barras(
    request: Request,
    # Só dígitos, de 8 a 14 (EAN-8, UPC-A, EAN-13, GTIN-14): a URL da Open Food Facts
    # nunca é montada a partir de texto livre.
    code: str = Path(pattern=openfoodfacts.CODIGO_VALIDO.pattern),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Código de barras: grátis em todos os planos (Frente B da Fase 1).

    Sem `check_quota` e sem `log_usage` de propósito: não chama o LLM, e a Open Food Facts
    não custa nada. A lógica e o acesso a `food_cache` moram no serviço, para que este
    router continue sem importar `FoodCache` (RS-13).
    """
    try:
        opcao = openfoodfacts.buscar_por_codigo(db, current_user.id, code)
    except openfoodfacts.BarcodeUnavailable:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "BARCODE_UNAVAILABLE",
                "message": "Não deu para consultar o produto agora. Tente de novo ou digite os dados.",
            },
        )
    except openfoodfacts.BarcodeNotFound:
        # RS-27: a mensagem não repete o código lido.
        raise HTTPException(
            status_code=404,
            detail={"code": "FOOD_NOT_FOUND", "message": "Produto não encontrado."},
        )

    # RS-26: nem o código nem o nome do produto entram no log.
    logger.info(
        "diary_barcode_found user_id=%s source=%s", current_user.id, opcao.source
    )
    return opcao


# ======================================================================================
# Alimento pessoal — `mine:<id>` (Frente R). Recurso alheio é 404 com corpo idêntico ao
# de inexistente (RS-03): a busca já sai escopada por dono e os dois casos dão `None`.
# ======================================================================================


def _mine_nao_encontrado() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "USER_FOOD_NOT_FOUND", "message": "Alimento não encontrado."},
    )


def _barcode_em_uso() -> HTTPException:
    # 409 só fala da conta do PRÓPRIO usuário: o unique é (user_id, barcode), então este
    # erro nunca revela que outra pessoa cadastrou o mesmo código.
    return HTTPException(
        status_code=409,
        detail={
            "code": "BARCODE_ALREADY_USED",
            "message": "Você já tem um alimento com este código de barras.",
        },
    )


def _como_resposta_mine(linha: UserFood) -> UserFoodResponse:
    return UserFoodResponse(
        id=linha.id,
        food_ref=diary_registro.mine_ref(linha.id),
        name=linha.name,
        portion_label=linha.portion_label,
        portion_grams=linha.portion_grams,
        kcal=linha.kcal,
        protein_g=linha.protein_g,
        carbs_g=linha.carbs_g,
        fat_g=linha.fat_g,
        barcode=linha.barcode,
        created_at=linha.created_at,
    )


def _commit_ou_409(db: Session) -> None:
    """O unique (user_id, barcode) é a defesa real; a checagem prévia só dá a mensagem.
    Duas abas criando o mesmo código ao mesmo tempo caem aqui, não num 500."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _barcode_em_uso()


@router.get("/recent", response_model=QuickFoodList)
@limiter.limit("120/minute")
def alimentos_recentes(
    request: Request,
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Distintos por `food_ref`, do mais recente ao mais antigo. Só leitura, sem rede."""
    return QuickFoodList(items=diary_registro.recentes(db, current_user.id, limit))


@router.get("/frequent", response_model=QuickFoodList)
@limiter.limit("120/minute")
def alimentos_frequentes(
    request: Request,
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Últimos 30 dias, por contagem decrescente (empate: o mais recente primeiro)."""
    return QuickFoodList(items=diary_registro.frequentes(db, current_user.id, limit))


@router.get("/mine", response_model=UserFoodList)
@limiter.limit("120/minute")
def listar_meus_alimentos(
    request: Request,
    barcode: Optional[str] = Query(default=None, pattern=BARCODE_PATTERN),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sem `barcode`: todos, por nome. Com `barcode`: zero ou um item (contrato da
    Frente B, que procura primeiro aqui antes do Open Food Facts)."""
    if barcode is not None:
        linha = diary_registro.buscar_mine_por_barcode(db, current_user.id, barcode)
        linhas = [] if linha is None else [linha]
    else:
        linhas = diary_registro.listar_mine(db, current_user.id)
    return UserFoodList(items=[_como_resposta_mine(linha) for linha in linhas])


@router.post("/mine", response_model=UserFoodResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
def criar_meu_alimento(
    request: Request,
    payload: UserFoodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    usados = diary_registro.contar_mine(db, current_user.id)
    if usados >= diary_registro.MAX_ALIMENTOS_PESSOAIS:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_LIMIT_REACHED",
                "message": "Limite de alimentos pessoais atingido.",
                "event_type": "user_foods",
                "limit": diary_registro.MAX_ALIMENTOS_PESSOAIS,
                "used": usados,
            },
        )
    if payload.barcode is not None and diary_registro.buscar_mine_por_barcode(
        db, current_user.id, payload.barcode
    ):
        raise _barcode_em_uso()

    linha = UserFood(user_id=current_user.id, **payload.model_dump())
    db.add(linha)
    _commit_ou_409(db)
    db.refresh(linha)
    logger.info("user_food_created user_id=%s user_food_id=%s", current_user.id, linha.id)
    return _como_resposta_mine(linha)


@router.get("/mine/{food_id}", response_model=UserFoodResponse)
@limiter.limit("120/minute")
def ler_meu_alimento(
    request: Request,
    food_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    linha = diary_registro.buscar_mine(db, current_user.id, food_id)
    if linha is None:
        raise _mine_nao_encontrado()
    return _como_resposta_mine(linha)


@router.patch("/mine/{food_id}", response_model=UserFoodResponse)
@limiter.limit("60/minute")
def editar_meu_alimento(
    request: Request,
    food_id: int,
    payload: UserFoodUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Editar NÃO muda entradas já registradas: elas guardam snapshot (§ 4.4)."""
    linha = diary_registro.buscar_mine(db, current_user.id, food_id)
    if linha is None:
        raise _mine_nao_encontrado()

    mudancas = payload.model_dump(exclude_unset=True)
    novo_codigo = mudancas.get("barcode")
    if novo_codigo is not None and novo_codigo != linha.barcode:
        if diary_registro.buscar_mine_por_barcode(db, current_user.id, novo_codigo):
            raise _barcode_em_uso()
    for campo, valor in mudancas.items():
        setattr(linha, campo, valor)
    _commit_ou_409(db)
    db.refresh(linha)
    logger.info("user_food_updated user_id=%s user_food_id=%s", current_user.id, linha.id)
    return _como_resposta_mine(linha)


@router.delete("/mine/{food_id}")
@limiter.limit("60/minute")
def apagar_meu_alimento(
    request: Request,
    food_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    linha = diary_registro.buscar_mine(db, current_user.id, food_id)
    if linha is None:
        raise _mine_nao_encontrado()
    db.delete(linha)
    db.commit()
    logger.info("user_food_deleted user_id=%s user_food_id=%s", current_user.id, food_id)
    return {"ok": True}
