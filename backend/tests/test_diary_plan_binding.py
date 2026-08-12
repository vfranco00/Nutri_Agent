"""Vínculo cardápio↔calendário e projeção do planejado no dia (§ 4.5, § 6.4, § 6.9).

O cardápio é TEMPLATE (sem data) e o diário é calendário. O vínculo é o que faz "o que
estava planejado para 2026-08-11" ter resposta — e a resposta precisa ser única, porque a
metade hachurada da barra do dashboard sai dela.

Duas propriedades não têm como ser garantidas pelo banco e por isso vivem aqui:

- **Desempate.** Não há constraint de não sobreposição: `EXCLUDE` exige `btree_gist`, que
  não existe no SQLite onde a suíte roda. A regra "o vínculo mais recente que já começou
  ganha" é aplicação pura — se ela quebrar, dois vínculos válidos passam a produzir um
  planejado que depende da ordem em que o banco devolveu as linhas.
- **Mapeamento de slot.** `MealPlanMeal.slot_name` é texto livre gerado por IA. Qualquer
  valor fora da tabela cai em `planned_unmatched_calories` e NUNCA é chutado num slot:
  chutar colocaria o pré-treino de alguém dentro do café da manhã, com a caloria junto.
"""

from datetime import timedelta

import pytest

from app.models.diary import DiaryPlanBinding

from tests.diary_helpers import cardapio, hoje, semear_catalogo, usuario


@pytest.fixture
def contexto(make_user, db_session):
    semear_catalogo(db_session)
    cli = make_user(email="dono@example.com")
    return cli, usuario(db_session, "dono@example.com")


def _vincular(cli, plano_id, start, end=None):
    res = cli.post(
        "/diary/plan-bindings",
        json={
            "meal_plan_id": plano_id,
            "start_date": start.isoformat(),
            "end_date": end.isoformat() if end else None,
        },
    )
    return res


def _dia(cli, data=None):
    return cli.get(f"/diary?date={(data or hoje()).isoformat()}").json()


# ======================================================================================
# Criação e validação do vínculo
# ======================================================================================


def test_vinculo_criado_projeta_o_cardapio_no_dia(contexto, db_session):
    cli, dono = contexto
    plano = cardapio(db_session, dono.id, dias=[[("Almoço", 600.0)]])

    res = _vincular(cli, plano.id, hoje())

    assert res.status_code == 201, res.text
    assert res.json()["end_date"] is None
    dia = _dia(cli)
    assert dia["meal_plan"]["meal_plan_id"] == plano.id
    assert dia["meal_plan"]["day_index"] == 0
    assert dia["meal_plan"]["title"] == "Semana de corte"


def test_data_final_anterior_a_inicial_e_recusada(contexto, db_session):
    """Um intervalo invertido nunca casa a condição de vigência: o vínculo existiria no
    banco sem nunca valer para dia nenhum — dado morto que o usuário criou achando que
    tinha ativado o cardápio."""
    cli, dono = contexto
    plano = cardapio(db_session, dono.id)

    res = _vincular(cli, plano.id, hoje(), hoje() - timedelta(days=1))

    assert res.status_code == 422


@pytest.mark.parametrize("corpo", [
    {"meal_plan_id": 0, "start_date": "2026-08-11"},
    {"meal_plan_id": -3, "start_date": "2026-08-11"},
    {"meal_plan_id": 1},
    {"start_date": "2026-08-11"},
    {"meal_plan_id": 1, "start_date": "ontem"},
    {"meal_plan_id": 1, "start_date": "2026-08-11", "user_id": 2},
])
def test_corpo_invalido_do_vinculo(contexto, corpo):
    """Inclui o campo extra: `user_id` no corpo é 422 por `extra="forbid"` (RS-02), e não
    um campo ignorado que um refactor futuro pode passar a honrar."""
    cli, _ = contexto

    assert cli.post("/diary/plan-bindings", json=corpo).status_code == 422


# ======================================================================================
# Desempate e vigência (§ 4.5, § 6.9)
# ======================================================================================


