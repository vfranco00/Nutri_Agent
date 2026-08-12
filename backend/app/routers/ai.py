import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator
from typing import List, Literal, Optional

from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.quotas import (
    check_quota,
    log_usage,
    get_user_plan,
    check_meal_swap_quota,
    get_usage_count,
    require_shopping_access,
)
from app.core.plan_limits import PLAN_LIMITS
from app.models.user import User
from app.services.ai import (
    generate_meal_plan,
    get_food_calories,
    generate_recipe_from_ingredients,
    generate_shopping_list_from_plan,
    swap_meal_suggestion,
)

router = APIRouter()

# --- SCHEMAS ---
#
# Todo texto abaixo é concatenado dentro de um prompt enviado pro Gemini
# (app/services/ai.py). Duas consequências que valem por si:
#
#   1. Custo. Sem teto de tamanho e de cardinalidade, uma única requisição
#      autenticada monta um prompt de megabytes. É gasto direto na conta do
#      projeto, sem limite, disparado por qualquer conta grátis.
#   2. Injeção de prompt. Não dá pra impedir que o usuário escreva instruções no
#      meio do texto, mas dá pra limitar o quanto ele consegue escrever: um campo
#      de 120 caracteres não comporta um jailbreak, um campo ilimitado comporta.
#
# Os tetos são folgados pro uso real (um nome de alimento não tem 200 caracteres)
# e apertados pro abuso.

