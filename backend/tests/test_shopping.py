def test_starter_plan_is_blocked_from_shopping_list(make_user):
    auth_client = make_user(email="starter_compras@example.com", plan="starter")
    res = auth_client.post("/shopping/", json={"title": "Lista Bloqueada"})
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"


def test_unrecognized_plan_value_is_blocked_from_shopping_list(make_user):
    # Regressão do bug real: um valor de `plan` fora dos três conhecidos
    # (dado corrompido, tier antigo removido do PLAN_LIMITS, etc.) tem que
    # ficar bloqueado por padrão — nunca liberar acesso pago de graça.
    auth_client = make_user(email="plano_estranho@example.com", plan="tier_removido_2024")
    res = auth_client.post("/shopping/", json={"title": "Lista Bloqueada"})
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"


def test_create_shopping_list_with_initial_items(make_user):
    auth_client = make_user(email="compras@example.com", plan="plus")
    res = auth_client.post(
        "/shopping/",
        json={"title": "Compras da Semana", "items": [{"name": "Arroz"}, {"name": "Feijão"}]},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Compras da Semana"
    assert len(data["items"]) == 2


def test_get_lists_only_shows_own(make_user):
    a_client = make_user(email="compra_a@example.com", plan="plus")
    b_client = make_user(email="compra_b@example.com", plan="plus")
    a_client.post("/shopping/", json={"title": "Lista da A"})
    b_client.post("/shopping/", json={"title": "Lista da B"})

    res = a_client.get("/shopping/")
    titles = [l["title"] for l in res.json()]
    assert "Lista da A" in titles
    assert "Lista da B" not in titles


def test_add_toggle_and_delete_item(make_user):
    auth_client = make_user(email="itens@example.com", plan="plus")
    list_id = auth_client.post("/shopping/", json={"title": "Lista"}).json()["id"]

    item = auth_client.post(f"/shopping/{list_id}/items", json={"name": "Leite"}).json()
    assert item["checked"] is False

    toggled = auth_client.patch(f"/shopping/items/{item['id']}/toggle").json()
    assert toggled["checked"] is True

    res_delete = auth_client.delete(f"/shopping/items/{item['id']}")
    assert res_delete.status_code == 200


def test_cannot_add_item_to_other_users_list(make_user):
    owner_client = make_user(email="dona_lista@example.com", plan="plus")
    other_client = make_user(email="intrusa_lista@example.com", plan="plus")
    list_id = owner_client.post("/shopping/", json={"title": "Lista Privada"}).json()["id"]

    res = other_client.post(f"/shopping/{list_id}/items", json={"name": "Item Invasor"})
    assert res.status_code == 404


def test_delete_list(make_user):
    auth_client = make_user(email="deletalista@example.com", plan="plus")
    list_id = auth_client.post("/shopping/", json={"title": "Lista Descartável"}).json()["id"]

    res = auth_client.delete(f"/shopping/{list_id}")
    assert res.status_code == 200

    res_get = auth_client.get("/shopping/")
    assert list_id not in [l["id"] for l in res_get.json()]
