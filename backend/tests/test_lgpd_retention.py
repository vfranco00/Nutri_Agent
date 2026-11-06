"""L1.4: job de retenção, um teste por regra, com datas fixas."""
from datetime import datetime, timedelta

from app.models.feedback import FeedbackTicket
from app.models.food_cache import FoodCache
from app.models.push_subscription import PushSubscription
from app.models.subscription import UsageEvent
from app.models.user import User
from app.services.retention import run_retention

AGORA = datetime(2026, 11, 5, 3, 0, 0)


def dias(n):
    return AGORA - timedelta(days=n)


def _user(db, email, **kw):
    u = User(email=email, hashed_password="x", **kw)
    db.add(u)
    db.commit()
    return u


def _cache(db, nome, source, dono, idade):
    db.add(FoodCache(name=nome, name_normalized=nome, calories_per_unit=1, unit_type="g",
                     source=source, created_by_user_id=dono, created_at=dias(idade)))


def test_food_cache_llm_e_off_sem_uso_ha_90_dias(db_session):
    u = _user(db_session, "a@x.com", created_at=dias(1))
    _cache(db_session, "velho-llm", "llm", u.id, 91)
    _cache(db_session, "velho-off", "openfoodfacts", u.id, 120)
    _cache(db_session, "novo-llm", "llm", u.id, 89)
    _cache(db_session, "taco-velho", "taco", None, 4000)
    _cache(db_session, "curado-velho", "curated", None, 4000)
    db_session.commit()
    r = run_retention(db_session, AGORA)
    restantes = {c.name for c in db_session.query(FoodCache).all()}
    assert restantes == {"novo-llm", "taco-velho", "curado-velho"}
    assert r["food_cache"] == 2


def test_food_cache_orfa_apagada(db_session):
    _cache(db_session, "orfa-llm", "llm", None, 1)
    _cache(db_session, "orfa-off", "openfoodfacts", None, 1)
    _cache(db_session, "taco", "taco", None, 1)
    db_session.commit()
    run_retention(db_session, AGORA)
    assert {c.name for c in db_session.query(FoodCache).all()} == {"taco"}


def test_usage_events_mais_de_12_meses(db_session):
    u = _user(db_session, "b@x.com", created_at=dias(1))
    db_session.add_all([
        UsageEvent(user_id=u.id, event_type="chef_ai", created_at=dias(366)),
        UsageEvent(user_id=u.id, event_type="chef_ai", created_at=dias(364)),
    ])
    db_session.commit()
    assert run_retention(db_session, AGORA)["usage_events"] == 1
    assert db_session.query(UsageEvent).count() == 1


def test_conta_nao_verificada_mais_de_30_dias(db_session):
    _user(db_session, "velha@x.com", created_at=dias(31), is_verified=False)
    _user(db_session, "nova@x.com", created_at=dias(29), is_verified=False)
    _user(db_session, "ok@x.com", created_at=dias(400), is_verified=True)
    assert run_retention(db_session, AGORA)["unverified_accounts"] == 1
    assert {u.email for u in db_session.query(User).all()} == {"nova@x.com", "ok@x.com"}


def test_chamados_fechados_ha_mais_de_24_meses(db_session):
    def t(msg, status, resolved):
        return FeedbackTicket(email="q@x.com", category="c", message=msg, status=status,
                              resolved_at=resolved, created_at=dias(900))
    db_session.add_all([
        t("velho-fechado", "resolvido", dias(731)),
        t("recente-fechado", "resolvido", dias(700)),
        t("velho-aberto", "aberto", None),
    ])
    db_session.commit()
    assert run_retention(db_session, AGORA)["feedback_tickets"] == 1
    assert {f.message for f in db_session.query(FeedbackTicket).all()} == {"recente-fechado", "velho-aberto"}


def test_push_sem_envio_com_sucesso_ha_90_dias(db_session):
    u = _user(db_session, "p@x.com", created_at=dias(1))

    def s(i, criada, ok):
        return PushSubscription(user_id=u.id, endpoint=f"https://fcm.googleapis.com/fcm/send/{i}",
                                p256dh="k", auth="a", created_at=criada, last_success_at=ok)
    db_session.add_all([
        s("velha-sem-envio", dias(100), None),       # nunca enviou e já passou de 90 dias
        s("velha-sucesso-antigo", dias(300), dias(91)),
        s("sucesso-recente", dias(300), dias(5)),
        s("nova", dias(10), None),
    ])
    db_session.commit()
    assert run_retention(db_session, AGORA)["push_subscriptions"] == 2
    assert {p.endpoint.rsplit("/", 1)[1] for p in db_session.query(PushSubscription).all()} == {
        "sucesso-recente", "nova"}


def test_endpoint_interno_exige_segredo(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "CRON_SECRET", "segredo")
    assert client.post("/internal/retention/run").status_code == 401
    assert client.post("/internal/retention/run", headers={"X-Cron-Secret": "errado"}).status_code == 401
    r = client.post("/internal/retention/run", headers={"X-Cron-Secret": "segredo"})
    assert r.status_code == 200
    assert set(r.json()) == {"food_cache", "usage_events", "unverified_accounts",
                             "feedback_tickets", "push_subscriptions"}


def test_endpoint_interno_fechado_sem_segredo_configurado(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "CRON_SECRET", "")
    assert client.post("/internal/retention/run", headers={"X-Cron-Secret": ""}).status_code == 503