class FoodQuery(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # ge/le também descarta Infinity/NaN, que o parser de JSON do Python aceita e
    # que estouram a serialização da resposta lá na frente.
    quantity: float = Field(gt=0, le=100_000)
    unit: str = Field(min_length=1, max_length=40)

class IngredientList(BaseModel):
    ingredients: List[str] = Field(min_length=1, max_length=30)
    servings: int = Field(default=1, ge=1, le=20)

    @field_validator("ingredients")
    @classmethod
    def cap_ingredient_length(cls, v: List[str]) -> List[str]:
        if any(len(item) > 120 for item in v):
            raise ValueError("Cada ingrediente deve ter no máximo 120 caracteres.")
        return v

class GeneratePlanRequest(BaseModel):
    # `days` ia direto pro prompt sem teto: days=10000 pede um cardápio de 10 mil
    # dias pra IA. `meals_count` sem piso divide por zero em avg_cal_per_meal.
    days: int = Field(default=1, ge=1, le=31)
    variety: Literal["varied", "repetitive"] = "varied"
    meals_count: int = Field(default=4, ge=3, le=6)

class SwapMealRequest(BaseModel):
    # plan_token vira parte do event_type gravado em UsageEvent — limitar aqui evita
    # linha de banco arbitrariamente grande além do prompt inflado.
    plan_token: str = Field(min_length=1, max_length=64)
    slot_name: str = Field(min_length=1, max_length=80)
    calories_target: float = Field(ge=0, le=20_000)
    current_suggestion: str = Field(default="", max_length=600)
    avoid_suggestions: List[str] = Field(default_factory=list, max_length=20)

    @field_validator("avoid_suggestions")
    @classmethod
    def cap_avoid_length(cls, v: List[str]) -> List[str]:
        if any(len(item) > 600 for item in v):
            raise ValueError("Cada sugestão a evitar deve ter no máximo 600 caracteres.")
        return v


class ShoppingPlanMeal(BaseModel):
    name: str = Field(default="", max_length=120)
    suggestion: str = Field(default="", max_length=600)
    category: Optional[str] = Field(default=None, max_length=40)


class ShoppingPlanDay(BaseModel):
    day: str = Field(default="", max_length=60)
    meals: List[ShoppingPlanMeal] = Field(default_factory=list, max_length=8)


class PlanToShoppingListRequest(BaseModel):
    """Substitui o antigo `plan_data: Dict[str, Any]`.

    O dict livre era serializado inteiro com json.dumps e colado no prompt
    (services/ai.py::generate_shopping_list_from_plan). Ou seja: campo de texto
    ilimitado, com estrutura arbitrária, indo direto pro LLM sem cota nenhuma.
    Campos extras do payload (plan_token, macros, tip) são ignorados de propósito —
    o frontend manda o objeto do cardápio inteiro e não deve quebrar por isso."""

    days: List[ShoppingPlanDay] = Field(default_factory=list, max_length=14)

# --- ROTAS ---

@router.post("/generate-plan") # <--- A Rota que estava dando 404
def generate_ai_plan(
    data: GeneratePlanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Perfil não encontrado.")

    user_plan = get_user_plan(db, current_user)
    event_type = "generate_plan_starter" if user_plan == "starter" else (
        "generate_plan_weekly" if data.days >= 7 else "generate_plan_daily"
    )
    check_quota(db, current_user, event_type)

    # Passa o meals_count para a função
    plan = generate_meal_plan(
        current_user.profile,
        days=data.days,
        variety_mode=data.variety,
        meals_count=data.meals_count
    )

    if not plan:
        raise HTTPException(status_code=500, detail="Erro ao gerar plano.")

    log_usage(db, current_user.id, event_type)
    # Identificador desse cardápio gerado — usado só pra contar trocas de refeição
    # (POST /ai/swap-meal), já que o plano ainda não existe no banco até ser salvo.
    plan["plan_token"] = uuid.uuid4().hex
    return plan

@router.post("/swap-meal")
def swap_meal(
    data: SwapMealRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Perfil não encontrado.")

    check_meal_swap_quota(db, current_user, data.plan_token)

    suggestion = swap_meal_suggestion(
        current_user.profile,
        slot_name=data.slot_name,
        calories_target=data.calories_target,
        current_suggestion=data.current_suggestion,
        avoid_suggestions=data.avoid_suggestions,
    )
    if not suggestion:
        raise HTTPException(status_code=500, detail="A IA não conseguiu gerar uma alternativa.")

    event_type = f"meal_swap:{data.plan_token}"
    log_usage(db, current_user.id, event_type)

    plan = get_user_plan(db, current_user)
    rule = PLAN_LIMITS.get(plan, {}).get("meal_swap") or {"limit": 0, "window_days": 3650}
    swaps_used = get_usage_count(db, current_user.id, event_type, rule["window_days"])

    return {"suggestion": suggestion, "swaps_used": swaps_used, "swaps_limit": rule["limit"]}

@router.post("/calculate-calories")
@limiter.limit("60/minute")
def calculate_calories(
    request: Request,
    query: FoodQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Consulta calórica de um alimento.

    Barata no caminho feliz (tabela TACO local), mas o fallback chama Open Food Facts
    e, se falhar, o Gemini — e cada miss grava uma linha nova em FoodCache. Sem cota,
    um laço com nomes aleatórios queima orçamento de LLM e enche a tabela de cache
    com lixo, tudo com uma conta grátis. Cota por plano + rate limit por IP fecham
    os dois lados (gasto por usuário e rajada por origem)."""
    check_quota(db, current_user, "food_lookup")

    # user_id escopa as linhas NÃO confiáveis (openfoodfacts/llm) que esta consulta
    # gravar no cache — RS-17. Sem ele, o valor que a Open Food Facts (base editável por
    # qualquer pessoa) devolveu para esta conta seria servido para todas as outras.
    kcal_unit = get_food_calories(db, query.name, query.unit, user_id=current_user.id)
    total = kcal_unit * query.quantity

    log_usage(db, current_user.id, "food_lookup")
    return {"total_calories": round(total, 1)}

@router.post("/recipe-by-ingredients")
def create_recipe_idea(
    data: IngredientList,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_quota(db, current_user, "chef_ai")

    recipe = generate_recipe_from_ingredients(data.ingredients, servings=data.servings)
    if not recipe:
        raise HTTPException(status_code=500, detail="A IA não conseguiu gerar a receita.")

    log_usage(db, current_user.id, "chef_ai")
    return recipe

@router.post("/plan-to-shopping-list")
def create_shopping_list_proposal(
    plan_data: PlanToShoppingListRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    1. Recebe o cardápio completo.
    2. Usa a IA para extrair e somar os ingredientes.
    3. Retorna a lista para o usuário aprovar (NÃO SALVA NO BANCO AINDA).

    Lista de compras é recurso pago (Plus+). O router /shopping inteiro já é
    protegido por shopping_access_dependency, mas ESTA rota vive em /ai e ficava
    de fora: o Starter não conseguia salvar a lista, e mesmo assim conseguia
    mandar a IA gerá-la — que é justamente a parte cara. O bloqueio no frontend
    (AiPlain.tsx) é só de tela; um POST direto passava por cima.
    """
    require_shopping_access(db, current_user)
    check_quota(db, current_user, "shopping_list_ai")

    shopping_data = generate_shopping_list_from_plan(plan_data.model_dump())

    if not shopping_data:
        raise HTTPException(status_code=500, detail="A IA não conseguiu ler os ingredientes.")

    log_usage(db, current_user.id, "shopping_list_ai")
    # Retorna JSON puro: { "title": "Compras da Semana", "items": ["Arroz", "Feijão"] }
    return shopping_data