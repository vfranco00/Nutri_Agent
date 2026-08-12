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
