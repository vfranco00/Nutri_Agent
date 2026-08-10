"""
Limites de cada plano de assinatura. São só constantes — ajustar um número aqui
não exige migration nem deploy de banco, só um novo deploy do backend.

Cada evento tem `limit` (None = ilimitado) e `window_days` (janela móvel:
"últimos N dias", em vez de contador com reset manual/cron).
"""

PLAN_LIMITS: dict[str, dict] = {
    "starter": {
        "shopping_list_access": False,
        "max_saved_meal_plans": 5,
        "max_saved_recipes": 10,
        "chef_ai": {"limit": 5, "window_days": 7},
        "generate_plan_starter": {"limit": 2, "window_days": 30},
        # Consulta calórica de ingrediente (POST /ai/calculate-calories). Teto folgado
        # de propósito: o caminho normal (montar receitas) gasta ~10 por receita, então
        # 200/dia não incomoda ninguém — serve só pra travar o laço automatizado que
        # queima chamada de LLM e enche a tabela FoodCache.
        "food_lookup": {"limit": 200, "window_days": 1},
    },
    "plus": {
        "shopping_list_access": True,
        "max_saved_meal_plans": 30,
        "max_saved_recipes": 50,
        "chef_ai": {"limit": 30, "window_days": 30},
        "generate_plan_weekly": {"limit": 1, "window_days": 7},
        "generate_plan_daily": {"limit": 7, "window_days": 7},
        "food_lookup": {"limit": 1000, "window_days": 1},
        # Geração da lista de compras pela IA (POST /ai/plan-to-shopping-list).
        "shopping_list_ai": {"limit": 30, "window_days": 7},
        # Contado por cardápio gerado (event_type dinâmico "meal_swap:<plan_token>"),
        # não por janela de tempo — por isso window_days bem largo (10 anos).
        "meal_swap": {"limit": 2, "window_days": 3650},
    },
    "pro": {
        "shopping_list_access": True,
        "max_saved_meal_plans": None,
        "max_saved_recipes": None,
        "chef_ai": {"limit": None, "window_days": 7},
        "generate_plan_weekly": {"limit": None, "window_days": 7},
        "generate_plan_daily": {"limit": None, "window_days": 7},
        "generate_plan_starter": {"limit": None, "window_days": 30},
        "meal_swap": {"limit": None, "window_days": 3650},
        "food_lookup": {"limit": None, "window_days": 1},
        "shopping_list_ai": {"limit": None, "window_days": 7},
    },
}

PLAN_LABELS = {"starter": "Starter", "plus": "Plus", "pro": "Pro"}

PLAN_PRICES_BRL = {"starter": 0, "plus": 29.9, "pro": 59.9}
