"""Alimento pessoal (`mine:<id>`) — Frente R, Tarefa 1.

O alimento pessoal é dado do usuário, não catálogo: nome, porção e às vezes o código de
barras do que ele compra. O isolamento segue o mesmo padrão do diário (RS-03): alheio e
inexistente produzem o MESMO 404, pelo mesmo caminho.
"""

from tests.diary_helpers import criar, entradas, id_da_unica_entrada

NOT_FOUND = {"code": "USER_FOOD_NOT_FOUND", "message": "Alimento não encontrado."}

GRANOLA_CASEIRA = {
    "name": "Granola caseira",
    "portion_label": "1 pote (40 g)",
    "portion_grams": 40,
    "kcal": 150,
    "protein_g": 4.5,
    "carbs_g": 20,
    "fat_g": 6,
}


def _novo(cli, **extra):
    res = cli.post("/diary/foods/mine", json={**GRANOLA_CASEIRA, **extra})
    assert res.status_code == 201, res.text
    return res.json()


def test_cria_lista_edita_apaga_mine(make_user):
    cli = make_user()

    criado = _novo(cli)
    assert criado["food_ref"] == f"mine:{criado['id']}"
    assert criado["name"] == "Granola caseira"
    assert criado["barcode"] is None

    lista = cli.get("/diary/foods/mine").json()["items"]
    assert [i["id"] for i in lista] == [criado["id"]]

    res = cli.patch(f"/diary/foods/mine/{criado['id']}", json={"kcal": 160})
    assert res.status_code == 200, res.text
    assert res.json()["kcal"] == 160
    assert res.json()["name"] == "Granola caseira"

    assert cli.get(f"/diary/foods/mine/{criado['id']}").json()["kcal"] == 160

    res = cli.delete(f"/diary/foods/mine/{criado['id']}")
    assert res.status_code == 200
    assert res.json() == {"ok": True}
    assert cli.get("/diary/foods/mine").json()["items"] == []


def test_patch_vazio_422(make_user):
    cli = make_user()
    criado = _novo(cli)
    assert cli.patch(f"/diary/foods/mine/{criado['id']}", json={}).status_code == 422


def test_campo_extra_422(make_user):
    cli = make_user()
    res = cli.post("/diary/foods/mine", json={**GRANOLA_CASEIRA, "user_id": 99})
    assert res.status_code == 422


def test_barcode_busca_e_unico_por_usuario(make_user):
    cli_a = make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com")

    criado = _novo(cli_a, barcode="7891000100103")

    achados = cli_a.get("/diary/foods/mine", params={"barcode": "7891000100103"})
    assert achados.status_code == 200
    assert [i["id"] for i in achados.json()["items"]] == [criado["id"]]
    assert cli_a.get("/diary/foods/mine", params={"barcode": "7891000100110"}).json()[
        "items"
    ] == []

    repetido = cli_a.post(
        "/diary/foods/mine", json={**GRANOLA_CASEIRA, "barcode": "7891000100103"}
    )
    assert repetido.status_code == 409
    assert repetido.json()["detail"]["code"] == "BARCODE_ALREADY_USED"

    # O mesmo código em OUTRA conta é permitido — e a busca de B não vê o de A.
    assert cli_b.get("/diary/foods/mine", params={"barcode": "7891000100103"}).json()[
        "items"
    ] == []
    _novo(cli_b, barcode="7891000100103")

    # Trocar para um código já usado também é 409; desligar com null é permitido.
    outro = _novo(cli_a, barcode="7891000100110")
    res = cli_a.patch(f"/diary/foods/mine/{outro['id']}", json={"barcode": "7891000100103"})
    assert res.status_code == 409
    res = cli_a.patch(f"/diary/foods/mine/{outro['id']}", json={"barcode": None})
    assert res.status_code == 200
    assert res.json()["barcode"] is None


def test_barcode_invalido_422(make_user):
    cli = make_user()
    for ruim in ("123", "abc12345", "1" * 15):
        res = cli.post("/diary/foods/mine", json={**GRANOLA_CASEIRA, "barcode": ruim})
        assert res.status_code == 422, ruim
    assert cli.get("/diary/foods/mine", params={"barcode": "abc"}).status_code == 422


