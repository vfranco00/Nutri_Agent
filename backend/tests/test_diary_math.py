"""Aritmética do diário — § 9 do ADR-0001, testada sem banco e sem HTTP.

Esta é a seção do contrato que back e front precisam produzir IGUAL. O modo de falha que
ela previne não é uma exceção: é a barra do dashboard discordando da soma das linhas
visíveis por 0,1 kcal, todo dia, sem nenhum erro em lugar nenhum. O usuário soma três
linhas na calculadora, acha um número diferente do total, e a conclusão dele é "o app está
errado" — o que, do ponto de vista dele, é verdade.

Estes testes são de unidade de propósito: são a única camada que consegue fixar a REGRA
(arredonda uma vez, no fim; soma valores já arredondados; `None` não é zero) sem que ela
fique escondida atrás de um payload de 40 linhas.
"""

import pytest

from app.services import diary_math


# ======================================================================================
# Unidades (§ 9.1 e § 9.2)
# ======================================================================================


def test_as_oito_unidades_e_seus_fatores():
    """A tabela inteira, valor a valor. Não é redundante com o `Literal` do schema: o
    `Literal` garante quais strings entram, esta tabela garante por quanto cada uma
    multiplica — e é o fator, não o nome, que vira caloria."""
    assert diary_math.UNIT_FACTOR == {
        "g": 1.0,
        "ml": 1.0,
        "colher_sopa": 15.0,
        "colher_cha": 5.0,
        "xicara": 240.0,
        "un": 1.0,
        "fatia": 1.0,
        "porcao": 1.0,
    }


def test_familias_de_unidade_sao_disjuntas_e_cobrem_tudo():
    """Uma unidade em nenhuma das duas famílias ficaria sem regra de compatibilidade; em
    ambas, teria duas regras contraditórias."""
    assert diary_math.MASS_VOLUME_UNITS & diary_math.COUNT_UNITS == frozenset()
    assert (
        diary_math.MASS_VOLUME_UNITS | diary_math.COUNT_UNITS
        == diary_math.UNIT_FACTOR.keys()
    )


@pytest.mark.parametrize(
    "base_unit,esperado",
    [
        ("g", ["g", "colher_sopa", "colher_cha", "xicara"]),
        ("ml", ["ml", "colher_sopa", "colher_cha", "xicara"]),
        ("un", ["un", "fatia", "porcao"]),
    ],
)
def test_allowed_units_por_base_unit(base_unit, esperado):
    """A ORDEM também é contrato: o frontend monta o seletor a partir desta lista, e o
    primeiro item é o padrão que o usuário vê. Se `xicara` virasse o primeiro de `g`,
    todo registro feito sem trocar o seletor passaria a valer 240×."""
    assert diary_math.allowed_units(base_unit) == esperado


def test_base_unit_desconhecido_nao_libera_nenhuma_unidade():
    """Fail-closed. Um `.get(base_unit, TODAS)` — que é o "conserto" natural quando
    aparece um alimento com unidade estranha — liberaria xícara para alimento de
    contagem, que é exatamente o que o § 9.2 proíbe."""
    assert diary_math.allowed_units("kg") == []
    assert diary_math.unidade_compativel("g", "kg") is False


@pytest.mark.parametrize("unit", ["un", "fatia", "porcao"])
def test_unidade_de_contagem_nao_serve_para_alimento_de_massa(unit):
    """"1 fatia de arroz" não tem conversão honesta: quanto pesa a fatia? Chutar 1 g
    produziria 1,28 kcal com cara de número conferido."""
    assert diary_math.unidade_compativel(unit, "g") is False


@pytest.mark.parametrize("unit", ["g", "ml", "colher_sopa", "colher_cha", "xicara"])
def test_unidade_de_massa_nao_serve_para_alimento_de_contagem(unit):
    assert diary_math.unidade_compativel(unit, "un") is False


# ======================================================================================
# Cálculo (§ 9.3)
# ======================================================================================


@pytest.mark.parametrize(
    "kcal_por_base,quantidade,unidade,esperado",
    [
        (1.28, 100, "g", 128.0),  # 100 g de arroz branco cozido
        (1.28, 150, "g", 192.0),  # 150 g de arroz branco cozido
        (8.84, 1, "colher_sopa", 132.6),  # 1 colher de sopa de azeite
        (70.0, 2, "un", 140.0),  # 2 ovos
        (0.61, 0.5, "xicara", 73.2),  # meia xícara de leite integral
    ],
)
def test_exemplos_verificaveis_do_contrato(kcal_por_base, quantidade, unidade, esperado):
    """Os cinco exemplos que o § 9.3 publica como caso de teste.

    São a âncora entre este código, o ADR e o frontend: se um deles mudar, o outro tem que
    mudar junto, e é aqui que a divergência aparece.
    """
    kcal, _ = diary_math.calcular(kcal_por_base, None, quantidade, unidade)
    assert kcal == esperado


def test_o_fator_intermediario_nunca_e_arredondado():
    """1,5 colher de chá é fator 7,5 — não 7, não 8.

    Arredondar o fator é o atalho tentador (dá números "redondos" na tela) e é errado: o
    erro fica proporcional à quantidade e cresce silenciosamente conforme o usuário
    registra porções maiores.
    """
    assert diary_math.calcular(1.0, None, 1.5, "colher_cha") == (7.5, None)


