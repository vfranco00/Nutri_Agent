def _recipe_payload(title="Frango com batata doce"):
    return {
        "title": title,
        "instructions": "Grelhar o frango e assar a batata doce.",
        "prep_time": 30,
        "calories": 450,
        "category": "almoco",
        "ingredients": [
            {"name": "Frango", "quantity": 150, "unit": "g", "calories": 250},
        ],
    }


def test_create_recipe(make_user):
    auth_client = make_user(email="chef@example.com")
    res = auth_client.post("/recipes/", json=_recipe_payload())
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Frango com batata doce"
    assert len(data["ingredients"]) == 1
    # toda receita criada nasce pública (regra de negócio do app: contribui pra comunidade)
    assert data["is_public"] is True


def test_list_my_recipes_only_shows_own(make_user):
    a_client = make_user(email="ownera@example.com")
    b_client = make_user(email="ownerb@example.com")
    a_client.post("/recipes/", json=_recipe_payload("Receita da A"))
    b_client.post("/recipes/", json=_recipe_payload("Receita da B"))

    res = a_client.get("/recipes/")
    titles = [r["title"] for r in res.json()]
    assert "Receita da A" in titles
    assert "Receita da B" not in titles


def test_public_recipes_include_any_users_recipe(make_user):
    a_client = make_user(email="publica@example.com")
    b_client = make_user(email="observadora@example.com")
    a_client.post("/recipes/", json=_recipe_payload("Receita Pública Teste"))

    res = b_client.get("/recipes/public")
    titles = [r["title"] for r in res.json()]
    assert "Receita Pública Teste" in titles


def test_update_recipe_by_owner_succeeds(make_user):
    auth_client = make_user(email="editora@example.com")
    recipe_id = auth_client.post("/recipes/", json=_recipe_payload()).json()["id"]

    res = auth_client.put(f"/recipes/{recipe_id}", json={"title": "Título Editado"})
    assert res.status_code == 200
    assert res.json()["title"] == "Título Editado"


def test_update_recipe_by_non_owner_is_forbidden(make_user):
    owner_client = make_user(email="dona@example.com")
    other_client = make_user(email="intrusa@example.com")
    recipe_id = owner_client.post("/recipes/", json=_recipe_payload()).json()["id"]

    res = other_client.put(f"/recipes/{recipe_id}", json={"title": "Hackeado"})
    assert res.status_code == 403


def test_delete_recipe_by_non_owner_is_forbidden(make_user):
    # Regressão do bug de segurança: delete_recipe não checava dono.
    owner_client = make_user(email="dona2@example.com")
    other_client = make_user(email="intrusa2@example.com")
    recipe_id = owner_client.post("/recipes/", json=_recipe_payload()).json()["id"]

    res = other_client.delete(f"/recipes/{recipe_id}")
    assert res.status_code == 403


def test_delete_recipe_by_owner_succeeds(make_user):
    auth_client = make_user(email="dona3@example.com")
    recipe_id = auth_client.post("/recipes/", json=_recipe_payload()).json()["id"]

    res = auth_client.delete(f"/recipes/{recipe_id}")
    assert res.status_code == 200

    res_list = auth_client.get("/recipes/")
    assert recipe_id not in [r["id"] for r in res_list.json()]


def test_delete_nonexistent_recipe_returns_404(make_user):
    auth_client = make_user(email="fantasma@example.com")
    res = auth_client.delete("/recipes/999999")
    assert res.status_code == 404


def test_update_recipe_replaces_ingredients(make_user):
    auth_client = make_user(email="ingredientes_upd@example.com")
    recipe_id = auth_client.post("/recipes/", json=_recipe_payload()).json()["id"]

    res = auth_client.put(
        f"/recipes/{recipe_id}",
        json={"ingredients": [{"name": "Batata Doce", "quantity": 200, "unit": "g", "calories": 154}]},
    )
    assert res.status_code == 200
    ingredients = res.json()["ingredients"]
    assert len(ingredients) == 1
    assert ingredients[0]["name"] == "Batata Doce"


def test_recommendations_fallback_to_public_without_profile(make_user):
    auth_client = make_user(email="recomenda@example.com")
    other_client = make_user(email="recomenda_dona@example.com")
    other_client.post("/recipes/", json=_recipe_payload("Receita Recomendável"))

    res = auth_client.get("/recipes/recommendations")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
