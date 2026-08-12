"""Toda a aritmética do diário mora aqui, e em nenhum outro lugar.

Existe para que back e front produzam EXATAMENTE o mesmo número (§ 9 do ADR-0001). O
frontend não reimplementa nada daqui — ele nem soma.
"""

from typing import Literal

MealSlot = Literal[
    "cafe_da_manha", "lanche_manha", "almoco", "lanche_tarde", "jantar", "ceia"
]
DiaryUnit = Literal[
    "g", "ml", "un", "colher_sopa", "colher_cha", "xicara", "fatia", "porcao"
]
FoodBaseUnit = Literal["g", "ml", "un"]
FoodSource = Literal["taco", "curated", "openfoodfacts", "llm"]

# Ordem canônica das 6 chaves. DiaryDay.slots tem SEMPRE 6 itens, SEMPRE nesta ordem,
# mesmo vazios — o frontend nunca cria slot, nunca ordena, nunca preenche buraco.
MEAL_SLOT_ORDER: tuple[str, ...] = (
    "cafe_da_manha",
    "lanche_manha",
    "almoco",
    "lanche_tarde",
    "jantar",
    "ceia",
)

MEAL_SLOT_LABELS: dict[str, str] = {
    "cafe_da_manha": "Café da Manhã",
    "lanche_manha": "Lanche da Manhã",
    "almoco": "Almoço",
    "lanche_tarde": "Lanche da Tarde",
    "jantar": "Jantar",
    "ceia": "Ceia",
}

# Uma colher de sopa é 15 g de sólido e 15 ml de líquido — o base_unit do alimento decide
# qual. É aproximação assumida (uma colher de azeite tem ~13,5 g). A aproximação está no
# DADO nutricional, não no contrato: dois clientes com a mesma entrada obtêm rigorosamente
# o mesmo número.
UNIT_FACTOR: dict[str, float] = {
    "g": 1.0,
    "ml": 1.0,
    "colher_sopa": 15.0,
    "colher_cha": 5.0,
    "xicara": 240.0,
    "un": 1.0,
    "fatia": 1.0,
    "porcao": 1.0,
}

MASS_VOLUME_UNITS = frozenset({"g", "ml", "colher_sopa", "colher_cha", "xicara"})
COUNT_UNITS = frozenset({"un", "fatia", "porcao"})

_ALLOWED_UNITS: dict[str, list[str]] = {
    "g": ["g", "colher_sopa", "colher_cha", "xicara"],
    "ml": ["ml", "colher_sopa", "colher_cha", "xicara"],
    "un": ["un", "fatia", "porcao"],
}

# RS-10, segunda rede: uma quantidade válida (9.000 g) somada a um kcal/unidade válido
# mas alto (8,84 kcal/g do azeite) produz um total que corrompe o gráfico do dia.
TETO_KCAL_ENTRADA = 20_000.0

# RS-11: teto de SEGURANÇA, não comercial. ~10 itens por refeição nos 6 slots — folgado
# para humano, apertado para laço automatizado. Fixo e igual nos três planos.
MAX_ENTRADAS_POR_DIA = 60


def allowed_units(base_unit: str) -> list[str]:
    """Regra fechada, calculada no servidor e devolvida em FoodOption.allowed_units.

    "3 xícaras de ovo cozido (unidade)" não é erro de digitação a ser adivinhado: não há
    fator de conversão honesto entre contagem e volume sem saber o volume da unidade, e
    chutar produziria número errado com cara de certo.
    """
    return list(_ALLOWED_UNITS.get(base_unit, []))


def unidade_compativel(unit: str, base_unit: str) -> bool:
    return unit in _ALLOWED_UNITS.get(base_unit, [])


def calcular(
    kcal_por_base: float,
    macro_por_base: float | None,
    quantity: float,
    unit: str,
) -> tuple[float, float | None]:
    """Arredonda-se UMA vez, no fim. O fator intermediário nunca é arredondado.

    `round` nativo do Python (half-to-even). Não Decimal, não math.floor, não formatação
    de string — as três produzem um número diferente do que o contrato fixa.
    """
    fator = quantity * UNIT_FACTOR[unit]
    kcal = round(kcal_por_base * fator, 1)
    macro = None if macro_por_base is None else round(macro_por_base * fator, 1)
    return kcal, macro


def somar(valores: list[float | None]) -> float:
    """Soma valores JÁ arredondados e persistidos, e arredonda de novo.

    Deliberado, e é o cerne do § 9.3: somar valores crus e arredondar só no fim daria um
    total mais "correto" matematicamente e DIFERENTE da soma das linhas visíveis na tela
    — o usuário somaria 3 linhas na calculadora e acharia um bug. Preferimos o total que
    fecha com o que está escrito.

    `None` é IGNORADO, nunca tratado como 0 (§ 9.4): "0 g de proteína" é uma afirmação
    nutricional, e ninguém a fez.
    """
    return round(sum(v for v in valores if v is not None), 1)


def somar_macro(valores: list[float | None]) -> float | None:
    """Igual a `somar`, mas devolve `None` quando NENHUM valor é conhecido.

    A lista vazia (dia sem entrada) soma `0.0` — o § 6.4 exige "totals zerados" para o
    dia vazio. Já um dia com entradas em que nenhuma informa proteína devolve `None`:
    ali `0.0` seria a afirmação "você não comeu proteína", que é diferente de "não sei".
    `macros_incomplete` marca os dois casos parciais.
    """
    if valores and all(v is None for v in valores):
        return None
    return somar(valores)