@pytest.mark.parametrize("valor,esperado", [(0.25, 0.2), (0.75, 0.8), (0.35, 0.3)])
def test_arredondamento_e_o_round_nativo_meio_para_par(valor, esperado):
    """`round` nativo do Python, não `Decimal(ROUND_HALF_UP)`, não `math.floor`.

    As três "consertam" o mesmo empate de jeitos diferentes: 0,25 vira 0,2 aqui e 0,3 com
    Decimal. Uma casa decimal parece irrelevante até ser somada 60 vezes por dia e
    comparada com o que o frontend calculou com a regra do JavaScript.
    """
    kcal, _ = diary_math.calcular(valor, None, 1, "g")
    assert kcal == esperado


def test_macro_desconhecido_permanece_desconhecido():
    """§ 9.4: `None` entra e `None` sai. "0 g de proteína" é uma afirmação nutricional, e
    um alimento sem macro publicado não a fez."""
    kcal, macro = diary_math.calcular(4.71, None, 50, "g")

    assert kcal == 235.5
    assert macro is None


def test_macro_zero_nao_e_confundido_com_desconhecido():
    """Contraprova: azeite tem 0,0 g de carboidrato POR MEDIÇÃO. Esse zero é um fato e
    tem que sobreviver — tratar `0.0` como "não sei" (um `if not macro`) apagaria dado
    verdadeiro."""
    _, macro = diary_math.calcular(8.84, 0.0, 15, "g")

    assert macro == 0.0
    assert macro is not None


# ======================================================================================
# Somas (§ 9.3, regra 3, e § 9.4)
# ======================================================================================


def test_o_total_soma_valores_ja_arredondados():
    """O cerne do § 9.3. Três entradas de 0,333 kcal viram 0,3 cada na tela.

    Somar os valores CRUS daria 0,999 → 1,0: um total mais "correto" matematicamente e
    DIFERENTE da soma das três linhas que o usuário está vendo. O contrato escolhe o total
    que fecha com o que está escrito.
    """
    ja_arredondados = [diary_math.calcular(0.333, None, 1, "g")[0] for _ in range(3)]

    assert ja_arredondados == [0.3, 0.3, 0.3]
    assert diary_math.somar(ja_arredondados) == 0.9


def test_soma_esconde_o_ruido_do_float_binario():
    """Somar 60 floats acumula ruído na 13ª casa — consequência conhecida e aceita de usar
    `Float` em vez de `Numeric`. O `round(..., 1)` na fronteira o esconde por completo na
    faixa desta feature; sem ele, o total sairia como 0.9999999999999999."""
    assert diary_math.somar([0.1] * 10) == 1.0


def test_dia_vazio_soma_zero():
    """O § 6.4 exige "totais zerados" para o dia sem entrada — `None` ali quebraria o tipo
    `calories: number` do frontend."""
    assert diary_math.somar([]) == 0.0
    assert diary_math.somar_macro([]) == 0.0


def test_macro_nulo_e_ignorado_e_nao_somado_como_zero():
    """A diferença aparece no acompanhamento: com `None`→0, o dia em que o usuário comeu
    um alimento sem macro publicado mostraria proteína MENOR do que ele comeu, e ele
    ajustaria a dieta para compensar um déficit que não existe."""
    assert diary_math.somar_macro([2.5, None, 3.5]) == 6.0


def test_macro_totalmente_desconhecido_devolve_none_e_nao_zero():
    """Um dia com entradas em que NENHUMA informa proteína não é "você não comeu
    proteína" — é "não sei". `0.0` ali é a afirmação que ninguém fez, e é a mesma classe
    de mentira que o RS-22 proíbe para falha de rede."""
    assert diary_math.somar_macro([None, None]) is None


# ======================================================================================
# Constantes de contrato
# ======================================================================================


def test_os_seis_slots_em_ordem_fixa():
    """Ordem canônica, em API, banco e TypeScript. `DiaryDay.slots` sai nesta ordem e o
    frontend não reordena — trocar duas chaves aqui reordena a tela sem tocar no frontend."""
    assert diary_math.MEAL_SLOT_ORDER == (
        "cafe_da_manha",
        "lanche_manha",
        "almoco",
        "lanche_tarde",
        "jantar",
        "ceia",
    )


def test_todo_slot_tem_rotulo_e_nenhum_rotulo_sobra():
    """Um slot sem rótulo estoura `KeyError` na montagem do dia — 500 na rota central da
    feature, por causa de uma chave adicionada em um dicionário e não no outro."""
    assert tuple(diary_math.MEAL_SLOT_LABELS) == diary_math.MEAL_SLOT_ORDER


def test_tetos_de_seguranca():
    """Fixos e iguais nos três planos: teto de SEGURANÇA não varia com o plano. Confundir
    com teto comercial leva a "compre o Pro para registrar mais almoços"."""
    assert diary_math.MAX_ENTRADAS_POR_DIA == 60
    assert diary_math.TETO_KCAL_ENTRADA == 20_000.0
