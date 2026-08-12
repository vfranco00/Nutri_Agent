"""Caminhos de erro e de borda do ciclo de vida de uma entrada (§ 6.3, 6.5, 6.6, 6.7).

A feature inteira tem UM caminho feliz e dezenas de caminhos de recusa, e é nos segundos
que ela erra: o caminho feliz é o que o desenvolvedor executa à mão antes do commit. Todo
teste aqui trava uma recusa — se a recusa virar aceitação, alguma linha impossível entra
no banco (0 g de comida, 9.000 xícaras, uma data no ano 3000) e passa a poluir total,
gráfico e histórico para sempre, porque `diary_entries` não tem expurgo por idade.

A ordem de execução do § 6.3 é contrato porque ela decide QUAL erro o cliente vê: validação
(422) antes de resolução (404) antes de compatibilidade de unidade (422 com código) antes
do teto (403) antes do cálculo. Trocar a ordem não quebra o caminho feliz e muda a mensagem
que o usuário lê em cada falha.
"""

from datetime import timedelta

import pytest

from app.models.diary import DiaryEntry
from app.models.food_catalog import FoodCatalog
from app.services import diary_math

from tests.diary_helpers import (
    ARROZ,
    OVO,
    criar,
    entrada_bruta,
    hoje,
    id_da_unica_entrada,
    semear_catalogo,
    usuario,
)


@pytest.fixture
def cli(make_user, db_session):
    """Uma conta com o catálogo real da TACO já semeado."""
    semear_catalogo(db_session)
    return make_user(email="dono@example.com")


# ======================================================================================
# Quantidade (RS-07 e RS-10)
# ======================================================================================


@pytest.mark.parametrize("quantidade", [0, -1, -0.5])
def test_quantidade_nao_positiva_e_recusada(cli, quantidade):
    """`gt=0` e não `ge=0`: 0 g de um alimento não é registro, é ruído que entra na
    contagem do dia, aparece como linha na tela e não soma nada — o pior tipo de dado,
    o que ocupa espaço sem informar."""
    res = criar(cli, quantity=quantidade)

    assert res.status_code == 422
    assert res.json()["detail"][0]["loc"] == ["body", "quantity"]


@pytest.mark.parametrize("quantidade", [10_000.1, 1e9])
def test_quantidade_acima_do_teto_e_recusada(cli, quantidade):
    """RS-07. Sem `le=`, `1e9` vira linha no banco e o gráfico do dia fica ilegível para
    sempre — não há expurgo por idade que o conserte."""
    assert criar(cli, quantity=quantidade).status_code == 422


@pytest.mark.parametrize("bruto", ["Infinity", "NaN", "1e400"])
def test_quantidade_infinita_nao_derruba_a_renderizacao_do_erro(cli, bruto):
    """Regressão do 500 que o handler global do RS-12 conserta.

    O parser de JSON do Python ACEITA os literais `Infinity`/`NaN`, o valor chega à
    validação e é corretamente rejeitado — mas o handler padrão do FastAPI devolve o valor
    recebido no campo `input`, e `json.dumps` não serializa `inf`. A validação acerta e a
    RESPOSTA estoura: 500 no lugar de 422.
    """
    res = cli.post(
        "/diary",
        content=(
            '{"entry_date": "%s", "meal_slot": "almoco", "food_ref": "%s", '
            '"quantity": %s, "unit": "g"}' % (hoje().isoformat(), ARROZ, bruto)
        ),
        headers={"Content-Type": "application/json"},
    )

    assert res.status_code == 422, res.text
    assert isinstance(res.json()["detail"], list)


def test_erro_de_validacao_nao_devolve_o_valor_enviado(cli):
    """RS-12: `input`, `ctx` e `url` são removidos do 422 de TODA a API.

    Num diário alimentar o `input` é o nome do alimento — dado de saúde — viajando no
    corpo de uma resposta de erro, que é exatamente o que proxy, APM e agregador de log
    capturam por padrão, sem controle de acesso e sem prazo de retenção.
    """
    res = criar(cli, quantity=-1)

    assert res.status_code == 422
    for erro in res.json()["detail"]:
        assert "input" not in erro
        assert "ctx" not in erro
        assert "url" not in erro


