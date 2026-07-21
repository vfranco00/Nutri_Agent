def _create_recipe(auth_client, title="Receita Base"):
    payload = {
        "title": title,
        "instructions": "Misturar tudo.",
        "category": "almoco",
        "ingredients": [],
    }
    return auth_client.post("/recipes/", json=payload).json()["id"]


def test_add_ingredient_to_own_recipe(make_user):
    auth_client = make_user(email="ingra@example.com")
    recipe_id = _create_recipe(auth_client)

    res = auth_client.post(
        "/ingredients/",
        json={"recipe_id": recipe_id, "name": "Ovo", "quantity": 2, "unit": "un", "calories": 140},
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Ovo"


def test_add_ingredient_to_other_users_recipe_is_forbidden(make_user):
    owner_client = make_user(email="donaing@example.com")
    other_client = make_user(email="intrusaing@example.com")
    recipe_id = _create_recipe(owner_client)

    res = other_client.post(
        "/ingredients/",
        json={"recipe_id": recipe_id, "name": "Ovo", "quantity": 2, "unit": "un"},
    )
    assert res.status_code == 403


def test_list_ingredients_by_recipe(make_user):
    auth_client = make_user(email="listing@example.com")
    recipe_id = _create_recipe(auth_client)
    auth_client.post(
        "/ingredients/",
        json={"recipe_id": recipe_id, "name": "Arroz", "quantity": 100, "unit": "g"},
    )

    res = auth_client.get(f"/ingredients/recipe/{recipe_id}")
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_list_ingredients_of_other_users_recipe_is_forbidden(make_user):
    owner_client = make_user(email="donaing2@example.com")
    other_client = make_user(email="intrusaing2@example.com")
    recipe_id = _create_recipe(owner_client)

    res = other_client.get(f"/ingredients/recipe/{recipe_id}")
    assert res.status_code == 403
