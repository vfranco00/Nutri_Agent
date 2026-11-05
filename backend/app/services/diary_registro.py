"""Registro rápido do diário: alimento pessoal, receita, recentes, cópia e refeição pronta.

Nada aqui chama LLM nem rede externa (ADR-0001, D-5): são SELECTs escopados e INSERTs de
snapshot. O escopo do usuário mora no WHERE de cada query, nunca depois dela (RS-03).

RS-26: nenhum log daqui recebe nome de alimento, código de barras ou quantidade.
"""

from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.diary import DiaryEntry
from app.models.food_cache import FoodCache
from app.models.food_catalog import FoodCatalog
from app.models.ingredient import Ingredient
from app.models.saved_meal import SavedMeal, SavedMealItem
from app.models.recipe import Recipe
from app.models.user_food import UserFood
from app.schemas.diary import FoodOption
from app.schemas.diary_registro import (
    QuickFood,
    SavedMealItemResponse,
    SavedMealResponse,
)
from app.services import diary_foods, diary_math

# Teto de SEGURANÇA, não comercial: alimento pessoal é escrita do usuário no banco, e sem
# teto é armazenamento ilimitado por conta. 500 é muito acima de qualquer despensa real.
MAX_ALIMENTOS_PESSOAIS = 500


def mine_ref(food_id: int) -> str:
    return f"mine:{food_id}"


def opcao_do_mine(linha: UserFood) -> FoodOption:
    """FoodOption de um alimento pessoal. Valores POR PORÇÃO: `base_unit = "un"`.

    A Frente B (código de barras) devolve esta mesma opção quando o código bate com um
    alimento do usuário.
    """
    return FoodOption(
        food_ref=mine_ref(linha.id),
        name=linha.name,
        base_unit="un",
        kcal_per_base_unit=linha.kcal,
        protein_per_base_unit=linha.protein_g,
        carbs_per_base_unit=linha.carbs_g,
        fat_per_base_unit=linha.fat_g,
        allowed_units=diary_math.allowed_units("un"),
        source="user",
        is_estimate=False,
        portion_label=linha.portion_label,
    )


def buscar_mine(db: Session, user_id: int, food_id: int) -> Optional[UserFood]:
    """Alheio e inexistente devolvem o mesmo `None`, pela mesma query."""
    return (
        db.query(UserFood)
        .filter(UserFood.id == food_id, UserFood.user_id == user_id)
        .first()
    )


def buscar_mine_por_barcode(db: Session, user_id: int, barcode: str) -> Optional[UserFood]:
    return (
        db.query(UserFood)
        .filter(UserFood.user_id == user_id, UserFood.barcode == barcode)
        .first()
    )


def listar_mine(db: Session, user_id: int) -> list[UserFood]:
    return (
        db.query(UserFood)
        .filter(UserFood.user_id == user_id)
        .order_by(UserFood.name, UserFood.id)
        .all()
    )


def contar_mine(db: Session, user_id: int) -> int:
    return db.query(UserFood).filter(UserFood.user_id == user_id).count()


def opcao_do_mine_por_barcode(
    db: Session, user_id: int, barcode: str
) -> Optional[FoodOption]:
    """Assinatura exata do gancho `openfoodfacts.buscar_no_mine` da Frente B."""
    linha = buscar_mine_por_barcode(db, user_id, barcode)
    return None if linha is None else opcao_do_mine(linha)


# --------------------------------------------------------------------------------------
# Receita (`recipe:<id>`)
# --------------------------------------------------------------------------------------


def recipe_ref(recipe_id: int) -> str:
    return f"recipe:{recipe_id}"


def _opcao_receita(receita: Recipe, soma_ingredientes: Optional[float]) -> Optional[FoodOption]:
    kcal = receita.calories if receita.calories is not None else soma_ingredientes
    if kcal is None or kcal <= 0:
        return None
    return FoodOption(
        food_ref=recipe_ref(receita.id),
        name=receita.title[:120],
        base_unit="un",
        kcal_per_base_unit=float(kcal),
        allowed_units=diary_math.allowed_units("un"),
        source="recipe",
        is_estimate=False,
        portion_label="porção",
    )


def opcao_da_receita(db: Session, user_id: int, recipe_id: int) -> Optional[FoodOption]:
    """FoodOption de UMA PORÇÃO da receita (a receita não tem rendimento).

    Escopo no WHERE: receita própria ou pública. Privada alheia e inexistente dão o mesmo
    None. Sem kcal > 0 (nem `calories`, nem soma dos ingredientes) não resolve: gravar
    "0 kcal" seria uma afirmação nutricional falsa. Macros ficam None (desconhecidos).
    """
    receita = (
        db.query(Recipe)
        .filter(
            Recipe.id == recipe_id,
            (Recipe.user_id == user_id) | (Recipe.is_public.is_(True)),
        )
        .first()
    )
    if receita is None:
        return None
    soma = None
    if receita.calories is None:
        soma = (
            db.query(func.sum(Ingredient.calories))
            .filter(Ingredient.recipe_id == receita.id)
            .scalar()
        )
    return _opcao_receita(receita, soma)