def test_quantidade_valida_com_kcal_implausivel_e_recusada(cli):
    """RS-10, segunda rede: 9.000 g é uma quantidade VÁLIDA (passa no `le=10_000`) e 8,84
    kcal/ml do azeite é um valor VÁLIDO. O produto dos dois é 79.560 kcal num item só.

    O teto existe porque nenhuma das duas validações isoladas vê o problema — ele só
    aparece na multiplicação, que é o passo (5) da ordem do § 6.3.
    """
    res = criar(cli, food_ref="catalog:azeite-de-oliva-ml", quantity=9000, unit="ml")

    assert res.status_code == 422
    detalhe = res.json()["detail"][0]
    assert detalhe["loc"] == ["body", "quantity"]
    # RS-27: mensagem genérica, sem repetir alimento nem quantidade.
    assert detalhe["msg"] == "Quantidade implausível para uma refeição."


# ======================================================================================
# Unidade e slot
# ======================================================================================


@pytest.mark.parametrize("unidade", ["kg", "G", "", "colher", "unidade", "libra"])
def test_unidade_fora_das_oito_e_recusada(cli, unidade):
    """As 8 unidades são um `Literal`. Uma unidade desconhecida sem fator de conversão
    seria multiplicada por... nada — ou por 1, se alguém "consertar" com um `.get(u, 1)`,
    que é como 1 kg vira 1 g silenciosamente."""
    assert criar(cli, unit=unidade).status_code == 422


def test_unidade_incompativel_com_o_alimento_devolve_codigo_proprio(cli):
    """§ 9.2: "3 xícaras de ovo (unidade)" não é erro de digitação a ser adivinhado.

    Não existe fator honesto entre contagem e volume sem saber o volume da unidade;
    chutar produziria um número errado com cara de certo. O código é próprio
    (UNIT_NOT_SUPPORTED_FOR_FOOD) porque a interface precisa reabrir o seletor de unidade,
    não repetir "valor inválido".
    """
    res = criar(cli, food_ref=OVO, quantity=3, unit="xicara")

    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "UNIT_NOT_SUPPORTED_FOR_FOOD"


def test_unidade_de_massa_e_aceita_em_alimento_de_volume(cli):
    """Contraprova: `colher_sopa` vale para as duas famílias (§ 9.1). Uma regra de
    compatibilidade estrita demais recusaria "1 colher de sopa de azeite", que é o jeito
    normal de registrar azeite."""
    res = criar(cli, food_ref="catalog:azeite-de-oliva-ml", quantity=1, unit="colher_sopa")

    assert res.status_code == 201, res.text
    assert res.json()["totals"]["calories"] == 132.6


@pytest.mark.parametrize("slot", ["brunch", "almoço", "ALMOCO", "", "lanche"])
def test_slot_fora_das_seis_chaves_e_recusado(cli, slot):
    """As 6 chaves são valor de API e de banco, não rótulo de tela — "almoço" com cedilha
    e "ALMOCO" são tão inválidos quanto "brunch". Um slot desconhecido no banco fica fora
    dos 6 slots da resposta: a entrada some da tela mas continua somando no total."""
    assert criar(cli, slot=slot).status_code == 422


# ======================================================================================
# Data (RS-09)
# ======================================================================================


@pytest.mark.parametrize("bruto", ["2026-13-45", "11/08/2026", "ontem", "", "2026-02-30"])
def test_data_malformada_e_recusada(cli, bruto):
    res = cli.post(
        "/diary",
        json={
            "entry_date": bruto,
            "meal_slot": "almoco",
            "food_ref": ARROZ,
            "quantity": 100,
            "unit": "g",
        },
    )

    assert res.status_code == 422


def test_data_alem_de_amanha_e_recusada(cli):
    """A folga é de EXATAMENTE um dia. Ela existe para o fuso (o servidor roda em UTC e
    um usuário em UTC+13 tem "hoje" um dia à frente por várias horas), não para planejar
    o diário — planejar é o que a feature de cardápio já faz."""
    res = criar(cli, data=hoje() + timedelta(days=2))

    assert res.status_code == 422
    assert res.json()["detail"][0]["loc"] == ["body", "entry_date"]


def test_amanha_e_aceito(cli):
    """Contraprova do fuso: sem esta folga, o café da manhã de quem está em UTC+13 seria
    recusado como "futuro" durante várias horas por dia."""
    assert criar(cli, data=hoje() + timedelta(days=1)).status_code == 201


