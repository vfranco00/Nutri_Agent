"""O `DiaryDay`: forma da resposta e aritmética do dia (§ 6.3, 6.4, 6.6, 6.7, 6.8, 9.3).

Duas garantias moram aqui, e as duas existem para que o frontend não precise de nenhuma
regra própria:

1. **Forma fixa.** `slots` tem SEMPRE 6 itens, SEMPRE na ordem canônica, mesmo vazios. O
   cliente não cria slot, não ordena e não preenche buraco. Devolver só os slots com
   entrada é a "otimização" óbvia e quebraria a tela inteira, que desenha 6 faixas.
2. **Um dono da aritmética.** Toda mutação devolve o dia recalculado. Se o backend
   devolvesse só a entrada criada, o cliente somaria por conta própria e as duas somas
   divergiriam por arredondamento (§ 9.3) — a barra discordando das linhas, sem erro em
   lugar nenhum.
"""

from datetime import timedelta

import pytest

from tests.diary_helpers import (
    ARROZ,
    GRANOLA,
    OVO,
    alimento_customizado,
    cache_privado,
    cardapio,
    criar,
    entradas,
    hoje,
    id_da_unica_entrada,
    id_mais_recente,
    perfil,
    semear_catalogo,
    usuario,
)

ORDEM = [
    "cafe_da_manha",
    "lanche_manha",
    "almoco",
    "lanche_tarde",
    "jantar",
    "ceia",
]


@pytest.fixture
def cli(make_user, db_session):
    semear_catalogo(db_session)
    return make_user(email="dono@example.com")


def dia_de(cli, data=None):
    res = cli.get(f"/diary?date={(data or hoje()).isoformat()}")
    assert res.status_code == 200, res.text
    return res.json()


# ======================================================================================
# Forma da resposta
# ======================================================================================


def test_dia_sem_nada_devolve_200_com_os_seis_slots_vazios(cli):
    """Nunca 404: dia sem entrada e sem plano é um dia legítimo, é o estado inicial de
    todo usuário e é o que a tela abre. Um 404 aqui viraria uma tela de erro no primeiro
    acesso de todo mundo."""
    dia = dia_de(cli)

    assert [slot["slot"] for slot in dia["slots"]] == ORDEM
    assert dia["totals"] == {"calories": 0.0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0}
    assert dia["entries_count"] == 0
    assert dia["has_estimate"] is False
    assert dia["macros_incomplete"] is False
    assert dia["meal_plan"] is None
    assert dia["planned_totals"]["calories"] == 0.0
    assert dia["planned_unmatched_calories"] == 0.0
    for slot in dia["slots"]:
        assert slot["entries"] == []
        assert slot["planned_meals"] == []
        # 0.0 e nunca null: a parte hachurada da barra é um número mesmo sem plano.
        assert slot["planned_calories"] == 0.0
        assert slot["logged_calories"] == 0.0


def test_ordem_e_rotulos_dos_slots(cli):
    """Os rótulos vêm do servidor junto com as chaves. Duplicá-los no cliente criaria dois
    lugares que precisam concordar sobre acento e maiúscula."""
    dia = dia_de(cli)

    assert [slot["label"] for slot in dia["slots"]] == [
        "Café da Manhã",
        "Lanche da Manhã",
        "Almoço",
        "Lanche da Tarde",
        "Jantar",
        "Ceia",
    ]


def test_slots_continuam_seis_mesmo_com_o_dia_cheio(cli):
    """Registrar em 3 slots não pode fazer os outros 3 sumirem da resposta."""
    for slot in ("cafe_da_manha", "almoco", "ceia"):
        assert criar(cli, slot=slot, quantity=50).status_code == 201

    dia = dia_de(cli)

    assert len(dia["slots"]) == 6
    assert [s["slot"] for s in dia["slots"]] == ORDEM


def test_entrada_cai_no_slot_pedido_e_soma_so_nele(cli):
    """`logged_calories` por slot é a parte sólida da barra segmentada. Somar tudo no
    primeiro slot daria o mesmo `totals` e uma barra completamente errada."""
    assert criar(cli, slot="cafe_da_manha", quantity=100).status_code == 201  # 128.0
    assert criar(cli, slot="jantar", quantity=50).status_code == 201  # 64.0

    dia = dia_de(cli)
    por_slot = {s["slot"]: s["logged_calories"] for s in dia["slots"]}

    assert por_slot == {
        "cafe_da_manha": 128.0,
        "lanche_manha": 0.0,
        "almoco": 0.0,
        "lanche_tarde": 0.0,
        "jantar": 64.0,
        "ceia": 0.0,
    }


# ======================================================================================
# Toda mutação devolve o dia recalculado (D-6)
# ======================================================================================


def test_post_devolve_201_com_o_dia_completo(cli):
    """O frontend substitui o estado do dia pela resposta: não soma, não refaz `GET`."""
    res = criar(cli, quantity=100)

    assert res.status_code == 201
    dia = res.json()
    assert dia["date"] == hoje().isoformat()
    assert dia["entries_count"] == 1
    assert dia["totals"]["calories"] == 128.0
    assert len(dia["slots"]) == 6


