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


def test_meal_plan_cannot_reference_another_users_private_recipe(make_user):
    """BOLA: `recipe_id` vinha cru do payload e nunca era conferido contra o dono.

    O atacante criava um plano alimentar apontando pra IDs de receita que não são
    dele — são sequenciais, então basta iterar — e o GET do plano devolvia o objeto
    `recipe` preenchido com título, calorias e categoria da receita PRIVADA da vítima.
    Enumerar a base inteira de receitas era um laço.
    """
    vitima = make_user(email="dona_da_receita@example.com")
    atacante = make_user(email="bisbilhoteira@example.com")

    privada_id = vitima.post(
        "/recipes/",
        json={
            "title": "Receita privada da vítima",
            "instructions": "Segredo.",
            "calories": 400,
            "is_public": False,
            "ingredients": [],
        },
    ).json()["id"]

    payload = {
        "title": "Plano bisbilhoteiro",
        "source": "manual",
        "days": [
            {
                "day_label": "Dia 1",
                "day_index": 0,
                "meals": [{"slot_name": "Almoço", "recipe_id": privada_id}],
            }
        ],
    }
    res = atacante.post("/meal-plans/", json=payload)
    assert res.status_code == 404

    # E o plano não pode ter sido criado pela metade.
    assert atacante.get("/meal-plans/").json() == []


def test_meal_plan_can_reference_a_public_community_recipe(make_user):
    # O bloqueio é de ownership, não de existência: receita publicada na comunidade o
    # usuário já pode ler, então montar um plano com ela continua valendo.
    autora = make_user(email="autora_publica@example.com")
    outra = make_user(email="montadora@example.com")

    publica_id = autora.post(
        "/recipes/",
        json={
            "title": "Receita da comunidade",
            "instructions": "Preparar.",
            "calories": 400,
            "is_public": True,
            "ingredients": [],
        },
    ).json()["id"]

    payload = {
        "title": "Plano com receita da comunidade",
        "source": "manual",
        "days": [
            {
                "day_label": "Dia 1",
                "day_index": 0,
                "meals": [{"slot_name": "Almoço", "recipe_id": publica_id}],
            }
        ],
    }
    assert outra.post("/meal-plans/", json=payload).status_code == 200


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


def test_owner_can_rename_meal_plan(make_user):
    auth_client = make_user(email="renomeia_plano@example.com")
    plan_id = auth_client.post(
        "/meal-plans/", json={"title": "Nome Original", "source": "manual", "days": []}
    ).json()["id"]

    res = auth_client.patch(f"/meal-plans/{plan_id}", json={"title": "Nome Novo"})
    assert res.status_code == 200
    assert res.json()["title"] == "Nome Novo"

    res_get = auth_client.get(f"/meal-plans/{plan_id}")
    assert res_get.json()["title"] == "Nome Novo"


def test_rename_meal_plan_from_other_user_returns_404(make_user):
    owner_client = make_user(email="dono_rename@example.com")
    other_client = make_user(email="intruso_rename@example.com")
    plan_id = owner_client.post(
        "/meal-plans/", json={"title": "Plano Privado 3", "source": "manual", "days": []}
    ).json()["id"]

    res = other_client.patch(f"/meal-plans/{plan_id}", json={"title": "Hackeado"})
    assert res.status_code == 404


def test_rename_meal_plan_rejects_empty_title(make_user):
    auth_client = make_user(email="renomeia_vazio@example.com")
    plan_id = auth_client.post(
        "/meal-plans/", json={"title": "Nome Original", "source": "manual", "days": []}
    ).json()["id"]

    res = auth_client.patch(f"/meal-plans/{plan_id}", json={"title": ""})
    assert res.status_code == 422