def test_data_anterior_a_730_dias_e_recusada(cli):
    """Sem piso, `entry_date` é um espaço de escrita de ~4 dígitos de ano: cada data
    distinta é uma linha nova que passa limpa pelo teto de "entradas por dia"."""
    assert criar(cli, data=hoje() - timedelta(days=731)).status_code == 422


def test_limite_exato_do_passado_e_aceito(cli):
    """A borda é inclusiva: 730 dias entra, 731 não. Um `<` no lugar de `<=` moveria a
    fronteira em um dia e nenhum teste de "data muito antiga" perceberia."""
    assert criar(cli, data=hoje() - timedelta(days=730)).status_code == 201


# ======================================================================================
# food_ref (D-5)
# ======================================================================================


@pytest.mark.parametrize(
    "ref",
    [
        "arroz branco",  # sem namespace
        "catalog:Arroz-Branco",  # maiúscula fora do formato do slug
        "cache:abc",  # id não numérico
        "cache:-1",
        "catalog:",  # namespace vazio
        "receita:12",  # namespace inventado
        "catalog:a' OR 1=1--",
    ],
)
def test_food_ref_fora_do_formato_e_recusado_antes_de_qualquer_query(cli, ref):
    """O formato é validado no schema para que a resolução no router não precise confiar
    em nada do que veio no corpo — o `split(":")` de lá opera sobre string já conferida."""
    assert criar(cli, food_ref=ref).status_code == 422


def test_food_ref_bem_formado_mas_inexistente_devolve_404(cli):
    """`POST /diary` não chama LLM nem rede externa (D-5): alimento que não está resolvido
    é 404, e o cliente chama o resolve primeiro. Se esta rota "resolvesse" o que falta,
    ela viraria um caminho pago disfarçado de escrita barata, sem cota e sem rate limit."""
    res = criar(cli, food_ref="catalog:alimento-que-nao-existe")

    assert res.status_code == 404
    assert res.json()["detail"]["code"] == "FOOD_NOT_RESOLVED"


def test_campo_extra_no_corpo_e_recusado(cli):
    """RS-02/RS-10/Δ1. Sem `extra="forbid"`, `{"user_id": 42}` é aceito, ignorado, e
    continua sendo aceito e ignorado até o dia em que alguém trocar a construção do model
    por `DiaryEntry(**payload)` — e aí vira escrita na conta alheia sem que nenhum teste
    tenha mudado."""
    for extra in ({"user_id": 42}, {"calories_total": 5.0}, {"food_name": "bolo"},
                  {"source": "taco"}, {"is_estimate": False}):
        corpo = {
            "entry_date": hoje().isoformat(),
            "meal_slot": "almoco",
            "food_ref": ARROZ,
            "quantity": 100,
            "unit": "g",
            **extra,
        }
        res = cli.post("/diary", json=corpo)
        assert res.status_code == 422, f"{extra} passou: {res.text}"


def test_calorias_vem_do_servidor_e_nao_do_cliente(cli):
    """RS-10 pelo comportamento, não pela ausência do campo: mesmo que o `extra="forbid"`
    caia um dia, o total tem que continuar saindo do catálogo × quantidade."""
    res = criar(cli, food_ref=ARROZ, quantity=100, unit="g")

    assert res.status_code == 201
    assert res.json()["totals"]["calories"] == 128.0


# ======================================================================================
# entry_id inexistente
# ======================================================================================


@pytest.mark.parametrize("metodo,corpo", [("get", None), ("patch", {"quantity": 5}), ("delete", None)])
def test_entrada_inexistente_devolve_404_em_todas_as_rotas(cli, metodo, corpo):
    chamada = getattr(cli, metodo)
    res = chamada("/diary/424242", json=corpo) if corpo else chamada("/diary/424242")

    assert res.status_code == 404
    assert res.json()["detail"] == {
        "code": "ENTRY_NOT_FOUND",
        "message": "Entrada não encontrada",
    }


@pytest.mark.parametrize("bruto", ["abc", "1.5", "-1'"])
def test_entry_id_nao_inteiro_nao_chega_ao_banco(cli, bruto):
    """A conversão do path acontece antes da query: um id não inteiro é 422, nunca uma
    string interpolada em SQL nem um 500."""
    assert cli.get(f"/diary/{bruto}").status_code == 422