def test_patch_devolve_o_dia_recalculado(cli):
    entry_id = id_da_unica_entrada(criar(cli, quantity=100).json())

    res = cli.patch(f"/diary/{entry_id}", json={"quantity": 200})

    assert res.status_code == 200
    assert res.json()["totals"]["calories"] == 256.0
    assert res.json()["entries_count"] == 1


def test_patch_que_muda_a_data_devolve_o_dia_da_data_nova(cli):
    """§ 6.6. A interface navega para a data nova usando esta resposta — devolver o dia
    ANTIGO faria a entrada sumir da tela sem explicação, parecendo perda de dado."""
    ontem = hoje() - timedelta(days=1)
    entry_id = id_da_unica_entrada(criar(cli, quantity=100).json())

    res = cli.patch(f"/diary/{entry_id}", json={"entry_date": ontem.isoformat()})

    assert res.status_code == 200
    dia = res.json()
    assert dia["date"] == ontem.isoformat()
    assert dia["entries_count"] == 1
    assert dia_de(cli, hoje())["entries_count"] == 0


def test_delete_devolve_200_com_o_dia_e_nao_204(cli):
    """204 forçaria um `GET` logo em seguida só para redesenhar a barra — a chamada extra
    que o desenho da tela existe para evitar."""
    assert criar(cli, quantity=100).status_code == 201
    entry_id = id_mais_recente(criar(cli, quantity=50).json())

    res = cli.delete(f"/diary/{entry_id}")

    assert res.status_code == 200
    assert res.json()["totals"]["calories"] == 128.0
    assert res.json()["entries_count"] == 1


def test_delete_da_ultima_entrada_zera_o_dia_sem_404(cli):
    entry_id = id_da_unica_entrada(criar(cli).json())

    res = cli.delete(f"/diary/{entry_id}")

    assert res.status_code == 200
    assert res.json()["totals"]["calories"] == 0.0
    assert len(res.json()["slots"]) == 6


# ======================================================================================
# Aritmética do dia (§ 9.3)
# ======================================================================================


def test_total_do_dia_bate_com_a_soma_das_entradas_e_dos_slots(cli):
    """As três leituras que a tela mostra ao mesmo tempo — o total, as faixas da barra e as
    linhas — têm que fechar entre si. É a divergência entre elas que o usuário enxerga."""
    assert criar(cli, slot="cafe_da_manha", quantity=100).status_code == 201
    assert criar(cli, slot="almoco", quantity=150).status_code == 201
    assert criar(cli, slot="jantar", food_ref=OVO, quantity=2, unit="un").status_code == 201

    dia = dia_de(cli)

    soma_das_linhas = sum(e["calories_total"] for e in entradas(dia))
    soma_dos_slots = sum(s["logged_calories"] for s in dia["slots"])
    assert dia["totals"]["calories"] == round(soma_das_linhas, 1) == round(soma_dos_slots, 1)
    assert dia["totals"]["calories"] == 460.0  # 128 + 192 + 140


def test_o_total_soma_valores_ja_arredondados_pelo_backend(cli, db_session):
    """§ 9.3, regra 3, ponta a ponta.

    Três entradas de 0,333 kcal aparecem como 0,3 cada. O total é 0,9 — e não 1,0, que é o
    que sairia de somar os valores crus. O usuário que conferir na calculadora encontra o
    mesmo número que está na tela, que é a propriedade que o contrato escolheu preservar.
    """
    alimento_customizado(db_session, slug="terco-g", name="Terco", kcal=0.333)
    for _ in range(3):
        assert criar(cli, food_ref="catalog:terco-g", quantity=1, unit="g").status_code == 201

    dia = dia_de(cli)

    assert [e["calories_total"] for e in entradas(dia)] == [0.3, 0.3, 0.3]
    assert dia["totals"]["calories"] == 0.9


def test_macro_desconhecido_nao_entra_como_zero_no_total(cli):
    """Granola não tem macro publicado no dataset. Com `None`→0, o dia mostraria menos
    proteína do que o usuário comeu, e ele ajustaria a dieta para cobrir um déficit
    inventado pelo nosso arredondamento de "não sei" para "zero"."""
    assert criar(cli, food_ref=ARROZ, quantity=100).status_code == 201  # proteína 2.5
    assert criar(cli, food_ref=GRANOLA, quantity=50).status_code == 201  # proteína None

    dia = dia_de(cli)

    assert dia["totals"]["protein_g"] == 2.5
    # E a interface é avisada de que o número não está fechado.
    assert dia["macros_incomplete"] is True
    granola = [e for e in entradas(dia) if e["food_name"] == "Granola"][0]
    assert granola["protein_g_total"] is None


def test_dia_inteiro_sem_macro_devolve_none_e_nao_zero(cli):
    """"Não sei" e "zero" precisam continuar distinguíveis no agregado, não só na linha."""
    assert criar(cli, food_ref=GRANOLA, quantity=50).status_code == 201

    dia = dia_de(cli)

    assert dia["totals"]["protein_g"] is None
    assert dia["totals"]["calories"] == 235.5