def test_o_vinculo_mais_recente_que_ja_comecou_ganha(contexto, db_session):
    """O comportamento observável que o § 6.9 exige em teste, com as datas de lá.

    Criar um vínculo NÃO apaga os anteriores — o histórico de vínculos é o que permite
    voltar no tempo e ver o planejado. Sem desempate determinístico, "qual cardápio está
    valendo" passaria a depender da ordem de retorno do banco, e a barra hachurada de
    ontem mudaria de valor entre dois refreshes.
    """
    cli, dono = contexto
    plano_a = cardapio(db_session, dono.id, title="Plano A", dias=[[("Almoço", 100.0)]])
    plano_b = cardapio(db_session, dono.id, title="Plano B", dias=[[("Almoço", 900.0)]])
    assert _vincular(cli, plano_a.id, hoje() - timedelta(days=10)).status_code == 201
    assert _vincular(cli, plano_b.id, hoje() - timedelta(days=1)).status_code == 201

    dia = _dia(cli)

    assert dia["meal_plan"]["meal_plan_id"] == plano_b.id
    assert dia["planned_totals"]["calories"] == 900.0
    # Os dois vínculos continuam no banco: o mais antigo não foi apagado.
    assert db_session.query(DiaryPlanBinding).count() == 2


def test_data_anterior_ao_inicio_do_vinculo_nao_tem_plano(contexto, db_session):
    """`meal_plan` é `null` antes da vigência. Projetar o cardápio para trás inventaria um
    planejado para dias em que o usuário não tinha plano nenhum."""
    cli, dono = contexto
    plano = cardapio(db_session, dono.id)
    assert _vincular(cli, plano.id, hoje()).status_code == 201

    dia = _dia(cli, hoje() - timedelta(days=1))

    assert dia["meal_plan"] is None
    assert dia["planned_totals"]["calories"] == 0.0


def test_data_posterior_ao_fim_do_vinculo_nao_tem_plano(contexto, db_session):
    cli, dono = contexto
    plano = cardapio(db_session, dono.id)
    assert _vincular(
        cli, plano.id, hoje() - timedelta(days=10), hoje() - timedelta(days=5)
    ).status_code == 201

    assert _dia(cli)["meal_plan"] is None


def test_o_ultimo_dia_de_vigencia_ainda_conta(contexto, db_session):
    """`end_date` é inclusivo. Um `<` no lugar de `<=` esvaziaria silenciosamente o
    planejado do último dia de cada ciclo."""
    cli, dono = contexto
    plano = cardapio(db_session, dono.id, dias=[[("Almoço", 600.0)]])
    assert _vincular(
        cli, plano.id, hoje() - timedelta(days=3), hoje()
    ).status_code == 201

    assert _dia(cli)["meal_plan"] is not None


def test_o_plano_cicla_pelos_dias(contexto, db_session):
    """`day_index = (data - start_date) % len(dias)` — é o que torna um cardápio de 3 dias
    utilizável por um mês sem clonar nada. Um plano de 7 dias vinculado a uma segunda-feira
    tem que voltar ao dia 0 na segunda seguinte."""
    cli, dono = contexto
    plano = cardapio(
        db_session,
        dono.id,
        dias=[[("Almoço", 100.0)], [("Almoço", 200.0)], [("Almoço", 300.0)]],
    )
    inicio = hoje() - timedelta(days=5)
    assert _vincular(cli, plano.id, inicio).status_code == 201

    dia = _dia(cli)

    assert dia["meal_plan"]["day_index"] == 2  # 5 % 3
    assert dia["planned_totals"]["calories"] == 300.0


def test_cardapio_sem_dias_nao_vira_plano_do_dia(contexto, db_session):
    """Divisão por `len(dias)` num plano vazio é `ZeroDivisionError` — 500 na rota central
    da feature, disparado por um cardápio que o usuário criou e nunca preencheu."""
    cli, dono = contexto
    plano = cardapio(db_session, dono.id, dias=[])
    assert _vincular(cli, plano.id, hoje()).status_code == 201

    dia = _dia(cli)

    assert dia["meal_plan"] is None
    assert dia["planned_totals"]["calories"] == 0.0


def test_apagar_o_vinculo_tira_o_planejado_do_dia(contexto, db_session):
    cli, dono = contexto
    plano = cardapio(db_session, dono.id, dias=[[("Almoço", 600.0)]])
    binding_id = _vincular(cli, plano.id, hoje()).json()["id"]

    res = cli.delete(f"/diary/plan-bindings/{binding_id}")

    assert res.status_code == 200
    assert res.json() == {"ok": True}
    assert _dia(cli)["meal_plan"] is None


