"""Lembretes por usuário, com fuso (Frente A, Tarefa 2)."""

KINDS = ["cafe", "almoco", "lanche", "jantar", "agua", "peso"]


def test_get_lembretes_padrao(make_user):
    cli = make_user()
    res = cli.get("/reminders")
    assert res.status_code == 200, res.text
    corpo = res.json()
    assert corpo["timezone"] == "America/Sao_Paulo"
    assert [r["kind"] for r in corpo["reminders"]] == KINDS
    assert all(r["enabled"] is False for r in corpo["reminders"])
    horas = {r["kind"]: r["time"] for r in corpo["reminders"]}
    assert horas["almoco"] == "12:30" and horas["cafe"] == "08:00" and horas["peso"] == "07:30"


def test_put_lembretes_salva_e_devolve(make_user):
    cli = make_user()
    res = cli.put(
        "/reminders",
        json={
            "timezone": "Europe/Lisbon",
            "reminders": [
                {"kind": "almoco", "time": "13:15", "enabled": True},
                {"kind": "agua", "time": "09:00", "enabled": True},
            ],
        },
    )
    assert res.status_code == 200, res.text
    corpo = cli.get("/reminders").json()
    assert corpo["timezone"] == "Europe/Lisbon"
    por_tipo = {r["kind"]: r for r in corpo["reminders"]}
    assert por_tipo["almoco"] == {"kind": "almoco", "time": "13:15", "enabled": True}
    assert por_tipo["agua"]["enabled"] is True
    assert por_tipo["cafe"]["enabled"] is False
    # PUT de novo atualiza em vez de duplicar (upsert por usuário+tipo).
    cli.put(
        "/reminders",
        json={"timezone": "Europe/Lisbon", "reminders": [{"kind": "almoco", "time": "14:00", "enabled": False}]},
    )
    por_tipo = {r["kind"]: r for r in cli.get("/reminders").json()["reminders"]}
    assert por_tipo["almoco"]["time"] == "14:00" and por_tipo["almoco"]["enabled"] is False
    assert por_tipo["agua"]["enabled"] is True  # o que não veio no PUT fica como estava


def test_put_lembretes_fuso_invalido_422(make_user):
    cli = make_user()
    res = cli.put(
        "/reminders",
        json={"timezone": "Marte/Olympus", "reminders": [{"kind": "cafe", "time": "08:00", "enabled": True}]},
    )
    assert res.status_code == 422


def test_put_lembretes_tipo_desconhecido_422(make_user):
    cli = make_user()
    res = cli.put(
        "/reminders",
        json={"timezone": "America/Sao_Paulo", "reminders": [{"kind": "sono", "time": "22:00", "enabled": True}]},
    )
    assert res.status_code == 422


def test_put_lembretes_tipo_repetido_422(make_user):
    cli = make_user()
    item = {"kind": "cafe", "time": "08:00", "enabled": True}
    res = cli.put("/reminders", json={"timezone": "America/Sao_Paulo", "reminders": [item, item]})
    assert res.status_code == 422


def test_lembretes_isolados_por_usuario(make_user):
    a = make_user(email="a@example.com")
    b = make_user(email="b@example.com")
    a.put(
        "/reminders",
        json={"timezone": "Europe/Lisbon", "reminders": [{"kind": "jantar", "time": "21:00", "enabled": True}]},
    )
    corpo = b.get("/reminders").json()
    assert corpo["timezone"] == "America/Sao_Paulo"
    assert all(r["enabled"] is False for r in corpo["reminders"])


def test_mudar_horario_zera_last_sent_on(make_user, db_session):
    from datetime import date

    from app.models.reminder import Reminder

    cli = make_user()
    corpo = {"timezone": "America/Sao_Paulo", "reminders": [{"kind": "cafe", "time": "08:00", "enabled": True}]}
    cli.put("/reminders", json=corpo)
    r = db_session.query(Reminder).one()
    r.last_sent_on = date(2026, 11, 5)
    db_session.commit()
    # Mesmo PUT (nada mudou): mantém a marca.
    cli.put("/reminders", json=corpo)
    db_session.expire_all()
    assert db_session.query(Reminder).one().last_sent_on == date(2026, 11, 5)
    # Horário novo: zera.
    corpo["reminders"][0]["time"] = "09:00"
    cli.put("/reminders", json=corpo)
    db_session.expire_all()
    assert db_session.query(Reminder).one().last_sent_on is None