# --------------------------------------------------------------------------------------
# Resolução em lote, recentes e frequentes
# --------------------------------------------------------------------------------------

JANELA_FREQUENTES_DIAS = 30
# Teto de linhas lidas por consulta de recentes: o ref que não resolve é descartado, então
# lemos mais do que `limit`, mas nunca o histórico inteiro.
MAX_LINHAS_RECENTES = 400


def resolver_refs(db: Session, user_id: int, refs: list[str]) -> dict[str, FoodOption]:
    """Resolve vários `food_ref` com UMA query por namespace (nunca por item).

    Mesmo escopo de `_resolver_food_ref`: `mine`/`recipe` pelo dono (ou pública), `cache`
    compartilhado ou do requisitante. Ref que não resolve simplesmente não entra no dict.
    """
    slugs: list[str] = []
    ids: dict[str, list[int]] = {"mine": [], "cache": [], "recipe": []}
    for ref in set(refs):
        namespace, _, bruto = ref.partition(":")
        if namespace == "catalog" and bruto:
            slugs.append(bruto)
        elif namespace in ids and bruto.isdigit():
            ids[namespace].append(int(bruto))

    saida: dict[str, FoodOption] = {}
    if slugs:
        for linha in db.query(FoodCatalog).filter(FoodCatalog.slug.in_(slugs)).all():
            opcao = diary_foods.opcao_do_catalogo(linha)
            saida[opcao.food_ref] = opcao
    if ids["mine"]:
        for linha in (
            db.query(UserFood)
            .filter(UserFood.user_id == user_id, UserFood.id.in_(ids["mine"]))
            .all()
        ):
            saida[mine_ref(linha.id)] = opcao_do_mine(linha)
    if ids["cache"]:
        for linha in (
            db.query(FoodCache)
            .filter(
                FoodCache.id.in_(ids["cache"]),
                (
                    FoodCache.source.in_(("taco", "curated"))
                    | (FoodCache.created_by_user_id == user_id)
                ),
            )
            .all()
        ):
            opcao = diary_foods.opcao_do_cache(linha)
            if opcao is not None:
                saida[opcao.food_ref] = opcao
    if ids["recipe"]:
        receitas = (
            db.query(Recipe)
            .filter(
                Recipe.id.in_(ids["recipe"]),
                (Recipe.user_id == user_id) | (Recipe.is_public.is_(True)),
            )
            .all()
        )
        somas = dict(
            db.query(Ingredient.recipe_id, func.sum(Ingredient.calories))
            .filter(Ingredient.recipe_id.in_([r.id for r in receitas]))
            .group_by(Ingredient.recipe_id)
            .all()
        ) if receitas else {}
        for r in receitas:
            opcao = _opcao_receita(r, somas.get(r.id))
            if opcao is not None:
                saida[opcao.food_ref] = opcao
    return saida


def _hoje_utc() -> date:
    return datetime.now(timezone.utc).date()


def _agrupar(db: Session, user_id: int, desde: Optional[date]) -> list[tuple[DiaryEntry, int]]:
    """Uma consulta escopada; devolve (entrada mais recente do ref, contagem) em ordem de
    recência. Dedupe em memória sobre no máximo `MAX_LINHAS_RECENTES` linhas."""
    q = db.query(DiaryEntry).filter(DiaryEntry.user_id == user_id)
    if desde is not None:
        q = q.filter(DiaryEntry.entry_date >= desde)
    linhas = (
        q.order_by(DiaryEntry.entry_date.desc(), DiaryEntry.id.desc())
        .limit(MAX_LINHAS_RECENTES)
        .all()
    )
    ordem: list[str] = []
    mais_recente: dict[str, DiaryEntry] = {}
    contagem: dict[str, int] = {}
    for linha in linhas:
        if linha.food_ref not in mais_recente:
            mais_recente[linha.food_ref] = linha
            ordem.append(linha.food_ref)
        contagem[linha.food_ref] = contagem.get(linha.food_ref, 0) + 1
    return [(mais_recente[r], contagem[r]) for r in ordem]


