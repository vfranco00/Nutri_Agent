import json


def _profile_payload():
    return {
        "age": 28,
        "weight": 70.0,
        "height": 175.0,
        "gender": "female",
        "activity_level": "moderately_active",
        "goal": "maintain",
    }


def test_calculate_calories_uses_taco_deterministically(make_user):
    auth_client = make_user(email="calorias@example.com")
    res = auth_client.post("/ai/calculate-calories", json={"name": "Arroz Branco Cozido", "quantity": 100, "unit": "g"})
    assert res.status_code == 200
    assert res.json()["total_calories"] == 128.0


def test_generate_plan_requires_profile(make_user):
    auth_client = make_user(email="semperfil_ia@example.com")
    res = auth_client.post("/ai/generate-plan", json={"days": 1, "meals_count": 3})
    assert res.status_code == 400


def test_generate_plan_with_mocked_gemini(make_user, monkeypatch):
    auth_client = make_user(email="comperfil_ia@example.com")
    auth_client.put("/profiles/me", json=_profile_payload())

    fake_plan = {
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
    monkeypatch.setattr("app.services.ai.call_gemini", lambda prompt: json.dumps(fake_plan))

    res = auth_client.post("/ai/generate-plan", json={"days": 1, "meals_count": 3})
    assert res.status_code == 200
    assert res.json()["days"][0]["day"] == "Dia 1"


def test_generate_plan_fails_gracefully_when_gemini_unavailable(make_user, monkeypatch):
    auth_client = make_user(email="iaoffline@example.com")
    auth_client.put("/profiles/me", json=_profile_payload())

    monkeypatch.setattr("app.services.ai.call_gemini", lambda prompt: None)

    res = auth_client.post("/ai/generate-plan", json={"days": 1, "meals_count": 3})
    assert res.status_code == 500


def test_recipe_by_ingredients_with_mocked_gemini(make_user, monkeypatch):
    auth_client = make_user(email="receitaia@example.com")
    fake_recipe = {
        "title": "Omelete Simples",
        "instructions": "Bata os ovos e frite.",
        "prep_time": 10,
        "calories": 300,
        "ingredients": [{"name": "Ovo", "quantity": 2, "unit": "un", "calories": 140}],
    }
    monkeypatch.setattr("app.services.ai.call_gemini", lambda prompt: json.dumps(fake_recipe))

    res = auth_client.post("/ai/recipe-by-ingredients", json={"ingredients": ["ovo"]})
    assert res.status_code == 200
    assert res.json()["title"] == "Omelete Simples"


def test_plan_to_shopping_list_with_mocked_gemini(make_user, monkeypatch):
    auth_client = make_user(email="listaia@example.com")
    fake_list = {"title": "Lista da Semana", "items": ["Arroz", "Feijão"]}
    monkeypatch.setattr("app.services.ai.call_gemini", lambda prompt: json.dumps(fake_list))

    res = auth_client.post("/ai/plan-to-shopping-list", json={"days": []})
    assert res.status_code == 200
    assert res.json()["items"] == ["Arroz", "Feijão"]
