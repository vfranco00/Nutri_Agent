"""Dispatch dos lembretes pelo cron externo (Frente A, Tarefa 4)."""

from datetime import date, datetime, time, timezone

import pytest

from app.core.config import settings
from app.models.push_subscription import PushSubscription
from app.models.reminder import Reminder
from app.models.user import User
from app.services import reminder_dispatch
from app.services.reminder_dispatch import dispatch_due_reminders

SEGREDO = "segredo-do-cron"
FCM = "https://fcm.googleapis.com/fcm/send/"


def utc(dia: int, h: int, m: int) -> datetime:
    return datetime(2026, 11, dia, h, m, tzinfo=timezone.utc)


class _Enviados(list):
    """Lista de (endpoint, payload) enviados; `resultados` define o retorno por endpoint."""

    def __init__(self):
        super().__init__()
        self.resultados: dict[str, str] = {}


@pytest.fixture
def enviados(monkeypatch):
    """Troca o envio real por um falso que registra (endpoint, payload)."""
    chamadas = _Enviados()

    def _falso(sub, payload):
        chamadas.append((sub.endpoint, payload))
        return chamadas.resultados.get(sub.endpoint, "ok")

    monkeypatch.setattr(reminder_dispatch, "send_push", _falso)
    return chamadas


def _usuario(db, make_user, email="u@example.com") -> User:
    make_user(email=email)
    return db.query(User).filter(User.email == email).one()


def _lembrete(db, user, kind="almoco", hora=time(12, 30), tz="America/Sao_Paulo", enabled=True, ultimo=None):
    r = Reminder(user_id=user.id, kind=kind, local_time=hora, timezone=tz, enabled=enabled, last_sent_on=ultimo)
    db.add(r)
    db.commit()
    return r


def _inscricao(db, user, sufixo="1"):
    db.add(PushSubscription(user_id=user.id, endpoint=FCM + sufixo, p256dh="k", auth="a"))
    db.commit()


# --- endpoint ---------------------------------------------------------------


def test_dispatch_401_sem_segredo(client, monkeypatch):
    monkeypatch.setattr(settings, "CRON_SECRET", SEGREDO)
    assert client.post("/internal/reminders/dispatch").status_code == 401


def test_dispatch_401_segredo_errado(client, monkeypatch):
    monkeypatch.setattr(settings, "CRON_SECRET", SEGREDO)
    res = client.post("/internal/reminders/dispatch", headers={"X-Cron-Secret": "outro"})
    assert res.status_code == 401


def test_dispatch_sem_segredo_configurado_responde_503(client, monkeypatch):
    monkeypatch.setattr(settings, "CRON_SECRET", "")
    # Nem o cabeçalho vazio abre: sem segredo no servidor o endpoint nunca fica aberto.
    assert client.post("/internal/reminders/dispatch").status_code == 503
    res = client.post("/internal/reminders/dispatch", headers={"X-Cron-Secret": ""})
    assert res.status_code == 503


def test_dispatch_com_segredo_certo_responde_resultado(client, monkeypatch, enviados):
    monkeypatch.setattr(settings, "CRON_SECRET", SEGREDO)
    res = client.post("/internal/reminders/dispatch", headers={"X-Cron-Secret": SEGREDO})
    assert res.status_code == 200, res.text
    assert res.json() == {"reminders": 0, "sent": 0, "removed": 0, "failed": 0}


