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


def test_recipe_by_ingredients_scales_prompt_for_servings(make_user, monkeypatch):
    auth_client = make_user(email="porcoes@example.com")
    captured_prompts = []

    def fake_gemini(prompt):
        captured_prompts.append(prompt)
        return json.dumps({
            "title": "Frango pra Família",
            "instructions": "Asse tudo.",
            "prep_time": 40,
            "calories": 1800,
            "ingredients": [{"name": "Frango", "quantity": 800, "unit": "g", "calories": 1200}],
        })

    monkeypatch.setattr("app.services.ai.call_gemini", fake_gemini)

    res = auth_client.post("/ai/recipe-by-ingredients", json={"ingredients": ["frango"], "servings": 4})
    assert res.status_code == 200
    assert "4 PESSOA" in captured_prompts[0]


def test_generate_plan_returns_plan_token(make_user, monkeypatch):
    auth_client = make_user(email="token_plano@example.com")
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
    assert res.json()["plan_token"]


def test_swap_meal_blocked_for_starter(make_user, monkeypatch):
    auth_client = make_user(email="troca_starter@example.com", plan="starter")
    auth_client.put("/profiles/me", json=_profile_payload())
    monkeypatch.setattr(
        "app.services.ai.call_gemini",
        lambda prompt: json.dumps({"suggestion": "Salada de grão-de-bico"}),
    )

    res = auth_client.post(
        "/ai/swap-meal",
        json={
            "plan_token": "tok-1",
            "slot_name": "Almoço",
            "calories_target": 500,
            "current_suggestion": "Frango com arroz",
            "avoid_suggestions": [],
        },
    )
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"


def test_swap_meal_limited_to_two_for_plus(make_user, monkeypatch):
    auth_client = make_user(email="troca_plus@example.com", plan="plus")
    auth_client.put("/profiles/me", json=_profile_payload())
    monkeypatch.setattr(
        "app.services.ai.call_gemini",
        lambda prompt: json.dumps({"suggestion": "Salada de grão-de-bico"}),
    )

    payload = {
        "plan_token": "tok-plus",
        "slot_name": "Almoço",
        "calories_target": 500,
        "current_suggestion": "Frango com arroz",
        "avoid_suggestions": [],
    }

    res1 = auth_client.post("/ai/swap-meal", json=payload)
    assert res1.status_code == 200
    assert res1.json()["swaps_used"] == 1
    assert res1.json()["swaps_limit"] == 2

    res2 = auth_client.post("/ai/swap-meal", json=payload)
    assert res2.status_code == 200
    assert res2.json()["swaps_used"] == 2

    res3 = auth_client.post("/ai/swap-meal", json=payload)
    assert res3.status_code == 403

    # Um plan_token diferente (outro cardápio gerado) tem sua própria cota de novo.
    other_payload = {**payload, "plan_token": "tok-plus-2"}
    res4 = auth_client.post("/ai/swap-meal", json=other_payload)
    assert res4.status_code == 200
    assert res4.json()["swaps_used"] == 1


def test_swap_meal_unlimited_for_pro(make_user, monkeypatch):
    auth_client = make_user(email="troca_pro@example.com", plan="pro")
    auth_client.put("/profiles/me", json=_profile_payload())
    monkeypatch.setattr(
        "app.services.ai.call_gemini",
        lambda prompt: json.dumps({"suggestion": "Salada de grão-de-bico"}),
    )

    payload = {
        "plan_token": "tok-pro",
        "slot_name": "Almoço",
        "calories_target": 500,
        "current_suggestion": "Frango com arroz",
        "avoid_suggestions": [],
    }
    for _ in range(5):
        res = auth_client.post("/ai/swap-meal", json=payload)
        assert res.status_code == 200


def test_swap_meal_requires_profile(make_user):
    auth_client = make_user(email="troca_semperfil@example.com", plan="pro")
    res = auth_client.post(
        "/ai/swap-meal",
        json={
            "plan_token": "tok-semperfil",
            "slot_name": "Almoço",
            "calories_target": 500,
            "current_suggestion": "Frango com arroz",
            "avoid_suggestions": [],
        },
    )
    assert res.status_code == 400


def test_swap_meal_fails_gracefully_when_gemini_unavailable(make_user, monkeypatch):
    auth_client = make_user(email="troca_iaoffline@example.com", plan="pro")
    auth_client.put("/profiles/me", json=_profile_payload())
    monkeypatch.setattr("app.services.ai.call_gemini", lambda prompt: None)

    res = auth_client.post(
        "/ai/swap-meal",
        json={
            "plan_token": "tok-iaoffline",
            "slot_name": "Almoço",
            "calories_target": 500,
            "current_suggestion": "Frango com arroz",
            "avoid_suggestions": [],
        },
    )
    assert res.status_code == 500
