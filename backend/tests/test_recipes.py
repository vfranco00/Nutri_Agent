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
    # ANTES: o router sobrescrevia com is_public=True e publicava TODA receita no feed
    # da comunidade, ignorando o payload. Agora a decisão é de quem cria, e o default
    # é privado (fail-closed): quem não pediu pra publicar, não publica.
    assert data["is_public"] is False


def test_create_recipe_honors_explicit_public_flag(make_user):
    auth_client = make_user(email="chefpublico@example.com")
    payload = {**_recipe_payload("Receita compartilhada"), "is_public": True}
    res = auth_client.post("/recipes/", json=payload)
    assert res.status_code == 200
    assert res.json()["is_public"] is True


def test_private_recipe_does_not_leak_into_community_feed(make_user):
    a_client = make_user(email="reservada@example.com")
    b_client = make_user(email="curiosa@example.com")
    a_client.post("/recipes/", json={**_recipe_payload("Segredo de família"), "is_public": False})

    titles = [r["title"] for r in b_client.get("/recipes/public").json()]
    assert "Segredo de família" not in titles


def test_create_recipe_deduplicates_identical_resubmission(make_user):
    # Regressão de duplo clique / retry de rede: o mesmo payload (título +
    # instruções) enviado duas vezes pro mesmo usuário não deve virar duas
    # receitas — a segunda chamada devolve a receita já existente.
    auth_client = make_user(email="duplo_clique@example.com")
    first = auth_client.post("/recipes/", json=_recipe_payload())
    second = auth_client.post("/recipes/", json=_recipe_payload())

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]

    res_list = auth_client.get("/recipes/")
    assert len(res_list.json()) == 1


def test_create_recipe_dedup_is_case_and_whitespace_insensitive(make_user):
    auth_client = make_user(email="duplo_clique_case@example.com")
    first = auth_client.post("/recipes/", json=_recipe_payload("Frango com batata doce"))
    second = auth_client.post("/recipes/", json=_recipe_payload("  FRANGO COM BATATA DOCE  "))

    assert first.json()["id"] == second.json()["id"]
    assert len(auth_client.get("/recipes/").json()) == 1


def test_create_recipe_same_title_different_instructions_is_not_a_duplicate(make_user):
    # Título repetido não é sinal suficiente de duplicata — só título +
    # instruções idênticos é que indica reenvio acidental do mesmo payload.
    auth_client = make_user(email="titulo_repetido@example.com")
    payload_a = _recipe_payload()
    payload_b = _recipe_payload()
    payload_b["instructions"] = "Modo de preparo completamente diferente."

    first = auth_client.post("/recipes/", json=payload_a)
    second = auth_client.post("/recipes/", json=payload_b)

    assert first.json()["id"] != second.json()["id"]
    assert len(auth_client.get("/recipes/").json()) == 2


def test_create_recipe_dedup_is_scoped_per_user(make_user):
    a_client = make_user(email="dedup_a@example.com")
    b_client = make_user(email="dedup_b@example.com")

    res_a = a_client.post("/recipes/", json=_recipe_payload())
    res_b = b_client.post("/recipes/", json=_recipe_payload())

    assert res_a.json()["id"] != res_b.json()["id"]


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
    # is_public explícito: publicar deixou de ser efeito colateral do salvamento.
    a_client.post("/recipes/", json={**_recipe_payload("Receita Pública Teste"), "is_public": True})

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
