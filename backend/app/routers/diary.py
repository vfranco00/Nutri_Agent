"""Diário alimentar: entradas, dia composto, faixa de dias e vínculo com o cardápio.

Regras que valem para TODAS as rotas deste arquivo:

- `user_id` sai exclusivamente de `current_user.id`. Nunca vem de path, query ou corpo.
- Recurso alheio responde 404 com corpo IDÊNTICO ao de um id inexistente. Nunca 403.
  Os ids são inteiros sequenciais: um 403 significa "esse id existe e é de outra pessoa",
  e um laço de 1 a N mapeia quantas entradas existem, de quem, e — comparando ao longo do
  tempo — com que frequência cada pessoa registra comida. Num app de nutrição isso é
  inferência sobre hábito alimentar de terceiro a partir de METADADO, sem ler uma linha.
- NÃO existe cláusula `or current_user.is_superuser` aqui, e não pode passar a existir.
  Receita é conteúdo publicável e moderável; diário alimentar é prontuário. "O admin vê
  tudo" transforma qualquer conta de admin comprometida numa violação de dado de saúde
  de toda a base.
- Toda mutação devolve o `DiaryDay` recalculado: um dono da aritmética, zero refetch.
"""

import logging
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.diary import DiaryEntry, DiaryPlanBinding
from app.models.food_cache import FoodCache
from app.models.food_catalog import FoodCatalog
from app.models.meal_plan import MealPlan
from app.models.profile import Profile
from app.models.user import User
from app.schemas.diary import (
    DiaryDay,
    DiaryDaySummary,
    DiaryEntryCreate,
    DiaryEntryResponse,
    DiaryEntryUpdate,
    DiaryPlanBindingCreate,
    DiaryPlanBindingResponse,
    DiarySummaryResponse,
)
from app.services import diary_foods, diary_math, diary_plan

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_DIAS_NO_SUMMARY = 31


def _entrada_nao_encontrada() -> HTTPException:
    """Corpo único para "não existe" e para "não é seu". Um só ponto de saída."""
    return HTTPException(
        status_code=404,
        detail={"code": "ENTRY_NOT_FOUND", "message": "Entrada não encontrada"},
    )


def _teto_diario_atingido(usadas: int) -> HTTPException:
    """RS-11. Formato de `quotas.py::_limit_reached_error`, porque é o que o frontend já
    sabe tratar — mas a mensagem NÃO fala em upgrade: este é teto de SEGURANÇA, fixo e
    igual nos três planos. "Compre o Pro para registrar mais almoços" é o oposto do
    produto: o que se monetiza é a inteligência, não a digitação."""
    return HTTPException(
        status_code=403,
        detail={
            "code": "PLAN_LIMIT_REACHED",
            "message": "Limite de registros para um único dia atingido.",
            "event_type": "diary_entries_per_day",
            "limit": diary_math.MAX_ENTRADAS_POR_DIA,
            "used": usadas,
        },
    )


def _quantidade_implausivel() -> HTTPException:
    """RS-10, segunda rede. Emitido no FORMATO DE VALIDAÇÃO (detail é lista), e não como
    erro de negócio: os códigos de negócio do § 6.10 são uma lista fechada no tipo do
    frontend, e este caso não tem código lá. A mensagem é genérica (RS-27) — nunca
    "9000 g de vodka é implausível"."""
    return HTTPException(
        status_code=422,
        detail=[
            {
                "type": "value_error",
                "loc": ["body", "quantity"],
                "msg": "Quantidade implausível para uma refeição.",
            }
        ],
    )


def _buscar_entrada(db: Session, entry_id: int, user_id: int) -> DiaryEntry:
    """Escopo NA query, nunca depois dela.

    Buscar-e-depois-comparar tem dois pontos de saída distinguíveis por construção (404
    se não existe, 403 se existe e não é seu). Esta query tem um só: os dois casos
    produzem o mesmo `None`, pelo mesmo caminho. A propriedade de segurança vem da forma
    do código, não da disciplina de quem o escreve depois.
    """
    entrada = (
        db.query(DiaryEntry)
        .filter(DiaryEntry.id == entry_id, DiaryEntry.user_id == user_id)
        .first()
    )
    if entrada is None:
        raise _entrada_nao_encontrada()
    return entrada


