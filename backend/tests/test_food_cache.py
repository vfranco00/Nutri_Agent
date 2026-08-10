"""Regressão da chave do cache de alimentos.

O cache é lido por (name, unit_type) em services/ai.py, mas o unique da tabela estava
só em `name`. O bug não aparecia como erro: o INSERT do segundo par violava o unique,
o `except Exception` do serviço engolia e dava rollback, e aquele alimento passava a ir
pro Gemini em toda consulta — custo silencioso e permanente. Estes testes travam a
chave nas duas direções.
"""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.food_cache import FoodCache


def test_same_food_can_be_cached_in_two_different_units(db_session):
    """O caso que o unique antigo quebrava: mesmo alimento, unidades diferentes."""
    db_session.add(FoodCache(name="ovo", calories_per_unit=1.43, unit_type="g"))
    db_session.add(FoodCache(name="ovo", calories_per_unit=71.5, unit_type="un"))
    db_session.commit()

    linhas = db_session.query(FoodCache).filter(FoodCache.name == "ovo").all()
    assert len(linhas) == 2
    assert {l.unit_type for l in linhas} == {"g", "un"}

    # E cada par devolve a sua própria caloria — não a do outro.
    por_unidade = {l.unit_type: l.calories_per_unit for l in linhas}
    assert por_unidade["g"] == 1.43
    assert por_unidade["un"] == 71.5


def test_same_food_and_unit_still_cannot_duplicate(db_session):
    """A troca não pode ter afrouxado demais: (name, unit_type) segue único.

    Sem isto, o cache acumularia linhas repetidas do mesmo par e a leitura passaria a
    depender da ordem de inserção.
    """
    db_session.add(FoodCache(name="arroz", calories_per_unit=1.28, unit_type="g"))
    db_session.commit()

    db_session.add(FoodCache(name="arroz", calories_per_unit=9.99, unit_type="g"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_different_foods_are_independent(db_session):
    """Guarda contra o erro oposto: um unique composto errado poderia colidir nomes."""
    db_session.add(FoodCache(name="ovo", calories_per_unit=1.43, unit_type="g"))
    db_session.add(FoodCache(name="pão", calories_per_unit=2.7, unit_type="g"))
    db_session.commit()

    assert db_session.query(FoodCache).count() == 2
