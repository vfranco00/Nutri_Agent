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
    },
    "plus": {
        "shopping_list_access": True,
        "max_saved_meal_plans": 30,
        "max_saved_recipes": 50,
        "chef_ai": {"limit": 30, "window_days": 30},
        "generate_plan_weekly": {"limit": 1, "window_days": 7},
        "generate_plan_daily": {"limit": 7, "window_days": 7},
    },
    "pro": {
        "shopping_list_access": True,
        "max_saved_meal_plans": None,
        "max_saved_recipes": None,
        "chef_ai": {"limit": None, "window_days": 7},
        "generate_plan_weekly": {"limit": None, "window_days": 7},
        "generate_plan_daily": {"limit": None, "window_days": 7},
        "generate_plan_starter": {"limit": None, "window_days": 30},
    },
}

PLAN_LABELS = {"starter": "Starter", "plus": "Plus", "pro": "Pro"}

PLAN_PRICES_BRL = {"starter": 0, "plus": 29.9, "pro": 59.9}