def _resolver_food_ref(db: Session, food_ref: str, user_id: int):
    """Namespace explícito na string; nenhuma outra função resolve food_ref.

    Na branch `cache:`, o WHERE já carrega o escopo do RS-17 — um id de outro usuário é
    indistinguível de um id inexistente. Nenhuma chamada externa acontece aqui: é a
    contrapartida de o cliente mandar `food_ref` em vez de `food_name`.
    """
    if food_ref.startswith("catalog:"):
        linha = (
            db.query(FoodCatalog)
            .filter(FoodCatalog.slug == food_ref.split(":", 1)[1])
            .first()
        )
        return None if linha is None else diary_foods.opcao_do_catalogo(linha)

    bruto = food_ref.split(":", 1)[1]
    if not bruto.isdigit():
        return None
    linha = (
        db.query(FoodCache)
        .filter(
            FoodCache.id == int(bruto),
            # Escopo do RS-17 dentro da própria resolução: linha compartilhada, ou linha
            # privada do requisitante. Nunca a linha privada de outra pessoa.
            (
                FoodCache.source.in_(("taco", "curated"))
                | (FoodCache.created_by_user_id == user_id)
            ),
        )
        .first()
    )
    return None if linha is None else diary_foods.opcao_do_cache(linha)


def _contar_do_dia(db: Session, user_id: int, dia: date) -> int:
    return (
        db.query(func.count(DiaryEntry.id))
        .filter(DiaryEntry.user_id == user_id, DiaryEntry.entry_date == dia)
        .scalar()
    ) or 0


# ======================================================================================
# Rotas de caminho FIXO primeiro. Declaradas depois de `/{entry_id}`, "summary" e
# "plan-bindings" seriam capturados por ele e o FastAPI devolveria 422 tentando
# converter a string para int.
# ======================================================================================


