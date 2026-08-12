"""Isolamento entre contas no diário alimentar (RS-01 a RS-06, RS-17).

Por que este arquivo é o primeiro: diário alimentar é prontuário. Um vazamento aqui não
é "o usuário viu um dado errado" — é inferência sobre saúde de terceiro (jejum, transtorno
alimentar, dieta renal, alimentação ritual) a partir de linhas que ninguém deveria
alcançar. Os ids são inteiros sequenciais, então um único caminho que responda diferente
para "não existe" e para "não é seu" transforma um laço de 1 a N num mapa de quem registra
comida, quanto e com que frequência — sem ler uma linha sequer.

Cada teste aqui existe porque a defesa correspondente é invisível: trocar o `.filter()`
escopado por um `get(id)` seguido de `if entrada.user_id != user.id` não muda nenhuma
resposta do caminho feliz, não quebra nenhum outro teste, e abre todos estes buracos de
uma vez.
"""

from datetime import timedelta

from app.models.diary import DiaryEntry, DiaryPlanBinding
from app.models.food_cache import FoodCache

from tests.diary_helpers import (
    ARROZ,
    cardapio,
    criar,
    hoje,
    id_da_unica_entrada,
    semear_catalogo,
    usuario,
)

ENTRY_NOT_FOUND = {"code": "ENTRY_NOT_FOUND", "message": "Entrada não encontrada"}


def _duas_contas(make_user, db_session, superuser_b=False):
    """A cria uma entrada; B é outra conta. Devolve (cliente_a, cliente_b, entry_id)."""
    semear_catalogo(db_session)
    cli_a = make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com", superuser=superuser_b)

    res = criar(cli_a, food_ref=ARROZ, quantity=150, unit="g")
    assert res.status_code == 201, res.text
    return cli_a, cli_b, id_da_unica_entrada(res.json())


def test_usuario_nao_le_entrada_de_outro(make_user, db_session):
    """RS-01. Sem o `user_id` DENTRO da query, `GET /diary/{id}` é leitura direta de
    prontuário alheio por id sequencial — a forma mais barata de enumeração que existe."""
    _, cli_b, entry_id = _duas_contas(make_user, db_session)

    res = cli_b.get(f"/diary/{entry_id}")

    assert res.status_code == 404
    assert res.json()["detail"] == ENTRY_NOT_FOUND


def test_usuario_nao_edita_entrada_de_outro(make_user, db_session):
    """RS-01 na escrita. O 404 não basta: o teste confere no banco que o valor do dono
    continua o mesmo — um PATCH que responde 404 DEPOIS de ter gravado seria pior que um
    que responde 200."""
    _, cli_b, entry_id = _duas_contas(make_user, db_session)

    res = cli_b.patch(f"/diary/{entry_id}", json={"quantity": 9999})

    assert res.status_code == 404
    assert res.json()["detail"] == ENTRY_NOT_FOUND
    db_session.expire_all()
    entrada = db_session.query(DiaryEntry).filter(DiaryEntry.id == entry_id).first()
    assert entrada.quantity == 150
    assert entrada.calories_total == 192.0


def test_usuario_nao_apaga_entrada_de_outro(make_user, db_session):
    """RS-01 na exclusão. A linha do outro usuário CONTINUA existindo no banco — um
    DELETE que apaga e depois devolve 404 é indistinguível deste teste pela resposta."""
    _, cli_b, entry_id = _duas_contas(make_user, db_session)

    res = cli_b.delete(f"/diary/{entry_id}")

    assert res.status_code == 404
    assert res.json()["detail"] == ENTRY_NOT_FOUND
    db_session.expire_all()
    assert db_session.query(DiaryEntry).filter(DiaryEntry.id == entry_id).count() == 1


def test_resposta_de_recurso_alheio_e_identica_a_de_id_inexistente(make_user, db_session):
    """RS-03: os dois corpos são comparados entre si, não contra uma constante.

    É essa igualdade que fecha o oráculo. Um 403 para o alheio e um 404 para o inexistente
    responderiam a pergunta "este id existe?" — e com id sequencial isso é um censo de
    quantas refeições cada conta registra, ao longo do tempo, sem ler conteúdo nenhum.
    """
    _, cli_b, entry_id = _duas_contas(make_user, db_session)

    alheia = cli_b.get(f"/diary/{entry_id}")
    inexistente = cli_b.get("/diary/999999")

    assert alheia.status_code == inexistente.status_code == 404
    assert alheia.json() == inexistente.json()


