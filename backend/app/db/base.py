"""Agregador de metadata — importe daqui quem precisa do schema COMPLETO.

A classe `Base` mora em `app/db/base_class.py`; os models importam de lá. Este módulo
existe para um único propósito: garantir que, ao importar `Base` daqui, TODOS os models
já tenham sido registrados em `Base.metadata`.

Por que isso importa: o Alembic compara `target_metadata` com o banco real e emite
`DROP TABLE` para tudo que existe no banco e não está no metadata. Antes desta mudança,
`migrations/env.py` listava os models à mão e dois haviam sido esquecidos (`payment` e
`feedback`) — o próximo `--autogenerate` teria apagado as tabelas `payments` e
`feedback_tickets`, com receita confirmada e chamados de suporte dentro.

Listar os imports à mão em `env.py` era o erro de método: qualquer model novo que alguém
esquecesse de adicionar reproduzia o bug, silenciosamente. Com o agregador, o ponto de
registro é um só.

AO CRIAR UM MODEL NOVO: importe-o aqui embaixo. É o único lugar.
"""

from app.db.base_class import Base

# Os imports abaixo existem pelo efeito colateral de registrar cada model no
# Base.metadata. Não remova por parecerem "não usados" — o `noqa: F401` marca isso.
from app.models.user import User  # noqa: F401
from app.models.profile import Profile  # noqa: F401
from app.models.recipe import Recipe  # noqa: F401
from app.models.ingredient import Ingredient  # noqa: F401
from app.models.weight_history import WeightHistory  # noqa: F401
from app.models.food_cache import FoodCache  # noqa: F401
from app.models.shopping import ShoppingList, ShoppingItem  # noqa: F401
from app.models.meal_plan import MealPlan, MealPlanDay, MealPlanMeal  # noqa: F401
from app.models.subscription import Subscription, UsageEvent  # noqa: F401
from app.models.payment import Payment  # noqa: F401
from app.models.feedback import FeedbackTicket  # noqa: F401

__all__ = ["Base"]
