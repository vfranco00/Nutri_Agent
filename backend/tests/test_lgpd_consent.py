"""L1.1: registro de consentimento com efeito real (LGPD Arts. 7º, 8º e 11)."""
from fastapi.testclient import TestClient

from app.core.legal import POLICY_VERSION
from app.main import app
from app.models.consent import Consent
from app.models.push_subscription import PushSubscription
from app.models.user import User

SUB = {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "keys": {"p256dh": "k", "auth": "a"}}


def _cadastro(client, email="novo@example.com", **extra):
    body = {
        "email": email,
        "password": "strongpassword123",
        "full_name": "Novo",
        "accepted_policy_version": POLICY_VERSION,
        "consent_saude": True,
    }
    body.update(extra)
    body = {k: v for k, v in body.items() if v is not None}
    return client.post("/users/", json=body)


def test_cadastro_sem_aceite_422(client):
    assert client.post("/users/", json={"email": "a@example.com", "password": "strongpassword123"}).status_code == 422
    assert _cadastro(client, "b@example.com", consent_saude=False).status_code == 422
    assert _cadastro(client, "c@example.com", accepted_policy_version="1999-v0").status_code == 422


def test_cadastro_grava_consentimento_saude(client, db_session):
    assert _cadastro(client).status_code == 200
    ev = db_session.query(Consent).one()
    assert (ev.purpose, ev.granted, ev.source, ev.policy_version) == ("saude", True, "cadastro", POLICY_VERSION)
    assert ev.user_id == db_session.query(User).one().id
    assert ev.ip_hash and len(ev.ip_hash) == 64 and "testclient" not in ev.ip_hash


def test_get_consentimentos_lista_todas_as_finalidades(make_user):
    c = make_user(consents=())
    body = c.get("/consents/me").json()
    assert body["policy_version"] == POLICY_VERSION
    por = {i["purpose"]: i for i in body["items"]}
    assert set(por) == {"saude", "ia", "push", "ranking", "marketing"}
    assert por["saude"]["granted"] is True and por["saude"]["at"] is not None
    assert por["ia"] == {"purpose": "ia", "granted": False, "at": None}


def test_ia_sem_consentimento_403(make_user):
    c = make_user(consents=())
    r = c.post("/ai/recipe-by-ingredients", json={"ingredients": ["ovo"]})
    assert r.status_code == 403
    assert r.json() == {"detail": "consent_required", "purpose": "ia"}
    r = c.post("/agent/parse", json={"text": "arroz", "date": "2026-11-05", "meal_slot": "almoco"})
    assert r.status_code == 403
    assert r.json()["purpose"] == "ia"


def test_ia_com_consentimento_passa_da_trava(make_user):
    c = make_user(consents=("ia",))
    r = c.post("/ai/recipe-by-ingredients", json={"ingredients": ["ovo"]})
    assert r.status_code != 403 or r.json().get("detail") != "consent_required"


def test_revogar_ia_volta_a_travar(make_user):
    c = make_user(consents=("ia",))
    assert c.post("/consents/me", json={"purpose": "ia", "granted": False, "source": "perfil"}).status_code == 200
    r = c.post("/ai/recipe-by-ingredients", json={"ingredients": ["ovo"]})
    assert r.status_code == 403


def test_push_sem_consentimento_403(make_user):
    c = make_user(consents=())
    r = c.post("/push/subscriptions", json=SUB)
    assert r.status_code == 403
    assert r.json() == {"detail": "consent_required", "purpose": "push"}


def test_revogar_push_apaga_inscricoes(make_user, db_session):
    c = make_user(consents=("push",))
    assert c.post("/push/subscriptions", json=SUB).status_code == 201
    assert db_session.query(PushSubscription).count() == 1
    r = c.post("/consents/me", json={"purpose": "push", "granted": False, "source": "perfil"})
    assert r.status_code == 200
    assert db_session.query(PushSubscription).count() == 0


def test_ranking_padrao_oculto(make_user):
    c = make_user(email="oculto@example.com", consents=())
    assert c.get("/users/leaderboard").json() == []
    assert c.post("/consents/me", json={"purpose": "ranking", "granted": True, "source": "perfil"}).status_code == 200
    assert [e["display_name"] for e in c.get("/users/leaderboard").json()] == ["Test"]


def test_saude_nao_se_revoga_pela_rota_409(make_user):
    c = make_user(consents=())
    r = c.post("/consents/me", json={"purpose": "saude", "granted": False, "source": "perfil"})
    assert r.status_code == 409
    assert "excluir" in r.json()["detail"].lower()


def test_consentimento_e_append_only(make_user, db_session):
    c = make_user(consents=())
    for g in (True, False, True):
        r = c.post("/consents/me", json={"purpose": "ia", "granted": g, "source": "perfil"})
        assert r.status_code == 200
    eventos = db_session.query(Consent).filter(Consent.purpose == "ia").order_by(Consent.id).all()
    assert [e.granted for e in eventos] == [True, False, True]
    por = {i["purpose"]: i for i in r.json()["items"]}
    assert por["ia"]["granted"] is True


def test_origem_invalida_422(make_user):
    c = make_user(consents=())
    assert c.post("/consents/me", json={"purpose": "ia", "granted": True, "source": "xyz"}).status_code == 422
    assert c.post("/consents/me", json={"purpose": "foo", "granted": True, "source": "perfil"}).status_code == 422


def test_consentimentos_exigem_login(client):
    assert client.get("/consents/me").status_code == 401
