"""Refeições prontas — Frente R, Tarefa 5."""

from datetime import timedelta

from app.models.diary import DiaryEntry
from app.models.saved_meal import SavedMeal
from tests.diary_helpers import ARROZ, OVO, criar, entrada_bruta, entradas, hoje, semear_catalogo, usuario

NOT_FOUND = {"code": "SAVED_MEAL_NOT_FOUND", "message": "Refeição não encontrada."}


def _montar(cli, db):
    semear_catalogo(db)
    criar(cli, food_ref=ARROZ, quantity=150, slot="almoco")
    criar(cli, food_ref=OVO, quantity=2, unit="un", slot="almoco")


def _salvar(cli, nome="Almoço de segunda", **extra):
    return cli.post(
        "/diary/saved-meals",
        json={"name": nome, "entry_date": hoje().isoformat(), "meal_slot": "almoco", **extra},
    )


def test_salva_e_lista(make_user, db_session):
    cli = make_user()
    _montar(cli, db_session)
    res = _salvar(cli)
    assert res.status_code == 201, res.text
    r = res.json()
    assert r["name"] == "Almoço de segunda"
    assert r["calories"] == 192 + 140
    assert sorted(i["food_ref"] for i in r["items"]) == sorted([ARROZ, OVO])
    assert {"food_name", "quantity", "unit", "calories"} <= set(r["items"][0])
    lista = cli.get("/diary/saved-meals").json()
    assert [m["id"] for m in lista["items"]] == [r["id"]]
    assert cli.delete(f"/diary/saved-meals/{r['id']}").json() == {"ok": True}
    assert cli.get("/diary/saved-meals").json()["items"] == []


def test_registra_refeicao_inteira(make_user, db_session):
    cli = make_user()
    _montar(cli, db_session)
    mid = _salvar(cli).json()["id"]
    amanha = hoje() + timedelta(days=1)
    res = cli.post(
        f"/diary/saved-meals/{mid}/log",
        json={"entry_date": amanha.isoformat(), "meal_slot": "jantar"},
    )
    assert res.status_code == 201, res.text
    dia = res.json()
    assert dia["date"] == amanha.isoformat()
    lista = entradas(dia)
    assert len(lista) == 2 and {e["meal_slot"] for e in lista} == {"jantar"}
    assert dia["totals"]["calories"] == 332


def test_registra_sem_depender_do_ref(make_user, db_session):
    """Snapshot por item: apagar o alimento pessoal não impede de registrar a refeição."""
    cli = make_user()
    pessoal = cli.post("/diary/foods/mine", json={"name": "Granola", "kcal": 150}).json()
    criar(cli, food_ref=pessoal["food_ref"], quantity=2, unit="un")
    mid = _salvar(cli).json()["id"]
    cli.delete(f"/diary/foods/mine/{pessoal['id']}")
    d = (hoje() - timedelta(days=1)).isoformat()
    res = cli.post(f"/diary/saved-meals/{mid}/log", json={"entry_date": d, "meal_slot": "almoco"})
    assert res.status_code == 201, res.text
    assert res.json()["totals"]["calories"] == 300


def test_salvar_slot_vazio_422(make_user):
    cli = make_user()
    res = _salvar(cli)
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "SAVED_MEAL_EMPTY"


def test_refeicao_alheia_404_identico(make_user, db_session):
    a = make_user("a@example.com")
    b = make_user("b@example.com")
    _montar(a, db_session)
    mid = _salvar(a).json()["id"]
    corpo = {"entry_date": hoje().isoformat(), "meal_slot": "almoco"}
    alheio = [
        b.post(f"/diary/saved-meals/{mid}/log", json=corpo),
        b.delete(f"/diary/saved-meals/{mid}"),
    ]
    inexistente = [
        b.post("/diary/saved-meals/99999/log", json=corpo),
        b.delete("/diary/saved-meals/99999"),
    ]
    for x, y in zip(alheio, inexistente):
        assert x.status_code == y.status_code == 404
        assert x.json() == y.json()
        assert x.json()["detail"] == NOT_FOUND
    assert b.get("/diary/saved-meals").json()["items"] == []
    assert db_session.query(SavedMeal).count() == 1


def test_log_respeita_teto(make_user, db_session):
    cli = make_user()
    _montar(cli, db_session)
    mid = _salvar(cli).json()["id"]
    u = usuario(db_session, "user@example.com")
    d = hoje() - timedelta(days=2)
    for _ in range(59):
        entrada_bruta(db_session, u.id, data=d)
    res = cli.post(
        f"/diary/saved-meals/{mid}/log", json={"entry_date": d.isoformat(), "meal_slot": "almoco"}
    )
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"
    assert db_session.query(DiaryEntry).filter(DiaryEntry.entry_date == d).count() == 59


def test_teto_de_100_refeicoes(make_user, db_session):
    cli = make_user()
    _montar(cli, db_session)
    u = usuario(db_session, "user@example.com")
    for i in range(100):
        db_session.add(SavedMeal(user_id=u.id, name=f"m{i}"))
    db_session.commit()
    res = _salvar(cli)
    assert res.status_code == 403
    assert res.json()["detail"]["event_type"] == "saved_meals"


def test_campos_invalidos_422(make_user):
    cli = make_user()
    assert _salvar(cli, user_id=3).status_code == 422
    assert _salvar(cli, nome="").status_code == 422
