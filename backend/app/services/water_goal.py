"""Meta diária de água (spec Nuvi, §7 item 5)."""

import math

ML_POR_KG = 35
PASSO_ML = 50
META_SEM_PESO_ML = 2000


def water_goal_ml(weight_kg: float | None) -> int:
    """Peso × 35 ml, no múltiplo de 50 ml mais próximo (meio sobe). Sem peso, 2.000 ml.

    `round()` do Python arredonda o meio para o PAR (2475 viraria 2450 ou 2500 conforme
    o caso); `floor(x + 0.5)` sobe sempre, que é o que uma pessoa espera ler.
    """
    if not weight_kg or weight_kg <= 0:
        return META_SEM_PESO_ML
    return int(math.floor(weight_kg * ML_POR_KG / PASSO_ML + 0.5)) * PASSO_ML
