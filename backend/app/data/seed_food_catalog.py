"""Sincroniza `food_catalog` a partir de `taco_foods.py`. Idempotente.

Não semeia dentro da migration de propósito: migration que importa código de aplicação
quebra retroativamente quando o código muda, e este dado muda por CURADORIA, não por
schema. Quem chama é o `lifespan` do main.py (uma vez por processo) e a fixture de teste.
"""

import logging

from sqlalchemy.orm import Session

from app.data.taco_foods import TACO_DATASET_VERSION, TACO_FOODS, TacoFood
from app.models.food_catalog import FoodCatalog

logger = logging.getLogger(__name__)


def _por_unidade_base(valor: float | None, base_unit: str) -> float | None:
    """A divisão por 100 acontece AQUI e em nenhum outro lugar (§ 4.0 do ADR-0001).

    "por 100 g" e "por unidade" convivendo em tabelas diferentes é a origem clássica do
    erro de fator 100 em app de nutrição — e ele não aparece em teste feliz, aparece como
    128 kcal virando 12800.

    Arredonda em 6 casas na ORIGEM, não na saída: 128/100 = 1.28 é exato, mas 93/100 em
    float binário carrega ruído que, multiplicado por 9.000 g, aparece na primeira casa.
    """
    if valor is None:
        return None
    if base_unit == "un":
        return valor  # já é por 1 unidade
    return round(valor / 100, 6)


def _linha(food: TacoFood) -> dict:
    return {
        "slug": food.slug,
        "name": food.name,
        "name_normalized": food.name_normalized,
        "base_unit": food.base_unit,
        "kcal_per_base_unit": _por_unidade_base(food.kcal_per_100, food.base_unit),
        "protein_per_base_unit": _por_unidade_base(food.protein_g_per_100, food.base_unit),
        "carbs_per_base_unit": _por_unidade_base(food.carbs_g_per_100, food.base_unit),
        "fat_per_base_unit": _por_unidade_base(food.fat_g_per_100, food.base_unit),
        "dataset_version": TACO_DATASET_VERSION,
    }


def sync_food_catalog(db: Session) -> int:
    """Devolve quantas linhas foram escritas ou apagadas. 0 = já estava sincronizado."""
    ja_ok = (
        db.query(FoodCatalog)
        .filter(FoodCatalog.dataset_version == TACO_DATASET_VERSION)
        .count()
    )
    if ja_ok == len(TACO_FOODS):
        return 0  # caminho normal: 1 COUNT e volta

    existentes = {linha.slug: linha for linha in db.query(FoodCatalog).all()}
    tocadas = 0

    for food in TACO_FOODS:
        dados = _linha(food)
        atual = existentes.pop(food.slug, None)
        if atual is None:
            db.add(FoodCatalog(**dados))
            tocadas += 1
            continue
        if any(getattr(atual, campo) != valor for campo, valor in dados.items()):
            for campo, valor in dados.items():
                setattr(atual, campo, valor)
            tocadas += 1

    # Slug que saiu do arquivo sai da tabela: sem isso, um alimento removido por
    # curadoria continuaria pesquisável e registrável para sempre.
    for orfa in existentes.values():
        db.delete(orfa)
        tocadas += 1

    db.commit()
    logger.info(
        "food_catalog sincronizado dataset_version=%s linhas_tocadas=%s",
        TACO_DATASET_VERSION,
        tocadas,
    )
    return tocadas
