"""Regressão da chave do cache de alimentos.

O cache é lido por (name_normalized, unit_type) em services/ai.py, mas o unique da tabela
estava só em `name`. O bug não aparecia como erro: o INSERT do segundo par violava o unique,
o `except Exception` do serviço engolia e dava rollback, e aquele alimento passava a ir
pro Gemini em toda consulta — custo silencioso e permanente.

O unique global `uq_food_cache_name_unit_type` foi substituído por DOIS índices únicos
parciais quando o RS-17 particionou a tabela por procedência (ADR-0001 § 4.3, divergência
Δ2). Os três primeiros testes travam a chave nas mesmas duas direções de antes; os últimos
travam a partição, que é o que a troca de índice introduziu.

`name_normalized` e `source` são NOT NULL: toda linha precisa de chave de leitura e de
procedência. Os dois escritores de produção (services/ai.py e services/diary_foods.py)
preenchem ambos — estes testes constroem as linhas do mesmo jeito.
"""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.food_cache import FoodCache
from app.models.user import User


def _taco(name, normalized, kcal, unit):
    """Linha compartilhada (created_by_user_id NULL) — cai no índice `uq_food_cache_shared`."""
    return FoodCache(
        name=name,
        name_normalized=normalized,
        calories_per_unit=kcal,
        unit_type=unit,
        source="taco",
    )


def test_same_food_can_be_cached_in_two_different_units(db_session):
    """O caso que o unique antigo quebrava: mesmo alimento, unidades diferentes."""
    db_session.add(_taco("ovo", "ovo", 1.43, "g"))
    db_session.add(_taco("ovo", "ovo", 71.5, "un"))
    db_session.commit()

    linhas = db_session.query(FoodCache).filter(FoodCache.name_normalized == "ovo").all()
    assert len(linhas) == 2
    assert {l.unit_type for l in linhas} == {"g", "un"}

    # E cada par devolve a sua própria caloria — não a do outro.
    por_unidade = {l.unit_type: l.calories_per_unit for l in linhas}
    assert por_unidade["g"] == 1.43
    assert por_unidade["un"] == 71.5


def test_same_food_and_unit_still_cannot_duplicate(db_session):
    """A troca não pode ter afrouxado demais: (name_normalized, unit_type) segue único
    dentro da mesma procedência compartilhada.

    Sem isto, o cache acumularia linhas repetidas do mesmo par e a leitura passaria a
    depender da ordem de inserção.
    """
    db_session.add(_taco("arroz", "arroz", 1.28, "g"))
    db_session.commit()

    db_session.add(_taco("arroz", "arroz", 9.99, "g"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_different_foods_are_independent(db_session):
    """Guarda contra o erro oposto: um unique composto errado poderia colidir nomes."""
    db_session.add(_taco("ovo", "ovo", 1.43, "g"))
    db_session.add(_taco("pão", "pao", 2.7, "g"))
    db_session.commit()

    assert db_session.query(FoodCache).count() == 2


def test_case_and_accent_variants_collapse_into_one_row(db_session):
    """RS-19: a chave de leitura é o nome normalizado, não o rótulo de exibição.

    Sem isto, "Ovo", "ovo" e " OVO " seriam três linhas para o mesmo alimento — três misses
    do caminho pago, e um espaço de escrita limitado só pela criatividade em variar caixa.
    """
    db_session.add(_taco("Ovo", "ovo", 1.43, "g"))
    db_session.commit()

    # Rótulo diferente, mesma chave normalizada: tem que colidir.
    db_session.add(_taco(" OVO ", "ovo", 9.99, "g"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_untrusted_row_is_isolated_per_user(db_session, make_user):
    """RS-17: estimativa de LLM é isolada por dono — o índice parcial privado permite uma
    linha por (alimento, unidade, fonte, usuário).

    É o comportamento que a Δ2 introduziu: num unique global, o segundo usuário a resolver
    o mesmo nome colidiria com o primeiro e herdaria o valor dele.
    """
    make_user(email="a@example.com")
    make_user(email="b@example.com")
    a = db_session.query(User).filter(User.email == "a@example.com").first()
    b = db_session.query(User).filter(User.email == "b@example.com").first()

    db_session.add(FoodCache(name="tapioca recheada", name_normalized="tapioca recheada",
                             calories_per_unit=2.4, unit_type="g", source="llm",
                             created_by_user_id=a.id))
    db_session.add(FoodCache(name="tapioca recheada", name_normalized="tapioca recheada",
                             calories_per_unit=3.1, unit_type="g", source="llm",
                             created_by_user_id=b.id))
    db_session.commit()

    linhas = db_session.query(FoodCache).filter(
        FoodCache.name_normalized == "tapioca recheada"
    ).all()
    assert len(linhas) == 2
    # Cada usuário fica com a própria estimativa: um não sobrescreve o outro.
    assert {l.created_by_user_id: l.calories_per_unit for l in linhas} == {
        a.id: 2.4,
        b.id: 3.1,
    }


def test_untrusted_row_cannot_duplicate_for_the_same_user(db_session, make_user):
    """A partição isola por usuário, mas não pode virar porta pra duplicar sem limite:
    dentro do mesmo dono, o par segue único."""
    make_user(email="a@example.com")
    a = db_session.query(User).filter(User.email == "a@example.com").first()

    db_session.add(FoodCache(name="tapioca recheada", name_normalized="tapioca recheada",
                             calories_per_unit=2.4, unit_type="g", source="llm",
                             created_by_user_id=a.id))
    db_session.commit()

    db_session.add(FoodCache(name="tapioca recheada", name_normalized="tapioca recheada",
                             calories_per_unit=9.99, unit_type="g", source="llm",
                             created_by_user_id=a.id))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_trusted_and_untrusted_coexist_for_the_same_food(db_session, make_user):
    """A linha compartilhada da TACO e a estimativa privada do usuário são linhas distintas.

    Sem isto, um alimento que existe na TACO e também foi resolvido por LLM colidiria, e a
    procedência — o ponto inteiro do RS-17 — se perderia numa linha só.
    """
    make_user(email="a@example.com")
    a = db_session.query(User).filter(User.email == "a@example.com").first()

    db_session.add(_taco("ovo", "ovo", 1.43, "g"))
    db_session.add(FoodCache(name="ovo", name_normalized="ovo", calories_per_unit=1.9,
                             unit_type="g", source="llm", created_by_user_id=a.id))
    db_session.commit()

    linhas = db_session.query(FoodCache).filter(FoodCache.name_normalized == "ovo").all()
    assert {l.source for l in linhas} == {"taco", "llm"}
