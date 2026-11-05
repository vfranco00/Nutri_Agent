"""Carrinho em lote — Frente R, Tarefa 4."""

from app.models.diary import DiaryEntry
from tests.diary_helpers import ARROZ, OVO, criar, entrada_bruta, entradas, hoje, semear_catalogo, usuario


def _lote(cli, items, **extra):
    return cli.post(
        "/diary/batch",
        json={"entry_date": hoje().isoformat(), "meal_slot": "almoco", "items": items, **extra},
    )


def test_lote_cria_todos(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    res = _lote(cli, [
        {"food_ref": ARROZ, "quantity": 100, "unit": "g"},
        {"food_ref": OVO, "quantity": 2, "unit": "un"},
    ])
    assert res.status_code == 201, res.text
    assert len(entradas(res.json())) == 2
    assert res.json()["totals"]["calories"] == 128 + 140


def test_lote_item_invalido_nada_gravado(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    res = _lote(cli, [
        {"food_ref": ARROZ, "quantity": 100, "unit": "g"},
        {"food_ref": "catalog:nao-existe-g", "quantity": 1, "unit": "g"},
    ])
    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "FOOD_NOT_RESOLVED"
    assert db_session.query(DiaryEntry).count() == 0
    # unidade incompatível também recusa o lote todo
    res = _lote(cli, [
        {"food_ref": ARROZ, "quantity": 100, "unit": "g"},
        {"food_ref": OVO, "quantity": 100, "unit": "g"},
    ])
    assert res.status_code == 422
    assert db_session.query(DiaryEntry).count() == 0


def test_lote_teto_403(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    u = usuario(db_session, "user@example.com")
    for _ in range(59):
        entrada_bruta(db_session, u.id)
    res = _lote(cli, [{"food_ref": ARROZ, "quantity": 1, "unit": "g"}] * 2)
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"
    assert db_session.query(DiaryEntry).count() == 59


def test_lote_tamanho_e_campos(make_user):
    cli = make_user()
    assert _lote(cli, []).status_code == 422
    item = {"food_ref": ARROZ, "quantity": 1, "unit": "g"}
    assert _lote(cli, [item] * 31).status_code == 422
    assert _lote(cli, [{**item, "calories_total": 1}]).status_code == 422
    assert _lote(cli, [item], user_id=2).status_code == 422


def test_post_diary_continua_igual(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user()
    assert criar(cli, food_ref=ARROZ).status_code == 201