# ======================================================================================
# PATCH (§ 6.6)
# ======================================================================================


def _entrada_criada(cli, **kwargs):
    res = criar(cli, **kwargs)
    assert res.status_code == 201, res.text
    return id_da_unica_entrada(res.json())


def test_patch_sem_nenhum_campo_e_recusado(cli):
    """Corpo vazio não é edição: sem esta regra, um `PATCH {}` responderia 200 com o dia
    inteiro e ainda bumparia `updated_at` — uma escrita que o usuário não pediu."""
    entry_id = _entrada_criada(cli)

    assert cli.patch(f"/diary/{entry_id}", json={}).status_code == 422


def test_patch_nao_edita_food_ref(cli):
    """Trocar o alimento é apagar e criar. Aceitar `food_ref` aqui reintroduziria uma
    RESOLUÇÃO — e portanto uma possível chamada externa — na rota de edição, que é
    justamente o que o snapshot da linha existe para evitar."""
    entry_id = _entrada_criada(cli)

    res = cli.patch(f"/diary/{entry_id}", json={"food_ref": OVO})

    assert res.status_code == 422


def test_patch_revalida_a_unidade_contra_o_alimento_persistido(cli):
    """A unidade nova é conferida contra o `base_unit` gravado NA ENTRADA, não contra a
    fonte: a fonte pode ter sido corrigida, apagada pelo expurgo de 90 dias, ou nem
    existir mais. A entrada tem que continuar consistente sozinha."""
    entry_id = _entrada_criada(cli, food_ref=OVO, quantity=2, unit="un")

    res = cli.patch(f"/diary/{entry_id}", json={"unit": "xicara"})

    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "UNIT_NOT_SUPPORTED_FOR_FOOD"


@pytest.mark.parametrize("corpo", [
    {"quantity": 0},
    {"quantity": -5},
    {"quantity": 10_001},
    {"meal_slot": "brunch"},
    {"entry_date": "2026-13-45"},
    {"unit": "kg"},
])
def test_patch_aplica_as_mesmas_regras_do_post(cli, corpo):
    """As validações do POST não valem de nada se o PATCH aceitar o que ele recusa —
    e é fácil isso acontecer, porque os campos do PATCH são todos opcionais e um
    `Optional[float]` sem `gt=0` parece inofensivo."""
    entry_id = _entrada_criada(cli)

    assert cli.patch(f"/diary/{entry_id}", json=corpo).status_code == 422


def test_patch_recusa_data_fora_da_janela(cli):
    """A janela do RS-09 é da ESCRITA — e o PATCH é escrita. Sem isto, criar hoje e mover
    para o ano 3000 contorna a validação inteira em duas chamadas."""
    entry_id = _entrada_criada(cli)

    res = cli.patch(
        f"/diary/{entry_id}",
        json={"entry_date": (hoje() + timedelta(days=30)).isoformat()},
    )

    assert res.status_code == 422


def test_patch_recalcula_a_partir_do_snapshot_da_linha(cli, db_session):
    """Editar quantidade recalcula com os `*_per_base_unit` já persistidos.

    O teste corrompe o catálogo DEPOIS de criar a entrada: se o PATCH consultasse a fonte,
    o total de terça passada mudaria por causa de uma correção de curadoria feita hoje.
    """
    entry_id = _entrada_criada(cli, food_ref=ARROZ, quantity=100, unit="g")

    db_session.expire_all()
    fonte = (
        db_session.query(FoodCatalog)
        .filter(FoodCatalog.slug == "arroz-branco-cozido-g")
        .first()
    )
    fonte.kcal_per_base_unit = 999.0
    db_session.commit()

    res = cli.patch(f"/diary/{entry_id}", json={"quantity": 200})

    assert res.status_code == 200, res.text
    # 1.28 × 200 = 256.0, o valor do SNAPSHOT — não 999 × 200.
    assert res.json()["totals"]["calories"] == 256.0


# ======================================================================================
# Teto de entradas por dia (RS-11)
# ======================================================================================


