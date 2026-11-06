"""L1.2: exportação e exclusão de conta pelo titular (LGPD Arts. 18 e 19)."""
import pytest

from app.models.consent import Consent
from app.models.diary import DiaryEntry
from app.models.feedback import FeedbackTicket
from app.models.food_cache import FoodCache
from app.models.meal_plan import MealPlan
from app.models.payment import Payment
from app.models.push_subscription import PushSubscription
from app.models.subscription import UsageEvent
from app.models.user import User
from tests.lgpd_helpers import semear

SENHA = "strongpassword123"


@pytest.fixture
def mp(monkeypatch):
    chamadas = []

    def fake(preapproval_id):
        chamadas.append(preapproval_id)
        return True

    monkeypatch.setattr("app.services.account_erasure.cancel_preapproval", fake)
    return chamadas


def _uid(db, email):
    return db.query(User).filter(User.email == email).one().id


def test_exportacao_sem_senha_hash(make_user, db_session):
    c = make_user(email="exp@example.com")
    semear(db_session, db_session.query(User).filter(User.email == "exp@example.com").one())
    r = c.get("/privacy/export")
    assert r.status_code == 200
    assert 'attachment; filename="nuvi-meus-dados.json"' in r.headers["content-disposition"]
    assert "hashed_password" not in r.text and "$argon2" not in r.text
    corpo = r.json()
    assert corpo["user"]["email"] == "exp@example.com"
    d = corpo["data"]
    for tabela in ("profiles", "diary_entries", "weight_history", "water_entries", "recipes",
                   "meal_plans", "meal_plan_days", "consents", "subscriptions", "payments"):
        assert d[tabela], tabela
    assert "push_subscriptions" not in d


def test_exportacao_isolada_por_usuario(make_user, db_session):
    a = make_user(email="a@example.com")
    make_user(email="b@example.com")
    semear(db_session, db_session.query(User).filter(User.email == "a@example.com").one(), sufixo="a")
    semear(db_session, db_session.query(User).filter(User.email == "b@example.com").one(), sufixo="b")
    corpo = a.get("/privacy/export").json()
    uid_a = _uid(db_session, "a@example.com")
    for tabela, linhas in corpo["data"].items():
        for linha in linhas:
            if "user_id" in linha:
                assert linha["user_id"] == uid_a, tabela
    assert "b@example.com" not in a.get("/privacy/export").text


def test_exportacao_exige_login(client):
    assert client.get("/privacy/export").status_code == 401


def test_exclusao_exige_senha_correta(make_user, mp):
    c = make_user(email="s@example.com")
    assert c.request("DELETE", "/privacy/account", json={"password": "errada-errada"}).status_code == 403
    assert c.request("DELETE", "/privacy/account", json={}).status_code == 422
    assert mp == []


def test_exclusao_com_pagamento_evento_e_chamado(make_user, db_session, mp):
    c = make_user(email="del@example.com")
    u = db_session.query(User).filter(User.email == "del@example.com").one()
    uid = u.id
    semear(db_session, u)
    other = make_user(email="outro@example.com")
    semear(db_session, db_session.query(User).filter(User.email == "outro@example.com").one(),
           mp_id="PRE-OUTRO", sufixo="o")

    r = c.request("DELETE", "/privacy/account", json={"password": SENHA})
    assert r.status_code == 200, r.text
    db_session.expire_all()
    assert db_session.query(User).filter(User.id == uid).count() == 0
    # pagamento fica, anonimizado (Art. 16, I)
    pg = db_session.query(Payment).filter(Payment.mp_payment_id == f"pay-a-{uid}").one()
    assert pg.user_id is None and pg.amount_brl == 19.9
    assert db_session.query(UsageEvent).filter(UsageEvent.user_id == uid).count() == 0
    assert db_session.query(FeedbackTicket).filter(FeedbackTicket.email == "del@example.com").count() == 0
    assert db_session.query(PushSubscription).filter(PushSubscription.user_id == uid).count() == 0
    assert db_session.query(MealPlan).filter(MealPlan.user_id == uid).count() == 0
    assert db_session.query(DiaryEntry).filter(DiaryEntry.user_id == uid).count() == 0
    assert db_session.query(Consent).filter(Consent.user_id == uid).count() == 0
    assert db_session.query(FoodCache).filter(FoodCache.name_normalized == f"pao llm a{uid}").count() == 0
    # o outro usuário não é tocado
    assert other.get("/users/me").status_code == 200
    assert db_session.query(FeedbackTicket).filter(FeedbackTicket.email == "outro@example.com").count() == 1
    assert mp == ["PRE-123"]


def test_exclusao_cancela_mp_antes(make_user, db_session, monkeypatch):
    c = make_user(email="ordem@example.com")
    u = db_session.query(User).filter(User.email == "ordem@example.com").one()
    semear(db_session, u)
    visto = {}

    def fake(preapproval_id):
        db_session.expire_all()
        visto["usuario_existia"] = db_session.query(User).filter(User.email == "ordem@example.com").count()
        return True

    monkeypatch.setattr("app.services.account_erasure.cancel_preapproval", fake)
    assert c.request("DELETE", "/privacy/account", json={"password": SENHA}).status_code == 200
    assert visto["usuario_existia"] == 1


def test_falha_mp_nao_apaga(make_user, db_session, monkeypatch):
    c = make_user(email="falha@example.com")
    u = db_session.query(User).filter(User.email == "falha@example.com").one()
    semear(db_session, u)
    monkeypatch.setattr("app.services.account_erasure.cancel_preapproval", lambda _id: False)
    r = c.request("DELETE", "/privacy/account", json={"password": SENHA})
    assert r.status_code == 502
    db_session.expire_all()
    assert db_session.query(User).filter(User.email == "falha@example.com").count() == 1
    assert db_session.query(DiaryEntry).count() == 1
    assert db_session.query(Payment).one().user_id is not None


def test_admin_delete_usa_o_mesmo_servico(make_user, db_session, mp):
    admin = make_user(email="adm@example.com", superuser=True)
    make_user(email="alvo@example.com")
    alvo = db_session.query(User).filter(User.email == "alvo@example.com").one()
    semear(db_session, alvo)
    r = admin.delete(f"/users/{alvo.id}")
    assert r.status_code == 200
    db_session.expire_all()
    assert db_session.query(Payment).one().user_id is None
    assert mp == ["PRE-123"]