@router.post("", response_model=DiaryDay, status_code=status.HTTP_201_CREATED)
@limiter.limit("60/minute")
def criar_entrada(
    request: Request,
    payload: DiaryEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A ordem de execução é contrato: ela decide qual erro o cliente vê."""
    # (2) resolver food_ref — validação Pydantic (1) já aconteceu
    opcao = _resolver_food_ref(db, payload.food_ref, current_user.id)
    if opcao is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "FOOD_NOT_RESOLVED",
                "message": "Alimento não encontrado.",
            },
        )

    # (3) compatibilidade unidade × alimento
    if not diary_math.unidade_compativel(payload.unit, opcao.base_unit):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "UNIT_NOT_SUPPORTED_FOR_FOOD",
                "message": "Unidade não compatível com este alimento.",
            },
        )

    # (4) teto do RS-11
    usadas = _contar_do_dia(db, current_user.id, payload.entry_date)
    if usadas >= diary_math.MAX_ENTRADAS_POR_DIA:
        raise _teto_diario_atingido(usadas)

    # (5) cálculo no servidor. RS-10: `calories_total` nunca é recebido do cliente —
    #     o `extra="forbid"` do schema já devolveu 422 se ele tentou mandar.
    kcal, proteina = diary_math.calcular(
        opcao.kcal_per_base_unit, opcao.protein_per_base_unit, payload.quantity, payload.unit
    )
    _, carbo = diary_math.calcular(
        opcao.kcal_per_base_unit, opcao.carbs_per_base_unit, payload.quantity, payload.unit
    )
    _, gordura = diary_math.calcular(
        opcao.kcal_per_base_unit, opcao.fat_per_base_unit, payload.quantity, payload.unit
    )
    if kcal > diary_math.TETO_KCAL_ENTRADA:
        raise _quantidade_implausivel()

    # (6) INSERT e recomposição do dia
    entrada = DiaryEntry(
        user_id=current_user.id,
        entry_date=payload.entry_date,
        meal_slot=payload.meal_slot,
        food_ref=payload.food_ref,
        food_name=opcao.name,
        source=opcao.source,
        base_unit=opcao.base_unit,
        quantity=payload.quantity,
        unit=payload.unit,
        kcal_per_base_unit=opcao.kcal_per_base_unit,
        protein_per_base_unit=opcao.protein_per_base_unit,
        carbs_per_base_unit=opcao.carbs_per_base_unit,
        fat_per_base_unit=opcao.fat_per_base_unit,
        calories_total=kcal,
        protein_g_total=proteina,
        carbs_g_total=carbo,
        fat_g_total=gordura,
    )
    db.add(entrada)
    db.commit()
    db.refresh(entrada)

    # RS-26: só identificadores. Nem food_name, nem quantity, nem unit, nem meal_slot,
    # nem entry_date — em nível nenhum, inclusive DEBUG.
    logger.info(
        "diary_entry_created user_id=%s entry_id=%s", current_user.id, entrada.id
    )
    return diary_plan.montar_dia(db, current_user.id, entrada.entry_date)


@router.get("", response_model=DiaryDay)
@limiter.limit("120/minute")
def ler_dia(
    request: Request,
    # Sem janela: ler o passado é legítimo. A janela do RS-09 é da ESCRITA.
    date_alvo: date = Query(alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Nunca 404: dia sem entrada e sem plano é 200 com slots vazios e totais zerados."""
    return diary_plan.montar_dia(db, current_user.id, date_alvo)


@router.get("/summary", response_model=DiarySummaryResponse)
@limiter.limit("60/minute")
def ler_faixa(
    request: Request,
    start: date = Query(),
    end: date = Query(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Alimenta a fita da semana sem 7 chamadas.

    Uma query agregada escopada por `user_id`, e a resolução de binding reaproveitada por
    dia sobre o mesmo plano já carregado — nunca uma query por dia.
    """
    if end < start or (end - start).days > MAX_DIAS_NO_SUMMARY:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "type": "value_error",
                    "loc": ["query", "end"],
                    "msg": f"O intervalo deve ser crescente e ter no máximo {MAX_DIAS_NO_SUMMARY} dias.",
                }
            ],
        )

    agregados = (
        db.query(
            DiaryEntry.entry_date,
            func.sum(DiaryEntry.calories_total),
            func.count(DiaryEntry.id),
        )
        .filter(
            DiaryEntry.user_id == current_user.id,
            DiaryEntry.entry_date >= start,
            DiaryEntry.entry_date <= end,
        )
        .group_by(DiaryEntry.entry_date)
        .all()
    )
    por_data = {linha[0]: (linha[1] or 0.0, linha[2] or 0) for linha in agregados}

    perfil = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    dias: list[DiaryDaySummary] = []
    # Itera sobre o DESLOCAMENTO, nunca acumulando em cima da própria data.
    #
    # O laço anterior (`atual = start; while atual <= end: ...; atual += timedelta(days=1)`)
    # avançava UMA vez além de `end` para poder sair. Com `end = 9999-12-31` esse passo
    # extra estoura `date.max` e levanta `OverflowError` — que não é `HTTPException`,
    # não é capturado por ninguém, e vira 500 com stack trace no coletor de log.
    # `GET /diary/summary?start=9999-12-01&end=9999-12-31` derrubava a requisição com um
    # GET autenticado sem corpo. Somar o deslocamento a `start` nunca produz data maior
    # que `end`, que já foi validado como data válida pelo próprio Pydantic.
    for deslocamento in range((end - start).days + 1):
        atual = start + timedelta(days=deslocamento)
        kcal, quantas = por_data.get(atual, (0.0, 0))
        vinculo = diary_plan.resolver_dia_do_plano(db, current_user.id, atual)
        planejado = 0.0
        if vinculo is not None:
            planejado = diary_math.somar([m.calories for m in vinculo[1].meals])
        dias.append(
            DiaryDaySummary(
                date=atual,
                # `days` traz TODAS as datas do intervalo, inclusive as sem registro —
                # o frontend não preenche buraco de calendário.
                calories=round(kcal, 1),
                planned_calories=planejado,
                entries_count=quantas,
            )
        )

    return DiarySummaryResponse(
        days=dias,
        # Fora do array porque é do usuário, não do dia.
        calories_target=perfil.daily_calories if perfil is not None else None,
    )


@router.post(
    "/plan-bindings",
    response_model=DiaryPlanBindingResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("30/minute")
def criar_vinculo(
    request: Request,
    payload: DiaryPlanBindingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Criar um vínculo NÃO apaga os anteriores: o mais recente que já começou ganha."""
    plano = (
        db.query(MealPlan)
        .filter(MealPlan.id == payload.meal_plan_id, MealPlan.user_id == current_user.id)
        .first()
    )
    if plano is None:
        # 404 e não 403, mesmo padrão de meal_plans.py:48-54.
        raise HTTPException(
            status_code=404,
            detail={
                "code": "MEAL_PLAN_NOT_FOUND",
                "message": "Cardápio não encontrado.",
            },
        )

    vinculo = DiaryPlanBinding(
        user_id=current_user.id,
        meal_plan_id=payload.meal_plan_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(vinculo)
    db.commit()
    db.refresh(vinculo)
    logger.info(
        "diary_plan_binding_created user_id=%s binding_id=%s",
        current_user.id,
        vinculo.id,
    )
    return vinculo


@router.delete("/plan-bindings/{binding_id}")
@limiter.limit("30/minute")
def apagar_vinculo(
    request: Request,
    binding_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    vinculo = (
        db.query(DiaryPlanBinding)
        .filter(
            DiaryPlanBinding.id == binding_id,
            DiaryPlanBinding.user_id == current_user.id,
        )
        .first()
    )
    if vinculo is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "BINDING_NOT_FOUND", "message": "Vínculo não encontrado."},
        )
    db.delete(vinculo)
    db.commit()
    return {"ok": True}


# ======================================================================================
# Rotas por id — depois das de caminho fixo.
# ======================================================================================


@router.get("/{entry_id}", response_model=DiaryEntryResponse)
@limiter.limit("120/minute")
def ler_entrada(
    request: Request,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return diary_plan.como_resposta(
        _buscar_entrada(db, entry_id, current_user.id)
    )


@router.patch("/{entry_id}", response_model=DiaryDay)
@limiter.limit("60/minute")
def editar_entrada(
    request: Request,
    entry_id: int,
    payload: DiaryEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recálculo a partir dos `*_per_base_unit` JÁ PERSISTIDOS na linha.

    Sem consultar `food_catalog`, `food_cache`, LLM ou rede: um alimento cujo valor foi
    corrigido no catálogo depois não pode mudar por causa de um PATCH de quantidade.
    """
    entrada = _buscar_entrada(db, entry_id, current_user.id)

    nova_unidade = payload.unit if payload.unit is not None else entrada.unit
    # Revalidada contra o base_unit persistido NA ENTRADA, não contra a fonte.
    if not diary_math.unidade_compativel(nova_unidade, entrada.base_unit):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "UNIT_NOT_SUPPORTED_FOR_FOOD",
                "message": "Unidade não compatível com este alimento.",
            },
        )

    nova_data = payload.entry_date if payload.entry_date is not None else entrada.entry_date
    if nova_data != entrada.entry_date:
        usadas = _contar_do_dia(db, current_user.id, nova_data)
        if usadas >= diary_math.MAX_ENTRADAS_POR_DIA:
            raise _teto_diario_atingido(usadas)

    nova_quantidade = payload.quantity if payload.quantity is not None else entrada.quantity

    kcal, proteina = diary_math.calcular(
        entrada.kcal_per_base_unit, entrada.protein_per_base_unit, nova_quantidade, nova_unidade
    )
    _, carbo = diary_math.calcular(
        entrada.kcal_per_base_unit, entrada.carbs_per_base_unit, nova_quantidade, nova_unidade
    )
    _, gordura = diary_math.calcular(
        entrada.kcal_per_base_unit, entrada.fat_per_base_unit, nova_quantidade, nova_unidade
    )
    if kcal > diary_math.TETO_KCAL_ENTRADA:
        raise _quantidade_implausivel()

    entrada.entry_date = nova_data
    entrada.meal_slot = payload.meal_slot if payload.meal_slot is not None else entrada.meal_slot
    entrada.quantity = nova_quantidade
    entrada.unit = nova_unidade
    entrada.calories_total = kcal
    entrada.protein_g_total = proteina
    entrada.carbs_g_total = carbo
    entrada.fat_g_total = gordura
    db.commit()
    db.refresh(entrada)

    logger.info("diary_entry_updated user_id=%s entry_id=%s", current_user.id, entrada.id)
    # Se `entry_date` mudou, o DiaryDay é o da DATA NOVA — a interface navega para ela.
    return diary_plan.montar_dia(db, current_user.id, entrada.entry_date)


@router.delete("/{entry_id}", response_model=DiaryDay)
@limiter.limit("60/minute")
def apagar_entrada(
    request: Request,
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """200 e não 204: a barra precisa do total novo, e um 204 forçaria um GET logo em
    seguida — a chamada extra que o desenho da tela existe para evitar."""
    entrada = _buscar_entrada(db, entry_id, current_user.id)
    dia = entrada.entry_date
    db.delete(entrada)
    db.commit()
    logger.info("diary_entry_deleted user_id=%s entry_id=%s", current_user.id, entry_id)
    return diary_plan.montar_dia(db, current_user.id, dia)