def test_mine_alheio_404_identico(make_user):
    cli_a = make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com")
    criado = _novo(cli_a)

    inexistente = cli_b.get("/diary/foods/mine/999999")
    alheio = cli_b.get(f"/diary/foods/mine/{criado['id']}")
    assert alheio.status_code == inexistente.status_code == 404
    assert alheio.json()["detail"] == inexistente.json()["detail"] == NOT_FOUND

    assert cli_b.patch(f"/diary/foods/mine/{criado['id']}", json={"kcal": 1}).json()[
        "detail"
    ] == NOT_FOUND
    assert cli_b.delete(f"/diary/foods/mine/{criado['id']}").json()["detail"] == NOT_FOUND
    assert cli_b.get("/diary/foods/mine").json()["items"] == []

    # Do dono continua intacto.
    assert cli_a.get(f"/diary/foods/mine/{criado['id']}").json()["kcal"] == 150


def test_post_diary_com_mine(make_user):
    cli = make_user()
    criado = _novo(cli)

    res = criar(cli, food_ref=criado["food_ref"], quantity=2, unit="porcao")
    assert res.status_code == 201, res.text
    [entrada] = entradas(res.json())
    assert entrada["food_name"] == "Granola caseira"
    assert entrada["calories_total"] == 300.0
    assert entrada["protein_g_total"] == 9.0
    assert entrada["source"] == "user"
    assert entrada["is_estimate"] is False
    assert entrada["base_unit"] == "un"


def test_post_diary_mine_unidade_g_422(make_user):
    cli = make_user()
    criado = _novo(cli)
    res = criar(cli, food_ref=criado["food_ref"], quantity=40, unit="g")
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "UNIT_NOT_SUPPORTED_FOR_FOOD"


def test_post_diary_com_mine_alheio_404_food_not_resolved(make_user):
    cli_a = make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com")
    criado = _novo(cli_a)

    alheio = criar(cli_b, food_ref=criado["food_ref"], quantity=1, unit="porcao")
    inexistente = criar(cli_b, food_ref="mine:999999", quantity=1, unit="porcao")
    assert alheio.status_code == inexistente.status_code == 404
    assert alheio.json() == inexistente.json()
    assert alheio.json()["detail"]["code"] == "FOOD_NOT_RESOLVED"


def test_entrada_sobrevive_a_apagar_mine(make_user):
    cli = make_user()
    criado = _novo(cli)
    dia = criar(cli, food_ref=criado["food_ref"], quantity=1, unit="porcao").json()
    entry_id = id_da_unica_entrada(dia)

    cli.delete(f"/diary/foods/mine/{criado['id']}")

    res = cli.get(f"/diary/{entry_id}")
    assert res.status_code == 200
    assert res.json()["calories_total"] == 150.0


def test_food_option_do_mine(make_user, db_session):
    """Contrato da Frente B: `opcao_do_mine` monta a FoodOption por porção."""
    from app.models.user_food import UserFood
    from app.services.diary_registro import opcao_do_mine

    cli = make_user()
    criado = _novo(cli)
    linha = db_session.get(UserFood, criado["id"])
    opcao = opcao_do_mine(linha)
    assert opcao.food_ref == criado["food_ref"]
    assert opcao.base_unit == "un"
    assert opcao.kcal_per_base_unit == 150
    assert opcao.allowed_units == ["un", "fatia", "porcao"]
    assert opcao.portion_label == "1 pote (40 g)"
    assert opcao.source == "user"
    assert opcao.is_estimate is False


def test_gancho_barcode_da_frente_b(make_user, db_session):
    from app.services.diary_registro import opcao_do_mine_por_barcode
    from tests.diary_helpers import usuario

    cli_a = make_user(email="a@example.com")
    make_user(email="b@example.com")
    criado = _novo(cli_a, barcode="7891000100103")
    a = usuario(db_session, "a@example.com")
    b = usuario(db_session, "b@example.com")

    assert opcao_do_mine_por_barcode(db_session, a.id, "7891000100103").food_ref == criado[
        "food_ref"
    ]
    assert opcao_do_mine_por_barcode(db_session, b.id, "7891000100103") is None
