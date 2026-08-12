"""Composição do dia: entradas registradas + cardápio planejado, lado a lado.

`diary_entries` e `meal_plans` são entidades distintas que NUNCA se referenciam (§ 3.2
do ADR-0001). O diário é o fato; o plano é a intenção. Ligá-los por FK obrigaria a
decidir "esta entrada cumpre aquela refeição?", que é uma pergunta de produto que
ninguém fez. O cruzamento acontece aqui, na leitura, por data e por slot.
"""

from datetime import date
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.normalize import normalize_food_name
from app.models.diary import DiaryEntry, DiaryPlanBinding
from app.models.meal_plan import MealPlanDay
from app.models.profile import Profile
from app.schemas.diary import (
    DiaryBoundPlan,
    DiaryDay,
    DiaryDaySlot,
    DiaryEntryResponse,
    DiaryPlannedMeal,
    DiaryTotals,
)
from app.services import diary_math

# `slot_name` do cardápio é String livre (texto que a IA gerou). A tabela é aplicada
# sobre normalize_food_name(slot_name). Qualquer valor fora dela cai em
# `planned_unmatched_calories` — NUNCA é chutado num slot.
_SLOT_POR_NOME: dict[str, str] = {
    "cafe da manha": "cafe_da_manha",
    "cafe": "cafe_da_manha",
    "desjejum": "cafe_da_manha",
    "lanche da manha": "lanche_manha",
    "lanche manha": "lanche_manha",
    "almoco": "almoco",
    "lanche da tarde": "lanche_tarde",
    "lanche tarde": "lanche_tarde",
    # `lanche` sozinho vai para a tarde porque a estrutura de 4 refeições do
    # generate_meal_plan é "Café da Manhã, Almoço, Lanche da Tarde, Jantar": o lanche
    # genérico é o da tarde em 100% dos cardápios gerados hoje.
    "lanche": "lanche_tarde",
    "jantar": "jantar",
    "janta": "jantar",
    "ceia": "ceia",
}


def mapear_slot(slot_name: str) -> Optional[str]:
    return _SLOT_POR_NOME.get(normalize_food_name(slot_name or ""))


def resolver_dia_do_plano(
    db: Session, user_id: int, alvo: date
) -> Optional[tuple[DiaryPlanBinding, MealPlanDay]]:
    """"Qual dia do plano cai na data D" — aritmética de inteiros, sem query extra.

    Sem constraint de não sobreposição (EXCLUDE exige btree_gist e não existe em SQLite):
    o desempate é `start_date DESC, id DESC` — "o vínculo mais recente que já começou
    ganha". Determinístico e testável, que resolve o mesmo problema no lugar certo.
    """
    binding = (
        db.query(DiaryPlanBinding)
        .options(joinedload(DiaryPlanBinding.meal_plan))
        .filter(
            DiaryPlanBinding.user_id == user_id,
            DiaryPlanBinding.start_date <= alvo,
            or_(
                DiaryPlanBinding.end_date.is_(None),
                DiaryPlanBinding.end_date >= alvo,
            ),
        )
        .order_by(DiaryPlanBinding.start_date.desc(), DiaryPlanBinding.id.desc())
        .first()
    )
    if binding is None or binding.meal_plan is None:
        return None

    dias = binding.meal_plan.days  # já ordenado por day_index no relationship
    if not dias:
        return None

    return binding, dias[(alvo - binding.start_date).days % len(dias)]


def _planejado_por_slot(dia_do_plano: Optional[MealPlanDay]):
    """Devolve (mapa slot→refeições, total planejado, calorias de slot não reconhecido)."""
    por_slot: dict[str, list[DiaryPlannedMeal]] = {s: [] for s in diary_math.MEAL_SLOT_ORDER}
    total = 0.0
    nao_mapeadas = 0.0
    if dia_do_plano is None:
        return por_slot, total, nao_mapeadas

    for refeicao in dia_do_plano.meals:
        kcal = refeicao.calories or 0.0
        total += kcal
        slot = mapear_slot(refeicao.slot_name)
        if slot is None:
            nao_mapeadas += kcal
            continue
        titulo = refeicao.custom_title or (
            refeicao.recipe.title if refeicao.recipe is not None else refeicao.slot_name
        )
        por_slot[slot].append(
            DiaryPlannedMeal(
                id=refeicao.id,
                title=titulo,
                calories=refeicao.calories,
                recipe_id=refeicao.recipe_id,
            )
        )
    return por_slot, round(total, 1), round(nao_mapeadas, 1)