def test_teto_de_60_entradas_por_dia(cli, db_session):
    """Teto de SEGURANÇA, fixo e igual nos três planos: ~10 itens por refeição nos 6 slots
    é folgado para humano e apertado para laço automatizado.

    A mensagem não fala em upgrade de propósito — "compre o Pro para registrar mais
    almoços" é o oposto do produto, que monetiza a inteligência e não a digitação.
    """
    dono = usuario(db_session, "dono@example.com")
    for _ in range(diary_math.MAX_ENTRADAS_POR_DIA):
        entrada_bruta(db_session, dono.id)

    res = criar(cli)

    assert res.status_code == 403
    detalhe = res.json()["detail"]
    assert detalhe["code"] == "PLAN_LIMIT_REACHED"
    assert detalhe["event_type"] == "diary_entries_per_day"
    assert detalhe["limit"] == 60
    assert detalhe["used"] == 60
    assert "upgrade" not in detalhe["message"].lower()


def test_teto_e_por_data_e_nao_por_conta(cli, db_session):
    """O escopo do teto é `(user_id, entry_date)`. Um teto por conta transformaria o
    limite de segurança de um dia num limite de histórico — 60 registros na vida."""
    dono = usuario(db_session, "dono@example.com")
    for _ in range(diary_math.MAX_ENTRADAS_POR_DIA):
        entrada_bruta(db_session, dono.id, data=hoje() - timedelta(days=1))

    assert criar(cli, data=hoje()).status_code == 201


def test_patch_que_move_para_um_dia_cheio_e_recusado(cli, db_session):
    """O teto vale na movimentação, senão ele é contornável: registre em 60 dias
    diferentes e mova tudo para o mesmo dia."""
    dono = usuario(db_session, "dono@example.com")
    ontem = hoje() - timedelta(days=1)
    for _ in range(diary_math.MAX_ENTRADAS_POR_DIA):
        entrada_bruta(db_session, dono.id, data=ontem)
    entry_id = _entrada_criada(cli, data=hoje())

    res = cli.patch(f"/diary/{entry_id}", json={"entry_date": ontem.isoformat()})

    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "PLAN_LIMIT_REACHED"
    db_session.expire_all()
    entrada = db_session.query(DiaryEntry).filter(DiaryEntry.id == entry_id).first()
    assert entrada.entry_date == hoje()


def test_patch_na_mesma_data_de_um_dia_cheio_continua_permitido(cli, db_session):
    """Contraprova: um dia cheio não pode congelar as entradas que já estão nele.

    Se a contagem rodasse em todo PATCH — e não só quando a data MUDA — corrigir "150 g"
    para "120 g" no 60º item viraria 403, e o usuário ficaria preso com o valor errado.
    """
    entry_id = _entrada_criada(cli)
    dono = usuario(db_session, "dono@example.com")
    for _ in range(diary_math.MAX_ENTRADAS_POR_DIA - 1):
        entrada_bruta(db_session, dono.id)

    res = cli.patch(f"/diary/{entry_id}", json={"quantity": 120})

    assert res.status_code == 200, res.text


# ======================================================================================
# Faixa de dias (§ 6.8)
# ======================================================================================


def test_summary_recusa_intervalo_invertido(cli):
    inicio = hoje()
    fim = inicio - timedelta(days=1)

    assert cli.get(f"/diary/summary?start={inicio}&end={fim}").status_code == 422


def test_summary_recusa_intervalo_maior_que_31_dias(cli):
    """O teto de 31 dias é o que impede a rota de virar exportador do histórico inteiro
    numa chamada — e, com ele, um caminho barato para varrer 2 anos de dados de saúde."""
    inicio = hoje() - timedelta(days=32)

    assert cli.get(f"/diary/summary?start={inicio}&end={hoje()}").status_code == 422


def test_summary_aceita_o_limite_exato(cli):
    """A borda é inclusiva: 31 dias de diferença entra. Um `>=` no lugar de `>` cortaria
    o mês fechado que a tela usa."""
    inicio = hoje() - timedelta(days=31)

    assert cli.get(f"/diary/summary?start={inicio}&end={hoje()}").status_code == 200


@pytest.mark.parametrize("query", ["", "?date=", "?date=ontem", "?date=2026-99-99"])
def test_leitura_do_dia_exige_data_valida(cli, query):
    assert cli.get(f"/diary{query}").status_code == 422
