def _create_recipe(auth_client, title="Receita pro Plano"):
    payload = {"title": title, "instructions": "Preparar.", "calories": 400, "ingredients": []}
    return auth_client.post("/recipes/", json=payload).json()["id"]


def test_create_manual_meal_plan_with_recipe(make_user):
    auth_client = make_user(email="plano_manual@example.com")
    recipe_id = _create_recipe(auth_client)

    payload = {
        "title": "Meu Plano",
        "source": "manual",
        "days": [
            {
                "day_label": "Dia 1",
                "day_index": 0,
                "meals": [{"slot_name": "Almoço", "recipe_id": recipe_id}],
            }
        ],
    }
    res = auth_client.post("/meal-plans/", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["source"] == "manual"
    assert data["days"][0]["meals"][0]["recipe"]["id"] == recipe_id


def test_create_ai_sourced_meal_plan_with_free_text(make_user):
    auth_client = make_user(email="plano_ia@example.com")
    payload = {
        "title": "Cardápio do Dia (IA)",
        "source": "ai",
        "days": [
            {
                "day_label": "Dia 1",
                "day_index": 0,
                "calories_target": 2000,
                "macros_protein": "150g",
                "meals": [
                    {
                        "slot_name": "Café da Manhã",
                        "custom_title": "Café da Manhã",
                        "custom_description": "Ovos mexidos com pão integral",
                    }
                ],
            }
        ],
    }
    res = auth_client.post("/meal-plans/", json=payload)
    assert res.status_code == 200
    meal = res.json()["days"][0]["meals"][0]
    assert meal["recipe"] is None
    assert meal["custom_description"] == "Ovos mexidos com pão integral"


def test_meal_without_recipe_or_custom_content_is_rejected(make_user):
    auth_client = make_user(email="plano_invalido@example.com")
    payload = {
        "title": "Plano Quebrado",
        "source": "manual",
        "days": [{"day_label": "Dia 1", "day_index": 0, "meals": [{"slot_name": "Almoço"}]}],
    }
    res = auth_client.post("/meal-plans/", json=payload)
    assert res.status_code == 422


def test_list_meal_plans_only_shows_own(make_user):
    a_client = make_user(email="plano_a@example.com")
    b_client = make_user(email="plano_b@example.com")
    a_client.post("/meal-plans/", json={"title": "Plano da A", "source": "manual", "days": []})
    b_client.post("/meal-plans/", json={"title": "Plano da B", "source": "manual", "days": []})

    res = a_client.get("/meal-plans/")
    titles = [p["title"] for p in res.json()]
    assert "Plano da A" in titles
    assert "Plano da B" not in titles


def test_get_meal_plan_from_other_user_returns_404(make_user):
    # Regressão: aprendendo com o bug de delete_recipe sem ownership check.
    owner_client = make_user(email="dono_plano@example.com")
    other_client = make_user(email="intruso_plano@example.com")
    plan_id = owner_client.post(
        "/meal-plans/", json={"title": "Plano Privado", "source": "manual", "days": []}
    ).json()["id"]

    res = other_client.get(f"/meal-plans/{plan_id}")
    assert res.status_code == 404


def test_delete_meal_plan_from_other_user_returns_404(make_user):
    owner_client = make_user(email="dono_plano2@example.com")
    other_client = make_user(email="intruso_plano2@example.com")
    plan_id = owner_client.post(
        "/meal-plans/", json={"title": "Plano Privado 2", "source": "manual", "days": []}
    ).json()["id"]

    res = other_client.delete(f"/meal-plans/{plan_id}")
    assert res.status_code == 404


def test_owner_can_delete_own_meal_plan(make_user):
    auth_client = make_user(email="dono_plano3@example.com")
    plan_id = auth_client.post(
        "/meal-plans/", json={"title": "Plano Descartável", "source": "manual", "days": []}
    ).json()["id"]

    res = auth_client.delete(f"/meal-plans/{plan_id}")
    assert res.status_code == 200
