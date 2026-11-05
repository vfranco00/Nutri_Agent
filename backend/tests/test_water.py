"""Água: meta pelo peso, registro do dia e isolamento por usuário (Frente A)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.services.water_goal import water_goal_ml


def _hoje() -> str:
    # Mesma base da janela RS-09 (UTC no servidor), como em tests/diary_helpers.py.
    return datetime.now(timezone.utc).date().isoformat()


def _perfil(weight: float) -> dict:
    return {
        "age": 30,
        "weight": weight,
        "height": 180.0,
        "gender": "male",
        "activity_level": "sedentary",
        "goal": "lose_weight",
    }


def test_meta_agua_arredonda_para_50():
    assert water_goal_ml(70) == 2450
    assert water_goal_ml(71) == 2500  # 2485 -> 2500
    assert water_goal_ml(70.7) == 2450  # 2474,5 -> 2450
    assert water_goal_ml(70.715) == 2500  # 2475,025 -> 2500
    assert water_goal_ml(None) == 2000
    assert water_goal_ml(0) == 2000


def test_get_agua_sem_perfil_meta_2000(make_user):
    cli = make_user()
    res = cli.get("/water", params={"date": _hoje()})
    assert res.status_code == 200, res.text
    assert res.json() == {"date": _hoje(), "goal_ml": 2000, "total_ml": 0, "entries": []}


def test_get_agua_com_perfil_usa_peso(make_user):
    cli = make_user()
    assert cli.put("/profiles/me", json=_perfil(80.0)).status_code == 200
    res = cli.get("/water", params={"date": _hoje()})
    assert res.json()["goal_ml"] == 2800


def test_post_agua_soma_no_dia(make_user):
    cli = make_user()
    r1 = cli.post("/water", json={"date": _hoje(), "ml": 250})
    assert r1.status_code == 201, r1.text
    r2 = cli.post("/water", json={"date": _hoje(), "ml": 250})
    corpo = r2.json()
    assert corpo["total_ml"] == 500
    assert [e["ml"] for e in corpo["entries"]] == [250, 250]
    assert cli.get("/water", params={"date": _hoje()}).json()["total_ml"] == 500


def test_agua_isolada_por_usuario(make_user):
    cli_a = make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com")
    entrada = cli_a.post("/water", json={"date": _hoje(), "ml": 300}).json()["entries"][0]

    assert cli_b.get("/water", params={"date": _hoje()}).json()["total_ml"] == 0

    alheia = cli_b.delete(f"/water/{entrada['id']}")
    inexistente = cli_b.delete("/water/999999")
    assert alheia.status_code == 404
    assert alheia.json() == inexistente.json()
    assert cli_a.get("/water", params={"date": _hoje()}).json()["total_ml"] == 300


@pytest.mark.parametrize("ml", [0, -250, 5001, 2.5])
def test_post_agua_ml_invalido(make_user, ml):
    cli = make_user()
    assert cli.post("/water", json={"date": _hoje(), "ml": ml}).status_code == 422


def test_post_agua_fora_da_janela(make_user):
    cli = make_user()
    futuro = (datetime.now(timezone.utc).date() + timedelta(days=30)).isoformat()
    assert cli.post("/water", json={"date": futuro, "ml": 250}).status_code == 422


def test_post_agua_recusa_campo_extra(make_user):
    cli = make_user()
    res = cli.post("/water", json={"date": _hoje(), "ml": 250, "user_id": 1})
    assert res.status_code == 422


def test_delete_agua_devolve_dia(make_user):
    cli = make_user()
    cli.post("/water", json={"date": _hoje(), "ml": 250})
    dia = cli.post("/water", json={"date": _hoje(), "ml": 500}).json()
    ultima = dia["entries"][-1]["id"]
    res = cli.delete(f"/water/{ultima}")
    assert res.status_code == 200
    assert res.json()["total_ml"] == 250


def test_teto_de_entradas_por_dia(make_user, monkeypatch):
    monkeypatch.setattr("app.routers.water.MAX_ENTRADAS_AGUA_POR_DIA", 2)
    cli = make_user()
    cli.post("/water", json={"date": _hoje(), "ml": 250})
    cli.post("/water", json={"date": _hoje(), "ml": 250})
    res = cli.post("/water", json={"date": _hoje(), "ml": 250})
    assert res.status_code == 403
    assert res.json()["detail"]["event_type"] == "water_entries_per_day"


def test_agua_exige_login(client):
    assert client.get("/water", params={"date": _hoje()}).status_code == 401