def montar_dia(db: Session, user_id: int, alvo: date) -> DiaryDay:
    """≤ 5 queries e UMA chamada HTTP desenham a tela do dia inteira.

    O pool tem 5+5 conexões por processo e o APScheduler disputa o mesmo: uma query por
    slot não cabe. Nenhuma query aqui roda dentro de laço.
    """
    # (1) entradas — user_id e data na MESMA cláusula (RS-05). O total sai deste conjunto,
    #     nunca de um conjunto trazido sem escopo.
    entradas = (
        db.query(DiaryEntry)
        .filter(DiaryEntry.user_id == user_id, DiaryEntry.entry_date == alvo)
        .order_by(DiaryEntry.created_at, DiaryEntry.id)
        .all()
    )

    # (2) meta calórica — profiles.daily_calories, NÃO MealPlanDay.calories_target
    perfil = db.query(Profile).filter(Profile.user_id == user_id).first()
    calories_target = perfil.daily_calories if perfil is not None else None

    # (3-4) binding + dia do plano com joinedload das refeições
    vinculo = resolver_dia_do_plano(db, user_id, alvo)
    binding, dia_do_plano = vinculo if vinculo is not None else (None, None)
    planejado, planned_calories_total, nao_mapeadas = _planejado_por_slot(dia_do_plano)

    por_slot: dict[str, list[DiaryEntry]] = {s: [] for s in diary_math.MEAL_SLOT_ORDER}
    for entrada in entradas:
        # Slot fora das 6 chaves não existe: o Literal do schema barra na escrita. Se
        # aparecer (dado escrito antes deste código), fica fora da tela em vez de derrubar
        # a resposta inteira.
        por_slot.setdefault(entrada.meal_slot, []).append(entrada)

    slots = [
        DiaryDaySlot(
            slot=chave,
            label=diary_math.MEAL_SLOT_LABELS[chave],
            logged_calories=diary_math.somar([e.calories_total for e in por_slot[chave]]),
            planned_calories=diary_math.somar(
                [m.calories for m in planejado[chave]]
            ),
            entries=[como_resposta(e) for e in por_slot[chave]],
            planned_meals=planejado[chave],
        )
        for chave in diary_math.MEAL_SLOT_ORDER
    ]

    macros_incomplete = any(
        e.protein_g_total is None or e.carbs_g_total is None or e.fat_g_total is None
        for e in entradas
    )

    return DiaryDay(
        date=alvo,
        calories_target=calories_target,
        totals=DiaryTotals(
            calories=diary_math.somar([e.calories_total for e in entradas]),
            protein_g=diary_math.somar_macro([e.protein_g_total for e in entradas]),
            carbs_g=diary_math.somar_macro([e.carbs_g_total for e in entradas]),
            fat_g=diary_math.somar_macro([e.fat_g_total for e in entradas]),
        ),
        planned_totals=DiaryTotals(
            calories=planned_calories_total,
            # SEMPRE null na v1: MealPlanDay guarda macro como texto livre
            # (macros_protein: String, ex. "120g"). Parsear string de IA para número é
            # inventar dado. O campo existe para não quebrar o tipo quando isso mudar.
            protein_g=None,
            carbs_g=None,
            fat_g=None,
        ),
        planned_unmatched_calories=nao_mapeadas,
        entries_count=len(entradas),
        has_estimate=any(e.source in ("openfoodfacts", "llm") for e in entradas),
        macros_incomplete=macros_incomplete,
        meal_plan=(
            None
            if binding is None or dia_do_plano is None
            else DiaryBoundPlan(
                binding_id=binding.id,
                meal_plan_id=binding.meal_plan_id,
                title=binding.meal_plan.title,
                day_label=dia_do_plano.day_label,
                day_index=dia_do_plano.day_index,
            )
        ),
        slots=slots,
    )


def como_resposta(entrada: DiaryEntry) -> DiaryEntryResponse:
    return DiaryEntryResponse(
        id=entrada.id,
        entry_date=entrada.entry_date,
        meal_slot=entrada.meal_slot,
        food_ref=entrada.food_ref,
        food_name=entrada.food_name,
        quantity=entrada.quantity,
        unit=entrada.unit,
        base_unit=entrada.base_unit,
        calories_total=entrada.calories_total,
        protein_g_total=entrada.protein_g_total,
        carbs_g_total=entrada.carbs_g_total,
        fat_g_total=entrada.fat_g_total,
        source=entrada.source,
        is_estimate=entrada.source in ("openfoodfacts", "llm"),
        created_at=entrada.created_at,
        updated_at=entrada.updated_at,
    )
