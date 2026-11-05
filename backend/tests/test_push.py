"""Inscrição de push Web com VAPID (Frente A, Tarefa 3)."""

import pytest

from app.core.config import settings
from app.models.push_subscription import PushSubscription

FCM = "https://fcm.googleapis.com/fcm/send/abc123"


def _corpo(endpoint: str = FCM) -> dict:
    return {"endpoint": endpoint, "keys": {"p256dh": "BPkey", "auth": "authkey"}}


def test_vapid_public_key_503_sem_config(make_user, monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "")
    cli = make_user()
    res = cli.get("/push/vapid-public-key")
    assert res.status_code == 503
    assert res.json()["detail"]["code"] == "PUSH_NOT_CONFIGURED"


def test_vapid_public_key_devolve_chave(make_user, monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "chave-publica")
    cli = make_user()
    res = cli.get("/push/vapid-public-key")
    assert res.status_code == 200
    assert res.json() == {"public_key": "chave-publica"}


def test_vapid_public_key_exige_login(client, monkeypatch):
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "chave-publica")
    assert client.get("/push/vapid-public-key").status_code == 401


def test_inscricao_cria(make_user, db_session):
    cli = make_user()
    res = cli.post("/push/subscriptions", json=_corpo())
    assert res.status_code == 201, res.text
    assert "id" in res.json()
    assert db_session.query(PushSubscription).count() == 1


def test_inscricao_idempotente(make_user, db_session):
    cli = make_user()
    cli.post("/push/subscriptions", json=_corpo())
    cli.post("/push/subscriptions", json=_corpo())
    assert db_session.query(PushSubscription).count() == 1


def test_inscricao_troca_de_dono(make_user, db_session):
    a = make_user(email="a@example.com")
    b = make_user(email="b@example.com")
    a.post("/push/subscriptions", json=_corpo())
    b.post("/push/subscriptions", json=_corpo())
    db_session.expire_all()
    sub = db_session.query(PushSubscription).one()
    from app.models.user import User

    dono = db_session.get(User, sub.user_id)
    assert dono.email == "b@example.com"


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://fcm.googleapis.com/x",
        "https://169.254.169.254/x",
        "https://evil.com/x",
        "https://fcm.googleapis.com.evil.com/x",
        "https://evil.com/?h=fcm.googleapis.com",
    ],
)
def test_inscricao_recusa_endpoint_fora_da_lista(make_user, endpoint):
    cli = make_user()
    res = cli.post("/push/subscriptions", json=_corpo(endpoint))
    assert res.status_code == 422


@pytest.mark.parametrize(
    "endpoint",
    [
        "https://updates.push.services.mozilla.com/wpush/v2/abc",
        "https://web.push.apple.com/abc",
        "https://wns2-par02p.notify.windows.com/w/?token=x",
    ],
)
def test_inscricao_aceita_hosts_conhecidos(make_user, endpoint):
    cli = make_user()
    assert cli.post("/push/subscriptions", json=_corpo(endpoint)).status_code == 201


def test_limite_de_10_inscricoes_remove_a_mais_antiga(make_user, db_session):
    cli = make_user()
    for i in range(11):
        assert cli.post("/push/subscriptions", json=_corpo(f"https://fcm.googleapis.com/fcm/send/{i}")).status_code == 201
    enderecos = {s.endpoint for s in db_session.query(PushSubscription).all()}
    assert len(enderecos) == 10
    assert "https://fcm.googleapis.com/fcm/send/0" not in enderecos


def test_remover_inscricao_propria(make_user, db_session):
    cli = make_user()
    cli.post("/push/subscriptions", json=_corpo())
    res = cli.request("DELETE", "/push/subscriptions", json={"endpoint": FCM})
    assert res.status_code == 204
    assert db_session.query(PushSubscription).count() == 0


def test_remover_inscricao_alheia_nao_apaga(make_user, db_session):
    a = make_user(email="a@example.com")
    b = make_user(email="b@example.com")
    a.post("/push/subscriptions", json=_corpo())
    res = b.request("DELETE", "/push/subscriptions", json={"endpoint": FCM})
    assert res.status_code == 204
    assert db_session.query(PushSubscription).count() == 1


def _sub() -> PushSubscription:
    return PushSubscription(user_id=1, endpoint=FCM, p256dh="k", auth="a")


def _falha_http(status: int):
    from pywebpush import WebPushException

    class _Resp:
        status_code = status

    def _webpush(*args, **kwargs):
        raise WebPushException("falhou", response=_Resp())

    return _webpush


def test_send_push_410_vira_gone(monkeypatch):
    from app.services import webpush

    monkeypatch.setattr(webpush, "webpush", _falha_http(410))
    assert webpush.send_push(_sub(), {"title": "x"}) == "gone"


def test_send_push_404_vira_gone(monkeypatch):
    from app.services import webpush

    monkeypatch.setattr(webpush, "webpush", _falha_http(404))
    assert webpush.send_push(_sub(), {"title": "x"}) == "gone"


def test_send_push_outro_erro_vira_error(monkeypatch):
    from app.services import webpush

    monkeypatch.setattr(webpush, "webpush", _falha_http(500))
    assert webpush.send_push(_sub(), {"title": "x"}) == "error"


def test_send_push_ok_passa_vapid(monkeypatch):
    from app.services import webpush

    chamado = {}

    def _ok(**kwargs):
        chamado.update(kwargs)

    monkeypatch.setattr(webpush, "webpush", _ok)
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "priv")
    monkeypatch.setattr(settings, "VAPID_SUBJECT", "mailto:x@example.com")
    assert webpush.send_push(_sub(), {"title": "x"}) == "ok"
    assert chamado["vapid_private_key"] == "priv"
    assert chamado["vapid_claims"] == {"sub": "mailto:x@example.com"}
    assert chamado["subscription_info"]["endpoint"] == FCM
    assert chamado["ttl"] == 3600 and chamado["timeout"] == 5


def test_send_push_excecao_generica_vira_error(monkeypatch):
    from app.services import webpush

    def _boom(**kwargs):
        raise RuntimeError("rede")

    monkeypatch.setattr(webpush, "webpush", _boom)
    assert webpush.send_push(_sub(), {"title": "x"}) == "error"
