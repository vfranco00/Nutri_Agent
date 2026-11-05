"""Copiar / repetir dia — Frente R, Tarefa 4."""

from datetime import timedelta

from app.models.diary import DiaryEntry
from app.services import diary_registro
from tests.diary_helpers import (
    ARROZ,
    OVO,
    alimento_customizado,
    criar,
    entrada_bruta,
    entradas,
    hoje,
    semear_catalogo,
    usuario,
)

ONTEM = lambda: hoje() - timedelta(days=1)  # noqa: E731


def _copiar(cli, **extra):
    body = {"from_date": ONTEM().isoformat(), "to_date": hoje().isoformat(), **extra}
    return cli.post("/diary/copy", json=body)


def _semear_ontem(cli, db):
    semear_catalogo(db)
    criar(cli, food_ref=ARROZ, quantity=150, data=ONTEM(), slot="almoco")
    criar(cli, food_ref=OVO, quantity=2, unit="un", data=ONTEM(), slot="cafe_da_manha")


def test_copia_dia_inteiro(make_user, db_session):
    cli = make_user()
    _semear_ontem(cli, db_session)
    res = _copiar(cli)
    assert res.status_code == 200, res.text
    dia = res.json()
    assert dia["date"] == hoje().isoformat()
    lista = entradas(dia)
    assert sorted((e["food_ref"], e["meal_slot"], e["quantity"]) for e in lista) == [
        (ARROZ, "almoco", 150), (OVO, "cafe_da_manha", 2)
    ]
    assert dia["totals"]["calories"] == 192 + 140


def test_copia_so_um_slot(make_user, db_session):
    cli = make_user()
    _semear_ontem(cli, db_session)
    dia = _copiar(cli, meal_slot="cafe_da_manha").json()
    assert [e["food_ref"] for e in entradas(dia)] == [OVO]


def test_copia_duas_vezes_nao_duplica(make_user, db_session):
    cli = make_user()
    _semear_ontem(cli, db_session)
    _copiar(cli)
    dia = _copiar(cli).json()
    assert len(entradas(dia)) == 2


def test_corrida_integrity_error_nao_duplica(make_user, db_session, monkeypatch):
    cli = make_user()
    _semear_ontem(cli, db_session)
    original = diary_registro._origens_ja_copiadas
    chamadas = {"n": 0}

    def com_corrida(db, user_id, to_date, ids):
        chamadas["n"] += 1
        if chamadas["n"] == 1:
            # a outra aba copia entre a checagem e o INSERT
            outra = _copiar_por_fora(db_session, user_id, ids)
            assert outra == 2
            return set()  # a checagem desta aba não viu nada
        return original(db, user_id, to_date, ids)

    monkeypatch.setattr(diary_registro, "_origens_ja_copiadas", com_corrida)
    res = _copiar(cli)
    assert res.status_code == 200, res.text
    assert len(entradas(res.json())) == 2
    total = db_session.query(DiaryEntry).filter(DiaryEntry.entry_date == hoje()).count()
    assert total == 2


def _copiar_por_fora(db, user_id, ids):
    origens = db.query(DiaryEntry).filter(DiaryEntry.id.in_(ids)).all()
    for o in origens:
        db.add(
            DiaryEntry(
                user_id=user_id, entry_date=hoje(), meal_slot=o.meal_slot, food_ref=o.food_ref,
                food_name=o.food_name, source=o.source, base_unit=o.base_unit,
                quantity=o.quantity, unit=o.unit, kcal_per_base_unit=o.kcal_per_base_unit,
                calories_total=o.calories_total, copied_from_entry_id=o.id,
            )
        )
    db.commit()
    return len(origens)


def test_copia_estoura_teto_403_nada_gravado(make_user, db_session):
    cli = make_user()
    _semear_ontem(cli, db_session)
    u = usuario(db_session, "user@example.com")
    for _ in range(59):
        entrada_bruta(db_session, u.id, data=hoje())
    res = _copiar(cli)  # 59 + 2 > 60
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"
    assert db_session.query(DiaryEntry).filter(DiaryEntry.entry_date == hoje()).count() == 59


def test_copia_mesmo_dia_422(make_user):
    cli = make_user()
    d = hoje().isoformat()
    assert cli.post("/diary/copy", json={"from_date": d, "to_date": d}).status_code == 422


def test_copia_dia_vazio_200(make_user, db_session):
    cli = make_user()
    semear_catalogo(db_session)
    criar(cli, food_ref=ARROZ, data=hoje())
    res = _copiar(cli)
    assert res.status_code == 200
    assert len(entradas(res.json())) == 1


def test_copia_isolada_por_usuario(make_user, db_session):
    a = make_user("a@example.com")
    b = make_user("b@example.com")
    _semear_ontem(a, db_session)
    res = _copiar(b)
    assert res.status_code == 200
    assert entradas(res.json()) == []
    assert db_session.query(DiaryEntry).filter(DiaryEntry.entry_date == hoje()).count() == 0


def test_copia_data_futura_alem_da_janela_422(make_user):
    cli = make_user()
    body = {"from_date": hoje().isoformat(), "to_date": (hoje() + timedelta(days=5)).isoformat()}
    assert cli.post("/diary/copy", json=body).status_code == 422


def test_copia_campo_extra_422(make_user):
    cli = make_user()
    body = {"from_date": ONTEM().isoformat(), "to_date": hoje().isoformat(), "user_id": 3}
    assert cli.post("/diary/copy", json=body).status_code == 422


def test_patch_porcao_sem_energia_422(make_user, db_session):
    cli = make_user()
    alimento_customizado(db_session, slug="x-g", kcal=0.01)
    dia = criar(cli, food_ref="catalog:x-g", quantity=100).json()
    eid = entradas(dia)[0]["id"]
    res = cli.patch(f"/diary/{eid}", json={"quantity": 1})
    assert res.status_code == 422, res.text