def test_superusuario_tambem_recebe_404(make_user, db_session):
    """RS-04. Receita é conteúdo publicável e moderável; diário é prontuário.

    Um `or current_user.is_superuser` aqui — o mesmo que outros routers deste projeto têm
    e que é natural copiar — transforma qualquer conta de admin comprometida numa violação
    de dado de saúde de TODA a base.
    """
    _, cli_admin, entry_id = _duas_contas(make_user, db_session, superuser_b=True)

    assert cli_admin.get(f"/diary/{entry_id}").status_code == 404
    assert cli_admin.patch(f"/diary/{entry_id}", json={"quantity": 10}).status_code == 404
    assert cli_admin.delete(f"/diary/{entry_id}").status_code == 404


def test_dia_composto_so_enxerga_as_proprias_entradas(make_user, db_session):
    """RS-05: o filtro de `user_id` está na MESMA cláusula do filtro de data.

    Escopar a data na query e o usuário depois, em Python, produziria exatamente este
    cenário — o dia de B somando as calorias de A — e nenhum teste de caminho feliz
    perceberia, porque no caminho feliz só existe um usuário.
    """
    cli_a, cli_b, _ = _duas_contas(make_user, db_session)
    assert criar(cli_a, quantity=100, slot="jantar").status_code == 201

    dia_b = cli_b.get(f"/diary?date={hoje().isoformat()}").json()

    assert dia_b["entries_count"] == 0
    assert dia_b["totals"]["calories"] == 0.0
    assert all(slot["entries"] == [] for slot in dia_b["slots"])

    # E o dono continua vendo o dele, para o teste não passar por "ninguém vê nada".
    dia_a = cli_a.get(f"/diary?date={hoje().isoformat()}").json()
    assert dia_a["entries_count"] == 2
    assert dia_a["totals"]["calories"] == 320.0


def test_faixa_de_dias_nao_agrega_entrada_alheia(make_user, db_session):
    """RS-05 no `/summary`. A rota agrega com GROUP BY — uma agregação sem escopo é o
    lugar clássico onde o `user_id` some, porque o resultado continua "parecendo certo"."""
    _, cli_b, _ = _duas_contas(make_user, db_session)
    dia = hoje().isoformat()

    res = cli_b.get(f"/diary/summary?start={dia}&end={dia}")

    assert res.status_code == 200
    assert res.json()["days"] == [
        {"date": dia, "calories": 0.0, "planned_calories": 0.0, "entries_count": 0}
    ]


def test_food_ref_de_cache_privado_de_outro_usuario_nao_resolve(make_user, db_session):
    """RS-17 aplicado ao `POST /diary`: o escopo está no WHERE da própria resolução.

    Sem ele, `cache:<id>` vira leitura de um alimento que outra pessoa digitou — e nome de
    alimento identifica suplemento oncológico, fórmula infantil, produto ritual. O
    endpoint estaria "funcionando exatamente como escrito" e vazando dado de saúde.
    """
    semear_catalogo(db_session)
    make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com")
    a = usuario(db_session, "a@example.com")

    privada = FoodCache(
        name="shake hipercalorico",
        name_normalized="shake hipercalorico",
        calories_per_unit=4.2,
        unit_type="g",
        source="llm",
        created_by_user_id=a.id,
    )
    db_session.add(privada)
    db_session.commit()

    res = criar(cli_b, food_ref=f"cache:{privada.id}", quantity=100, unit="g")

    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "FOOD_NOT_RESOLVED"
    # RS-27: a mensagem não repete nem o alimento nem o motivo real da recusa.
    assert res.json()["detail"]["message"] == "Alimento não encontrado."


def test_linha_de_cache_compartilhada_resolve_para_qualquer_usuario(make_user, db_session):
    """Contraprova do teste acima: a partição isola `llm`/`openfoodfacts`, e SÓ elas.

    Sem esta contraprova, escopar o cache inteiro por dono passaria nos testes de
    isolamento e jogaria fora a deduplicação das linhas confiáveis — que é metade do
    motivo de a tabela existir.
    """
    semear_catalogo(db_session)
    cli_b = make_user(email="b@example.com")

    compartilhada = FoodCache(
        name="ovo",
        name_normalized="ovo",
        calories_per_unit=1.43,
        unit_type="g",
        source="taco",
        created_by_user_id=None,
    )
    db_session.add(compartilhada)
    db_session.commit()

    res = criar(cli_b, food_ref=f"cache:{compartilhada.id}", quantity=100, unit="g")

    assert res.status_code == 201, res.text
    assert res.json()["totals"]["calories"] == 143.0