def test_macros_incomplete_e_falso_quando_tudo_e_conhecido(cli):
    """Contraprova: a flag ligada sempre faria a interface esconder os macros para todo
    mundo, que é a falha oposta e igualmente silenciosa."""
    assert criar(cli, food_ref=ARROZ, quantity=100).status_code == 201

    dia = dia_de(cli)

    assert dia["macros_incomplete"] is False
    assert dia["totals"] == {
        "calories": 128.0,
        "protein_g": 2.5,
        "carbs_g": 28.1,
        "fat_g": 0.2,
    }


# ======================================================================================
# Procedência e meta
# ======================================================================================


def test_has_estimate_marca_o_dia_com_alimento_estimado(cli, db_session):
    """`is_estimate` é calculado no servidor a partir da procedência, nunca inferido no
    cliente. É o que faz a interface marcar "estimativa" — sem isso, um número que veio de
    um LLM é apresentado com a mesma autoridade de um número da TACO."""
    dono = usuario(db_session, "dono@example.com")
    linha = cache_privado(db_session, dono.id, kcal=4.0)

    res = criar(cli, food_ref=f"cache:{linha.id}", quantity=100, unit="g")

    assert res.status_code == 201, res.text
    dia = res.json()
    assert dia["has_estimate"] is True
    entrada = entradas(dia)[0]
    assert entrada["is_estimate"] is True
    assert entrada["source"] == "llm"


def test_alimento_do_catalogo_nao_e_estimativa(cli):
    dia = criar(cli, food_ref=ARROZ).json()

    assert dia["has_estimate"] is False
    assert entradas(dia)[0]["is_estimate"] is False
    assert entradas(dia)[0]["source"] == "taco"


def test_meta_calorica_vem_do_perfil(cli, db_session):
    """§ 6.4: `calories_target` é `profiles.daily_calories`, NÃO
    `MealPlanDay.calories_target`. Os dois existem, têm nome parecido e significam coisas
    diferentes — a meta do usuário e a meta que o cardápio se propôs a cumprir."""
    dono = usuario(db_session, "dono@example.com")
    perfil(db_session, dono.id, daily_calories=2100.0)

    assert dia_de(cli)["calories_target"] == 2100.0


def test_sem_perfil_a_meta_e_null(cli):
    """`null` e não 0: uma meta de 0 kcal faria a barra do dashboard estourar 100% no
    primeiro registro."""
    assert dia_de(cli)["calories_target"] is None


# ======================================================================================
# Faixa de dias (§ 6.8)
# ======================================================================================


def test_summary_traz_todas_as_datas_do_intervalo(cli, db_session):
    """Inclusive as sem registro, em ordem crescente: o frontend não preenche buraco de
    calendário. Devolver só os dias com dado faria a fita da semana desalinhar do
    calendário conforme o usuário deixa de registrar."""
    dono = usuario(db_session, "dono@example.com")
    perfil(db_session, dono.id, daily_calories=1800.0)
    inicio = hoje() - timedelta(days=2)
    assert criar(cli, data=inicio, quantity=100).status_code == 201
    assert criar(cli, data=hoje(), quantity=50).status_code == 201

    res = cli.get(f"/diary/summary?start={inicio}&end={hoje()}")

    assert res.status_code == 200
    corpo = res.json()
    assert [d["date"] for d in corpo["days"]] == [
        inicio.isoformat(),
        (inicio + timedelta(days=1)).isoformat(),
        hoje().isoformat(),
    ]
    assert [d["calories"] for d in corpo["days"]] == [128.0, 0.0, 64.0]
    assert [d["entries_count"] for d in corpo["days"]] == [1, 0, 1]
    # Fora do array porque é do usuário, não do dia.
    assert corpo["calories_target"] == 1800.0


def test_summary_e_o_dia_composto_concordam_no_total(cli):
    """Duas rotas somam a mesma coisa por caminhos diferentes (uma agregação em SQL e uma
    soma em Python). Se divergirem, a fita da semana contradiz a tela do dia."""
    assert criar(cli, quantity=100).status_code == 201
    assert criar(cli, quantity=150, slot="jantar").status_code == 201
    dia = hoje().isoformat()

    resumo = cli.get(f"/diary/summary?start={dia}&end={dia}").json()["days"][0]

    assert resumo["calories"] == dia_de(cli)["totals"]["calories"] == 320.0
    assert resumo["entries_count"] == 2


def test_summary_de_um_dia_planejado_traz_o_planejado(cli, db_session):
    """A fita da semana desenha planejado e registrado lado a lado, como a tela do dia."""
    dono = usuario(db_session, "dono@example.com")
    plano = cardapio(db_session, dono.id, dias=[[("Almoço", 600.0), ("Jantar", 500.0)]])
    assert cli.post(
        "/diary/plan-bindings",
        json={"meal_plan_id": plano.id, "start_date": hoje().isoformat()},
    ).status_code == 201
    dia = hoje().isoformat()

    resumo = cli.get(f"/diary/summary?start={dia}&end={dia}").json()["days"][0]

    assert resumo["planned_calories"] == 1100.0