def _montar_quick(
    db: Session, user_id: int, grupos: list[tuple[DiaryEntry, int]], limit: int
) -> list[QuickFood]:
    opcoes = resolver_refs(db, user_id, [e.food_ref for e, _ in grupos])
    itens: list[QuickFood] = []
    for entrada, vezes in grupos:
        opcao = opcoes.get(entrada.food_ref)
        if opcao is None:
            continue
        itens.append(
            QuickFood(
                food=opcao,
                quantity=entrada.quantity,
                unit=entrada.unit,
                meal_slot=entrada.meal_slot,
                count=vezes,
            )
        )
        if len(itens) == limit:
            break
    return itens


def recentes(db: Session, user_id: int, limit: int) -> list[QuickFood]:
    return _montar_quick(db, user_id, _agrupar(db, user_id, None), limit)


def frequentes(db: Session, user_id: int, limit: int) -> list[QuickFood]:
    desde = _hoje_utc() - timedelta(days=JANELA_FREQUENTES_DIAS)
    grupos = _agrupar(db, user_id, desde)
    # sort estável: no empate de contagem, fica a ordem de recência
    grupos.sort(key=lambda g: -g[1])
    return _montar_quick(db, user_id, grupos, limit)


# --------------------------------------------------------------------------------------
# Copiar / repetir dia
# --------------------------------------------------------------------------------------


class TetoDiarioEstourado(Exception):
    """O dia de destino passaria de `MAX_ENTRADAS_POR_DIA` (RS-11). Nada foi gravado."""

    def __init__(self, usadas: int):
        super().__init__(usadas)
        self.usadas = usadas


def contar_do_dia(db: Session, user_id: int, dia: date) -> int:
    return (
        db.query(func.count(DiaryEntry.id))
        .filter(DiaryEntry.user_id == user_id, DiaryEntry.entry_date == dia)
        .scalar()
    ) or 0


def _origens_ja_copiadas(db: Session, user_id: int, to_date: date, ids: list[int]) -> set[int]:
    if not ids:
        return set()
    linhas = (
        db.query(DiaryEntry.copied_from_entry_id)
        .filter(
            DiaryEntry.user_id == user_id,
            DiaryEntry.entry_date == to_date,
            DiaryEntry.copied_from_entry_id.in_(ids),
        )
        .all()
    )
    return {l[0] for l in linhas}


def _clonar(origem: DiaryEntry, to_date: date) -> DiaryEntry:
    """Copia o SNAPSHOT (não resolve o `food_ref` de novo): sem rede e sem depender de o
    alimento ainda existir."""
    return DiaryEntry(
        user_id=origem.user_id,
        entry_date=to_date,
        meal_slot=origem.meal_slot,
        food_ref=origem.food_ref,
        food_name=origem.food_name,
        source=origem.source,
        base_unit=origem.base_unit,
        quantity=origem.quantity,
        unit=origem.unit,
        kcal_per_base_unit=origem.kcal_per_base_unit,
        protein_per_base_unit=origem.protein_per_base_unit,
        carbs_per_base_unit=origem.carbs_per_base_unit,
        fat_per_base_unit=origem.fat_per_base_unit,
        calories_total=origem.calories_total,
        protein_g_total=origem.protein_g_total,
        carbs_g_total=origem.carbs_g_total,
        fat_g_total=origem.fat_g_total,
        copied_from_entry_id=origem.id,
    )


def copiar_dia(
    db: Session,
    user_id: int,
    from_date: date,
    to_date: date,
    meal_slot: Optional[str] = None,
) -> int:
    """Copia as entradas de `from_date` (ou só de um slot) para `to_date`. Devolve quantas
    foram criadas.

    Idempotente: origens já copiadas para o destino são puladas, e o índice único
    `(user_id, entry_date, copied_from_entry_id)` fecha a corrida entre duas abas — o
    `IntegrityError` dá rollback e a cópia roda UMA vez mais, quando tudo já existe.
    Atômica: estourar o teto do dia não grava nada.
    """
    for _ in range(2):
        q = db.query(DiaryEntry).filter(
            DiaryEntry.user_id == user_id, DiaryEntry.entry_date == from_date
        )
        if meal_slot is not None:
            q = q.filter(DiaryEntry.meal_slot == meal_slot)
        origens = q.order_by(DiaryEntry.id).all()
        ja = _origens_ja_copiadas(db, user_id, to_date, [o.id for o in origens])
        novas = [o for o in origens if o.id not in ja]
        if not novas:
            return 0
        usadas = contar_do_dia(db, user_id, to_date)
        if usadas + len(novas) > diary_math.MAX_ENTRADAS_POR_DIA:
            raise TetoDiarioEstourado(usadas)
        for origem in novas:
            db.add(_clonar(origem, to_date))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            continue
        return len(novas)
    return 0


# --------------------------------------------------------------------------------------
# Refeições prontas
# --------------------------------------------------------------------------------------

MAX_REFEICOES_PRONTAS = 100