def test_vinculo_inexistente_devolve_404(contexto):
    cli, _ = contexto

    res = cli.delete("/diary/plan-bindings/999999")

    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "BINDING_NOT_FOUND"


# ======================================================================================
# Mapeamento de slot do cardápio (§ 6.4)
# ======================================================================================


@pytest.mark.parametrize(
    "slot_name,slot_esperado",
    [
        ("Café da Manhã", "cafe_da_manha"),
        ("cafe", "cafe_da_manha"),
        ("Desjejum", "cafe_da_manha"),
        ("Lanche da Manhã", "lanche_manha"),
        ("Almoço", "almoco"),
        ("Lanche da Tarde", "lanche_tarde"),
        ("Lanche", "lanche_tarde"),
        ("Jantar", "jantar"),
        ("Janta", "jantar"),
        ("Ceia", "ceia"),
    ],
)
def test_slot_name_livre_cai_no_slot_canonico(contexto, db_session, slot_name, slot_esperado):
    """A tabela é aplicada sobre o nome normalizado: acento e caixa do texto gerado pela
    IA não podem decidir em qual faixa da barra a refeição aparece.

    `lanche` sozinho vai para a TARDE porque a estrutura de 4 refeições que o gerador
    produz hoje é "Café da Manhã, Almoço, Lanche da Tarde, Jantar" — o lanche genérico é o
    da tarde em 100% dos cardápios gerados.
    """
    cli, dono = contexto
    plano = cardapio(db_session, dono.id, dias=[[(slot_name, 400.0)]])
    assert _vincular(cli, plano.id, hoje()).status_code == 201

    dia = _dia(cli)
    por_slot = {s["slot"]: s["planned_calories"] for s in dia["slots"]}

    assert por_slot[slot_esperado] == 400.0
    assert sum(por_slot.values()) == 400.0
    assert dia["planned_unmatched_calories"] == 0.0


@pytest.mark.parametrize("slot_name", ["Pré-treino", "Ceia extra", "Refeição 5", ""])
def test_slot_desconhecido_vai_para_o_balde_de_nao_mapeadas(contexto, db_session, slot_name):
    """Não reconhecido NUNCA é chutado num slot — mas também não desaparece: continua
    dentro de `planned_totals.calories`, e `planned_unmatched_calories` existe para a
    interface poder explicar a diferença em nota de rodapé.

    Sumir com a caloria seria pior que chutar o slot: o total planejado passaria a
    contradizer o cardápio que o próprio app gerou.
    """
    cli, dono = contexto
    plano = cardapio(db_session, dono.id, dias=[[("Almoço", 600.0), (slot_name, 250.0)]])
    assert _vincular(cli, plano.id, hoje()).status_code == 201

    dia = _dia(cli)

    assert dia["planned_unmatched_calories"] == 250.0
    assert dia["planned_totals"]["calories"] == 850.0
    assert sum(s["planned_calories"] for s in dia["slots"]) == 600.0


def test_macros_do_planejado_sao_sempre_nulos_na_v1(contexto, db_session):
    """`MealPlanDay` guarda macro como texto livre ("120g"). Parsear string vinda de IA
    para número é inventar dado — o campo existe para não quebrar o tipo quando houver
    uma fonte numérica de verdade."""
    cli, dono = contexto
    plano = cardapio(db_session, dono.id, dias=[[("Almoço", 600.0)]])
    assert _vincular(cli, plano.id, hoje()).status_code == 201

    planejado = _dia(cli)["planned_totals"]

    assert planejado["calories"] == 600.0
    assert planejado["protein_g"] is None
    assert planejado["carbs_g"] is None
    assert planejado["fat_g"] is None


def test_refeicao_planejada_chega_com_titulo_e_calorias(contexto, db_session):
    """A tela lista o planejado ao lado do registrado dentro do mesmo slot."""
    cli, dono = contexto
    plano = cardapio(db_session, dono.id, dias=[[("Almoço", 600.0)]])
    assert _vincular(cli, plano.id, hoje()).status_code == 201

    almoco = [s for s in _dia(cli)["slots"] if s["slot"] == "almoco"][0]

    assert len(almoco["planned_meals"]) == 1
    assert almoco["planned_meals"][0]["title"] == "Almoço do dia 1"
    assert almoco["planned_meals"][0]["calories"] == 600.0
