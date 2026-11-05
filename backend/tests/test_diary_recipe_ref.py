"""Receita no diário (`recipe:<id>`) — Frente R, Tarefa 2. A receita vale POR PORÇÃO."""

from app.models.ingredient import Ingredient
from app.models.recipe import Recipe
from tests.diary_helpers import criar, entradas, usuario


def _receita(db, user_id, *, calories=450.0, is_public=False, ingredientes=(), title="Strogonoff"):
    r = Recipe(
        user_id=user_id, title=title, instructions="x", calories=calories, is_public=is_public
    )
    db.add(r)
    db.flush()
    for kcal in ingredientes:
        db.add(Ingredient(recipe_id=r.id, name="i", quantity=1, unit="g", calories=kcal))
    db.commit()
    db.refresh(r)
    return r


def test_registra_porcoes_da_receita(make_user, db_session):
    cli = make_user()
    r = _receita(db_session, usuario(db_session, "user@example.com").id)
    res = criar(cli, food_ref=f"recipe:{r.id}", quantity=1.5, unit="un")
    assert res.status_code == 201, res.text
    e = entradas(res.json())[0]
    assert e["calories_total"] == 675
    assert e["source"] == "recipe"
    assert e["is_estimate"] is False
    assert e["food_name"] == "Strogonoff"
    assert e["protein_g_total"] is None


def test_receita_sem_calories_soma_ingredientes(make_user, db_session):
    cli = make_user()
    r = _receita(db_session, usuario(db_session, "user@example.com").id,
                 calories=None, ingredientes=(100.0, 150.0))
    res = criar(cli, food_ref=f"recipe:{r.id}", quantity=2, unit="un")
    assert res.status_code == 201, res.text
    assert entradas(res.json())[0]["calories_total"] == 500


def test_receita_sem_kcal_nao_resolve(make_user, db_session):
    cli = make_user()
    r = _receita(db_session, usuario(db_session, "user@example.com").id, calories=None)
    res = criar(cli, food_ref=f"recipe:{r.id}", quantity=1, unit="un")
    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "FOOD_NOT_RESOLVED"


def test_receita_privada_alheia_404(make_user, db_session):
    make_user("a@example.com")
    outro = make_user("b@example.com")
    r = _receita(db_session, usuario(db_session, "a@example.com").id, is_public=False)
    res = criar(outro, food_ref=f"recipe:{r.id}", quantity=1, unit="un")
    assert res.status_code == 404
    inexistente = criar(outro, food_ref="recipe:99999", quantity=1, unit="un")
    assert res.json() == inexistente.json()


def test_receita_publica_alheia_resolve(make_user, db_session):
    make_user("a@example.com")
    outro = make_user("b@example.com")
    r = _receita(db_session, usuario(db_session, "a@example.com").id, is_public=True)
    res = criar(outro, food_ref=f"recipe:{r.id}", quantity=1, unit="un")
    assert res.status_code == 201, res.text


def test_receita_unidade_g_422(make_user, db_session):
    cli = make_user()
    r = _receita(db_session, usuario(db_session, "user@example.com").id)
    res = criar(cli, food_ref=f"recipe:{r.id}", quantity=100, unit="g")
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "UNIT_NOT_SUPPORTED_FOR_FOOD"