class RefeicaoVazia(Exception):
    """Nada no slot para salvar."""


class TetoRefeicoesProntas(Exception):
    """O usuário já tem `MAX_REFEICOES_PRONTAS`."""


def _kcal_do_item(item: SavedMealItem) -> float:
    kcal, _ = diary_math.calcular(item.kcal_per_base_unit, None, item.quantity, item.unit)
    return kcal


def como_resposta_refeicao(refeicao: SavedMeal) -> SavedMealResponse:
    itens = [
        SavedMealItemResponse(
            food_ref=i.food_ref,
            food_name=i.food_name,
            quantity=i.quantity,
            unit=i.unit,
            calories=_kcal_do_item(i),
        )
        for i in refeicao.items
    ]
    return SavedMealResponse(
        id=refeicao.id,
        name=refeicao.name,
        calories=diary_math.somar([i.calories for i in itens]),
        items=itens,
        created_at=refeicao.created_at,
    )


def listar_refeicoes(db: Session, user_id: int) -> list[SavedMeal]:
    return (
        db.query(SavedMeal)
        .filter(SavedMeal.user_id == user_id)
        .order_by(SavedMeal.name, SavedMeal.id)
        .all()
    )


def buscar_refeicao(db: Session, user_id: int, meal_id: int) -> Optional[SavedMeal]:
    """Alheia e inexistente dão o mesmo `None`, pela mesma query."""
    return (
        db.query(SavedMeal)
        .filter(SavedMeal.id == meal_id, SavedMeal.user_id == user_id)
        .first()
    )


def salvar_refeicao(
    db: Session, user_id: int, name: str, entry_date: date, meal_slot: str
) -> SavedMeal:
    entradas = (
        db.query(DiaryEntry)
        .filter(
            DiaryEntry.user_id == user_id,
            DiaryEntry.entry_date == entry_date,
            DiaryEntry.meal_slot == meal_slot,
        )
        .order_by(DiaryEntry.id)
        .all()
    )
    if not entradas:
        raise RefeicaoVazia()
    total = db.query(func.count(SavedMeal.id)).filter(SavedMeal.user_id == user_id).scalar() or 0
    if total >= MAX_REFEICOES_PRONTAS:
        raise TetoRefeicoesProntas()
    refeicao = SavedMeal(user_id=user_id, name=name)
    for posicao, e in enumerate(entradas):
        refeicao.items.append(
            SavedMealItem(
                position=posicao,
                food_ref=e.food_ref,
                food_name=e.food_name,
                source=e.source,
                base_unit=e.base_unit,
                quantity=e.quantity,
                unit=e.unit,
                kcal_per_base_unit=e.kcal_per_base_unit,
                protein_per_base_unit=e.protein_per_base_unit,
                carbs_per_base_unit=e.carbs_per_base_unit,
                fat_per_base_unit=e.fat_per_base_unit,
            )
        )
    db.add(refeicao)
    db.commit()
    db.refresh(refeicao)
    return refeicao


def registrar_refeicao(
    db: Session, user_id: int, refeicao: SavedMeal, entry_date: date, meal_slot: str
) -> int:
    """Grava todos os itens no dia/slot, recalculando os totais a partir do snapshot.
    Atômico: estourar o teto do dia não grava nada."""
    usadas = contar_do_dia(db, user_id, entry_date)
    if usadas + len(refeicao.items) > diary_math.MAX_ENTRADAS_POR_DIA:
        raise TetoDiarioEstourado(usadas)
    for i in refeicao.items:
        kcal, proteina = diary_math.calcular(
            i.kcal_per_base_unit, i.protein_per_base_unit, i.quantity, i.unit
        )
        _, carbo = diary_math.calcular(
            i.kcal_per_base_unit, i.carbs_per_base_unit, i.quantity, i.unit
        )
        _, gordura = diary_math.calcular(
            i.kcal_per_base_unit, i.fat_per_base_unit, i.quantity, i.unit
        )
        db.add(
            DiaryEntry(
                user_id=user_id,
                entry_date=entry_date,
                meal_slot=meal_slot,
                food_ref=i.food_ref,
                food_name=i.food_name,
                source=i.source,
                base_unit=i.base_unit,
                quantity=i.quantity,
                unit=i.unit,
                kcal_per_base_unit=i.kcal_per_base_unit,
                protein_per_base_unit=i.protein_per_base_unit,
                carbs_per_base_unit=i.carbs_per_base_unit,
                fat_per_base_unit=i.fat_per_base_unit,
                calories_total=kcal,
                protein_g_total=proteina,
                carbs_g_total=carbo,
                fat_g_total=gordura,
            )
        )
    db.commit()
    return len(refeicao.items)
