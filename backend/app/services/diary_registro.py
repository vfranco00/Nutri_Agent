"""Registro rápido do diário: alimento pessoal, receita, recentes, cópia e refeição pronta.

Nada aqui chama LLM nem rede externa (ADR-0001, D-5): são SELECTs escopados e INSERTs de
snapshot. O escopo do usuário mora no WHERE de cada query, nunca depois dela (RS-03).

RS-26: nenhum log daqui recebe nome de alimento, código de barras ou quantidade.
"""

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.recipe import Recipe
from app.models.user_food import UserFood
from app.schemas.diary import FoodOption
from app.services import diary_math

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
    kcal = receita.calories
    if kcal is None:
        kcal = (
            db.query(func.sum(Ingredient.calories))
            .filter(Ingredient.recipe_id == receita.id)
            .scalar()
        )
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