def test_vinculo_nao_aceita_cardapio_de_outro_usuario(make_user, db_session):
    """§ 6.9: cardápio alheio devolve 404 MEAL_PLAN_NOT_FOUND, nunca 403.

    Sem a validação de posse, o vínculo projetaria o cardápio de outra pessoa na tela do
    dia — o planejado de um estranho apresentado como o seu.
    """
    make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com")
    a = usuario(db_session, "a@example.com")
    plano_de_a = cardapio(db_session, a.id)

    res = cli_b.post(
        "/diary/plan-bindings",
        json={"meal_plan_id": plano_de_a.id, "start_date": hoje().isoformat()},
    )

    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "MEAL_PLAN_NOT_FOUND"
    assert db_session.query(DiaryPlanBinding).count() == 0


def test_vinculo_alheio_nao_pode_ser_apagado(make_user, db_session):
    """§ 6.9. Apagar o vínculo de outra pessoa esvaziaria a metade planejada da barra dela
    sem deixar rastro — e o 404 tem que vir SEM apagar nada."""
    semear_catalogo(db_session)
    cli_a = make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com")
    a = usuario(db_session, "a@example.com")
    plano = cardapio(db_session, a.id)

    criado = cli_a.post(
        "/diary/plan-bindings",
        json={"meal_plan_id": plano.id, "start_date": hoje().isoformat()},
    )
    assert criado.status_code == 201, criado.text
    binding_id = criado.json()["id"]

    res = cli_b.delete(f"/diary/plan-bindings/{binding_id}")

    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "BINDING_NOT_FOUND"
    db_session.expire_all()
    assert (
        db_session.query(DiaryPlanBinding).filter(DiaryPlanBinding.id == binding_id).count()
        == 1
    )


def test_planejado_de_outro_usuario_nao_aparece_no_dia(make_user, db_session):
    """A resolução do binding é por `user_id`: o cardápio de A não pode pintar a barra
    hachurada de B, mesmo que a data caia dentro da vigência do vínculo de A."""
    semear_catalogo(db_session)
    cli_a = make_user(email="a@example.com")
    cli_b = make_user(email="b@example.com")
    a = usuario(db_session, "a@example.com")
    plano = cardapio(db_session, a.id, dias=[[("Almoço", 600.0)]])
    ontem = hoje() - timedelta(days=1)
    assert (
        cli_a.post(
            "/diary/plan-bindings",
            json={"meal_plan_id": plano.id, "start_date": ontem.isoformat()},
        ).status_code
        == 201
    )

    dia_b = cli_b.get(f"/diary?date={hoje().isoformat()}").json()
    dia_a = cli_a.get(f"/diary?date={hoje().isoformat()}").json()

    assert dia_b["meal_plan"] is None
    assert dia_b["planned_totals"]["calories"] == 0.0
    assert dia_a["meal_plan"]["meal_plan_id"] == plano.id
    assert dia_a["planned_totals"]["calories"] == 600.0


def test_todas_as_rotas_do_diario_exigem_autenticacao(client, db_session):
    """`user_id` sai exclusivamente de `current_user` (RS-02). Uma rota que escape do
    `Depends(get_current_user)` não tem de onde tirar escopo — ela vira leitura global."""
    dia = hoje().isoformat()
    chamadas = [
        ("get", f"/diary?date={dia}", None),
        ("get", f"/diary/summary?start={dia}&end={dia}", None),
        ("get", "/diary/1", None),
        ("post", "/diary", {"entry_date": dia, "meal_slot": "almoco",
                            "food_ref": ARROZ, "quantity": 1, "unit": "g"}),
        ("patch", "/diary/1", {"quantity": 2}),
        ("delete", "/diary/1", None),
        ("get", "/diary/foods/search?q=arroz", None),
        ("post", "/diary/foods/resolve", {"name": "arroz", "unit": "g"}),
        ("post", "/diary/plan-bindings", {"meal_plan_id": 1, "start_date": dia}),
        ("delete", "/diary/plan-bindings/1", None),
    ]

    for metodo, url, corpo in chamadas:
        res = getattr(client, metodo)(url, json=corpo) if corpo else getattr(client, metodo)(url)
        assert res.status_code == 401, f"{metodo.upper()} {url} devolveu {res.status_code}"
