"""Normalização de nome de alimento — minúscula, sem acento, sem espaço nas pontas.

Cópia intencional de `services/ai.py::_normalize`. O ADR-0001 exige que `services/ai.py`
fique INTOCADO (`TACO_PER_100G`/`TACO_PER_UNIT` são dependência dele), e `app/data/` não
pode importar de `app/services/` sem criar ciclo — `ai.py` importa `taco_foods.py`.

A duplicação é fechada por teste: `tests/test_diary_foods.py::test_normalize_equivale_ao_de_ai`
falha se as duas implementações divergirem. Sem esse teste, a divergência seria silenciosa
e apareceria como um miss de cache que ninguém consegue explicar.
"""

import unicodedata


def normalize_food_name(text: str) -> str:
    text = text.strip().lower()
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c))


# Sinônimos aceitos para cada unidade base. As chaves já estão normalizadas (minúsculas,
# sem acento) porque a comparação passa por `normalize_food_name`.
_SINONIMOS_DE_BASE_UNIT: dict[str, str] = {
    "g": "g", "grama": "g", "gramas": "g", "gr": "g",
    "ml": "ml", "mililitro": "ml", "mililitros": "ml",
    "un": "un", "und": "un", "unidade": "un", "unidades": "un", "unid": "un",
}


def normalizar_base_unit(unit_type: str | None) -> str | None:
    """Mapeia o `unit_type` bruto de `food_cache` para o domínio `g|ml|un`.

    Devolve `None` quando não há mapeamento honesto — e `None` aqui significa
    "inutilizável", não "vazio".

    Existe porque `food_cache.unit_type` é texto livre: `/ai/calculate-calories` aceita
    `unit` com até 40 caracteres quaisquer e grava o valor cru. Em produção havia linhas
    com `Gramas`, `unidade` e `fatia`. `FoodOption.base_unit` é um `Literal["g","ml","un"]`,
    então montar a opção a partir dessas linhas estourava na serialização do Pydantic e
    virava **500** numa rota autenticada (achado A-03).

    `fatia` não está no mapa DE PROPÓSITO: é uma unidade de porção válida para registrar,
    mas não é unidade BASE — não existe fator honesto entre "fatia" e g/ml/un sem saber o
    peso da fatia. Adivinhar produziria número errado com cara de certo.
    """
    if not unit_type:
        return None
    return _SINONIMOS_DE_BASE_UNIT.get(normalize_food_name(unit_type))
