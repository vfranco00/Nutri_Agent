import json


def _profile_payload():
    return {
        "age": 30,
        "weight": 75.0,
        "height": 178.0,
        "gender": "male",
        "activity_level": "sedentary",
        "goal": "maintain",
    }


FAKE_RECIPE = {
    "title": "Receita Rápida",
    "instructions": "Misture tudo.",
    "prep_time": 10,
    "calories": 300,
    "ingredients": [{"name": "Ovo", "quantity": 1, "unit": "un", "calories": 70}],
}

FAKE_PLAN = {
    "days": [
        {
            "day": "Dia 1",
            "calories_target": 2000,
            "macros": {"protein": "150g", "carbs": "200g", "fats": "60g"},
            "meals": [{"name": "Almoço", "suggestion": "Frango com arroz", "category": "almoco"}],
            "tip": "Beba água.",
        }
    ]
}


def test_subscriptions_me_defaults_to_starter(make_user):
    auth_client = make_user(email="planme@example.com", plan="starter")
    res = auth_client.get("/subscriptions/me")
    assert res.status_code == 200
    data = res.json()
    assert data["plan"] == "starter"
    assert data["shopping_list_access"] is False
    assert data["max_saved_meal_plans"] == 5


def test_starter_chef_ai_blocked_after_five_calls_in_a_week(make_user, monkeypatch):
    monkeypatch.setattr("app.services.ai.call_gemini", lambda prompt: json.dumps(FAKE_RECIPE))
    auth_client = make_user(email="chefquota@example.com", plan="starter")

    for _ in range(5):
        res = auth_client.post("/ai/recipe-by-ingredients", json={"ingredients": ["ovo"]})
        assert res.status_code == 200

    blocked = auth_client.post("/ai/recipe-by-ingredients", json={"ingredients": ["ovo"]})
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"


def test_starter_generate_plan_blocked_after_two_calls_in_a_month(make_user, monkeypatch):
    monkeypatch.setattr("app.services.ai.call_gemini", lambda prompt: json.dumps(FAKE_PLAN))
    auth_client = make_user(email="planquota@example.com", plan="starter")
    auth_client.put("/profiles/me", json=_profile_payload())

    for _ in range(2):
        res = auth_client.post("/ai/generate-plan", json={"days": 1, "meals_count": 3})
        assert res.status_code == 200

    blocked = auth_client.post("/ai/generate-plan", json={"days": 1, "meals_count": 3})
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"


def test_plus_weekly_and_daily_plan_limits_are_independent(make_user, monkeypatch):
    monkeypatch.setattr("app.services.ai.call_gemini", lambda prompt: json.dumps(FAKE_PLAN))
    auth_client = make_user(email="plusplan@example.com", plan="plus")
    auth_client.put("/profiles/me", json=_profile_payload())

    # 1x semanal permitido, 2ª bloqueada
    assert auth_client.post("/ai/generate-plan", json={"days": 7, "meals_count": 3}).status_code == 200
    weekly_blocked = auth_client.post("/ai/generate-plan", json={"days": 7, "meals_count": 3})
    assert weekly_blocked.status_code == 403

    # Cardápio diário é uma cota separada — ainda deve funcionar
    assert auth_client.post("/ai/generate-plan", json={"days": 1, "meals_count": 3}).status_code == 200


def test_pro_plan_is_never_blocked(make_user, monkeypatch):
    monkeypatch.setattr("app.services.ai.call_gemini", lambda prompt: json.dumps(FAKE_RECIPE))
    auth_client = make_user(email="proquota@example.com", plan="pro")

    for _ in range(10):
        res = auth_client.post("/ai/recipe-by-ingredients", json={"ingredients": ["ovo"]})
        assert res.status_code == 200


def test_max_saved_meal_plans_for_starter(make_user):
    auth_client = make_user(email="maxplanos@example.com", plan="starter")

    for i in range(5):
        res = auth_client.post(
            "/meal-plans/", json={"title": f"Plano {i}", "source": "manual", "days": []}
        )
        assert res.status_code == 200

    blocked = auth_client.post(
        "/meal-plans/", json={"title": "Plano Extra", "source": "manual", "days": []}
    )
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"


def test_admin_can_change_user_plan(make_user):
    admin_client = make_user(email="adminplan@example.com", superuser=True)
    other_client = make_user(email="alvoplan@example.com", plan="starter")
    other_id = other_client.get("/users/me").json()["id"]

    res = admin_client.put(f"/users/{other_id}/subscription", json={"plan": "pro"})
    assert res.status_code == 200
    assert res.json()["plan"] == "pro"

    confirm = other_client.get("/subscriptions/me")
    assert confirm.json()["plan"] == "pro"


def test_non_admin_cannot_change_plan(make_user):
    regular_client = make_user(email="naoadmin@example.com")
    other_client = make_user(email="alvoplan2@example.com")
    other_id = other_client.get("/users/me").json()["id"]

    res = regular_client.put(f"/users/{other_id}/subscription", json={"plan": "pro"})
    assert res.status_code == 403


def test_checkout_returns_501_without_mercado_pago_credentials(make_user):
    auth_client = make_user(email="checkout@example.com")
    res = auth_client.post("/subscriptions/checkout", json={"plan": "plus"})
    assert res.status_code == 501
    assert res.json()["detail"]["code"] == "CHECKOUT_UNAVAILABLE"


def test_checkout_returns_url_when_mercado_pago_configured(make_user, monkeypatch):
    monkeypatch.setattr(
        "app.routers.subscriptions.create_subscription_checkout",
        lambda user, plan: "https://mercadopago.com/checkout/fake-id",
    )
    auth_client = make_user(email="checkoutok@example.com")
    res = auth_client.post("/subscriptions/checkout", json={"plan": "plus"})
    assert res.status_code == 200
    assert res.json()["checkout_url"] == "https://mercadopago.com/checkout/fake-id"


def test_webhook_activates_plan_on_authorized_status(make_user, db_session, monkeypatch):
    auth_client = make_user(email="webhookuser@example.com", plan="starter")
    user_id = auth_client.get("/users/me").json()["id"]

    monkeypatch.setattr(
        "app.routers.subscriptions.fetch_preapproval",
        lambda preapproval_id: {
            "external_reference": f"user:{user_id}:plan:pro",
            "status": "authorized",
        },
    )

    res = auth_client.post("/subscriptions/webhook/mercadopago", json={"data": {"id": "fake-preapproval-id"}})
    assert res.status_code == 200

    confirm = auth_client.get("/subscriptions/me")
    assert confirm.json()["plan"] == "pro"
    assert confirm.json()["status"] == "active"


def test_webhook_downgrades_to_starter_on_cancelled_status(make_user, monkeypatch):
    auth_client = make_user(email="webhookcancel@example.com", plan="plus")
    user_id = auth_client.get("/users/me").json()["id"]

    monkeypatch.setattr(
        "app.routers.subscriptions.fetch_preapproval",
        lambda preapproval_id: {
            "external_reference": f"user:{user_id}:plan:plus",
            "status": "cancelled",
        },
    )

    res = auth_client.post("/subscriptions/webhook/mercadopago", json={"data": {"id": "fake-preapproval-id"}})
    assert res.status_code == 200

    confirm = auth_client.get("/subscriptions/me")
    assert confirm.json()["plan"] == "starter"
    assert confirm.json()["status"] == "canceled"


def test_webhook_ignores_malformed_payload_without_crashing(client):
    res = client.post("/subscriptions/webhook/mercadopago", json={"foo": "bar"})
    assert res.status_code == 200
    assert res.json() == {"received": True}