def test_dispatch_fora_do_schema_openapi(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert not any(p.startswith("/internal") for p in paths)


# --- serviço ----------------------------------------------------------------


def test_dispatch_envia_na_janela(db_session, make_user, enviados):
    u = _usuario(db_session, make_user)
    _lembrete(db_session, u)
    _inscricao(db_session, u)
    res = dispatch_due_reminders(db_session, utc(5, 15, 32))  # 12h32 em São Paulo
    assert (res.reminders, res.sent, res.removed, res.failed) == (1, 1, 0, 0)
    assert len(enviados) == 1
    payload = enviados[0][1]
    assert payload["title"] == "Hora do almoço"
    assert payload["tag"] == "nuvi-almoco"
    assert payload["url"] == "/hoje"


def test_dispatch_fora_da_janela(db_session, make_user, enviados):
    u = _usuario(db_session, make_user)
    _lembrete(db_session, u)
    _inscricao(db_session, u)
    assert dispatch_due_reminders(db_session, utc(5, 15, 36)).sent == 0  # passou de 5 min
    assert dispatch_due_reminders(db_session, utc(5, 15, 29)).sent == 0  # ainda não chegou
    assert enviados == []


def test_dispatch_respeita_fuso(db_session, make_user, enviados):
    u = _usuario(db_session, make_user)
    _lembrete(db_session, u, tz="Europe/Lisbon")  # em novembro, Lisboa = UTC
    _inscricao(db_session, u)
    assert dispatch_due_reminders(db_session, utc(5, 15, 32)).sent == 0
    assert dispatch_due_reminders(db_session, utc(5, 12, 32)).sent == 1


def test_dispatch_nao_envia_duas_vezes_no_dia(db_session, make_user, enviados):
    u = _usuario(db_session, make_user)
    _lembrete(db_session, u)
    _inscricao(db_session, u)
    assert dispatch_due_reminders(db_session, utc(5, 15, 31)).sent == 1
    assert dispatch_due_reminders(db_session, utc(5, 15, 33)).sent == 0
    assert len(enviados) == 1
    # No dia seguinte, envia de novo.
    assert dispatch_due_reminders(db_session, utc(6, 15, 31)).sent == 1
    assert len(enviados) == 2


def test_dispatch_janela_atravessa_meia_noite(db_session, make_user, enviados):
    u = _usuario(db_session, make_user)
    r = _lembrete(db_session, u, kind="jantar", hora=time(23, 58))
    _inscricao(db_session, u)
    # Cron às 00h01 de 06/11 em São Paulo (03h01 UTC): o lembrete é das 23h58 de 05/11.
    res = dispatch_due_reminders(db_session, utc(6, 3, 1))
    assert res.sent == 1
    db_session.expire_all()
    assert db_session.get(Reminder, r.id).last_sent_on == date(2026, 11, 5)
    # Segundo cron na mesma janela não repete.
    assert dispatch_due_reminders(db_session, utc(6, 3, 2)).sent == 0
    # E o do dia seguinte (23h58 de 06/11) ainda dispara: o "já enviado" é por dia local.
    assert dispatch_due_reminders(db_session, utc(7, 3, 1)).sent == 1
    assert len(enviados) == 2


def test_dispatch_remove_inscricao_410(db_session, make_user, enviados):
    u = _usuario(db_session, make_user)
    _lembrete(db_session, u)
    _inscricao(db_session, u, "morta")
    _inscricao(db_session, u, "viva")
    enviados.resultados[FCM + "morta"] = "gone"
    res = dispatch_due_reminders(db_session, utc(5, 15, 31))
    assert (res.sent, res.removed, res.failed) == (1, 1, 0)
    restantes = {s.endpoint for s in db_session.query(PushSubscription).all()}
    assert restantes == {FCM + "viva"}


def test_dispatch_conta_falhas_e_mantem_inscricao(db_session, make_user, enviados):
    u = _usuario(db_session, make_user)
    _lembrete(db_session, u)
    _inscricao(db_session, u)
    enviados.resultados[FCM + "1"] = "error"
    res = dispatch_due_reminders(db_session, utc(5, 15, 31))
    assert (res.sent, res.removed, res.failed) == (0, 0, 1)
    assert db_session.query(PushSubscription).count() == 1


def test_dispatch_ignora_desligado(db_session, make_user, enviados):
    u = _usuario(db_session, make_user)
    _lembrete(db_session, u, enabled=False)
    _inscricao(db_session, u)
    res = dispatch_due_reminders(db_session, utc(5, 15, 31))
    assert res.reminders == 0 and enviados == []


def test_dispatch_so_notifica_inscricoes_do_dono(db_session, make_user, enviados):
    a = _usuario(db_session, make_user, "a@example.com")
    b = _usuario(db_session, make_user, "b@example.com")
    _lembrete(db_session, a)
    _inscricao(db_session, a, "a")
    _inscricao(db_session, b, "b")
    dispatch_due_reminders(db_session, utc(5, 15, 31))
    assert [e for e, _ in enviados] == [FCM + "a"]


def test_dispatch_fuso_invalido_no_banco_nao_derruba(db_session, make_user, enviados):
    u = _usuario(db_session, make_user)
    _lembrete(db_session, u, tz="Lugar/Nenhum")
    _lembrete(db_session, u, kind="agua", hora=time(12, 30))
    _inscricao(db_session, u)
    res = dispatch_due_reminders(db_session, utc(5, 15, 31))
    assert res.sent == 1
