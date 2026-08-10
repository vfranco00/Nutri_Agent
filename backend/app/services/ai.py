import httpx
import json
import logging
import unicodedata
from sqlalchemy.orm import Session
from app.core.config import settings
from app.schemas.profile import ProfileResponse
from app.models.food_cache import FoodCache
from app.data.taco_foods import TACO_PER_100G, TACO_PER_UNIT

logger = logging.getLogger(__name__)

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={settings.GEMINI_API_KEY}"

# Abaixo do teto de request da plataforma (Render corta em ~100s). Com 120s, o proxy
# cortava ANTES do httpx desistir: o usuário via erro, a chamada ao Gemini já tinha sido
# paga, e o código nunca chegava na linha de debitar cota. Estourando primeiro aqui,
# a falha vira exceção nossa, tratável e contabilizável.
GEMINI_TIMEOUT_SECONDS = 90.0


def call_gemini(prompt: str):
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    try:
        with httpx.Client() as client:
            response = client.post(GEMINI_URL, json=payload, timeout=GEMINI_TIMEOUT_SECONDS)
            if response.status_code != 200:
                # Distinguir 401/403 (chave inválida) de 429 (cota) de 5xx (lado deles)
                # é a diferença entre corrigir em minutos e depurar no escuro.
                logger.error(
                    "Gemini respondeu %s: %s", response.status_code, response.text[:500]
                )
                return None
            data = response.json()
            if "candidates" in data and data["candidates"]:
                return (
                    data["candidates"][0]["content"]["parts"][0]["text"]
                    .replace("```json", "")
                    .replace("```", "")
                    .strip()
                )
            # Sem candidates normalmente é bloqueio do filtro de segurança do modelo —
            # silenciar isso fazia parecer erro de rede.
            logger.warning("Gemini respondeu 200 sem candidates: %s", str(data)[:500])
            return None
    except httpx.TimeoutException:
        logger.error("Gemini estourou o timeout de %ss", GEMINI_TIMEOUT_SECONDS)
        return None
    except httpx.HTTPError as exc:
        logger.error("Falha de rede ao chamar o Gemini: %s", exc)
        return None
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        # Formato de resposta inesperado. Antes caía no mesmo `except:` de um timeout.
        logger.error("Resposta do Gemini em formato inesperado: %s", exc)
        return None


def _safe_json_loads(res: str | None):
    """A IA às vezes devolve texto que não é JSON válido (explicação, markdown residual, etc.) —
    sem isso, um response ruim vira 500 não tratado em vez do fallback limpo que os routers já esperam."""
    if not res:
        return None
    try:
        return json.loads(res)
    except json.JSONDecodeError:
        return None


_DIET_TYPE_LABELS = {
    "omnivore": "Onívoro (sem restrições)",
    "flexitarian": "Flexitariano (reduz carne)",
    "pescatarian": "Pescetariano (come peixe, não come carne)",
    "vegetarian_ovo_lacto": "Vegetariano ovo-lacto (come ovos e laticínios, não come carne nem peixe)",
    "vegetarian_lacto": "Vegetariano lacto (come laticínios, não come ovos, carne nem peixe)",
    "vegetarian_ovo": "Vegetariano ovo (come ovos, não come laticínios, carne nem peixe)",
    "vegan": "Vegano (nenhum produto de origem animal)",
    "paleo": "Dieta Paleolítica",
}


def _diet_restrictions_prompt(profile: ProfileResponse) -> str:
    diet_label = _DIET_TYPE_LABELS.get(getattr(profile, "diet_type", None), "Onívoro (sem restrições)")
    lines = [f"Tipo de dieta: {diet_label}. NUNCA sugira ingredientes incompatíveis com essa dieta."]
    if getattr(profile, "allergies", None):
        lines.append(f"Alergias/restrições (NUNCA use): {profile.allergies}.")
    if getattr(profile, "food_dislikes", None):
        lines.append(f"Não gosta de (evite): {profile.food_dislikes}.")
    if getattr(profile, "food_likes", None):
        lines.append(f"Gosta de (priorize quando fizer sentido): {profile.food_likes}.")
    return "\n    ".join(lines)

_WEIGHT_UNITS = {"g", "grama", "gramas"}
_VOLUME_UNITS = {"ml", "mililitro", "mililitros"}


def _normalize(text: str) -> str:
    """minusculas, sem acento, sem espaços nas pontas — pra facilitar o match com o dataset TACO."""
    text = text.strip().lower()
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c))


def _best_match(query: str, dataset: dict[str, float]) -> float | None:
    """
    Match por palavras: bate se todas as palavras da query estão na chave (ou vice-versa),
    priorizando a maior quantidade de palavras em comum (ex: "frango grelhado" bate com
    "frango peito grelhado" e não com "frango coxa assada"). Cai pra substring como fallback.
    """
    query_words = set(query.split())
    best_key, best_score = None, -1
    for key in dataset:
        key_words = set(key.split())
        if query_words <= key_words or key_words <= query_words:
            score = len(query_words & key_words)
            if score > best_score:
                best_key, best_score = key, score
    if best_key is not None:
        return dataset[best_key]

    candidates = [key for key in dataset if key in query or query in key]
    if not candidates:
        return None
    return dataset[max(candidates, key=len)]


def _lookup_taco(food_name: str, unit: str) -> float | None:
    query = _normalize(food_name)
    unit_norm = _normalize(unit)

    if unit_norm in _WEIGHT_UNITS or unit_norm in _VOLUME_UNITS:
        kcal_100g = _best_match(query, TACO_PER_100G)
        if kcal_100g is not None:
            return round(kcal_100g / 100, 2)
        return None

    return _best_match(query, TACO_PER_UNIT)


def _lookup_open_food_facts(food_name: str, unit: str) -> float | None:
    """Fallback pra produtos de marca (ex: Rap10, Danone) que não estão na TACO. API pública, sem chave."""
    unit_norm = _normalize(unit)
    if unit_norm not in _WEIGHT_UNITS and unit_norm not in _VOLUME_UNITS:
        return None

    try:
        with httpx.Client() as client:
            response = client.get(
                "https://world.openfoodfacts.org/cgi/search.pl",
                params={
                    "search_terms": food_name,
                    "search_simple": 1,
                    "action": "process",
                    "json": 1,
                    "page_size": 5,
                },
                timeout=8.0,
            )
            if response.status_code != 200:
                return None
            products = response.json().get("products", [])
            for product in products:
                kcal_100g = product.get("nutriments", {}).get("energy-kcal_100g")
                if kcal_100g:
                    return round(float(kcal_100g) / 100, 2)
    except (httpx.HTTPError, ValueError, KeyError):
        return None
    return None


def get_food_calories(db: Session, food_name: str, unit: str) -> float:
    # 1. Cache do banco (hits anteriores de qualquer uma das fontes abaixo)
    cache = db.query(FoodCache).filter(
        FoodCache.name == food_name,
        FoodCache.unit_type == unit
    ).first()

    if cache:
        return cache.calories_per_unit

    def _save_and_return(kcal: float) -> float:
        try:
            exists = db.query(FoodCache).filter(FoodCache.name == food_name, FoodCache.unit_type == unit).first()
            if not exists:
                db.add(FoodCache(name=food_name, unit_type=unit, calories_per_unit=kcal))
                db.commit()
        except Exception:
            db.rollback()
        return kcal

    # 2. Tabela TACO local (alimentos brasileiros comuns, sem chamada externa)
    taco_kcal = _lookup_taco(food_name, unit)
    if taco_kcal is not None:
        return _save_and_return(taco_kcal)

    # 3. Open Food Facts (produtos de marca que não estão na TACO)
    off_kcal = _lookup_open_food_facts(food_name, unit)
    if off_kcal is not None:
        return _save_and_return(off_kcal)

    # 4. Último recurso: pergunta pra IA
    prompt = f"""
    Atue como um banco de dados nutricional.
    Preciso das calorias de: 1 {unit} de "{food_name}".

    Se for um produto comercial (ex: Rap10, Danone), use a média do mercado.
    Se não souber a unidade exata, estime para uma porção média.

    Responda APENAS o número (float). Exemplo: 105.5
    Se for impossível determinar, responda: 0
    """

    try:
        res = call_gemini(prompt)
        import re
        numbers = re.findall(r"[-+]?\d*\.\d+|\d+", res)
        kcal = float(numbers[0]) if numbers else 0.0

        if kcal > 0:
            return _save_and_return(kcal)
        return kcal
    except Exception:
        return 0.0
    
def generate_meal_plan(profile: ProfileResponse, days: int = 1, variety_mode: str = "varied", meals_count: int = 4):
    """
    Gera o plano alimentar com controle estrito.
    """

    # --- PROTEÇÃO CONTRA VALORES NULOS (FIX DO ERRO 500) ---
    # Se daily_calories for None, assume 2000 padrão
    target_calories = profile.daily_calories if profile.daily_calories and profile.daily_calories > 0 else 2000

    # 1. Definição da Estrutura
    if meals_count == 3:
        structure = "APENAS 3 REFEIÇÕES: Café da Manhã, Almoço, Jantar."
    elif meals_count == 4:
        structure = "4 REFEIÇÕES: Café da Manhã, Almoço, Lanche da Tarde, Jantar."
    elif meals_count == 5:
        structure = "5 REFEIÇÕES: Café da Manhã, Lanche da Manhã, Almoço, Lanche da Tarde, Jantar."
    else:
        structure = "6 REFEIÇÕES: Café, Lanche Manhã, Almoço, Lanche Tarde, Jantar, Ceia."

    # Calcula média por refeição — usado no prompt pra guiar a distribuição calórica
    avg_cal_per_meal = target_calories / meals_count

    # Dados opcionais com fallback
    fruit_txt = "INCLUA FRUTAS." if getattr(profile, 'eats_fruit', True) else "SEM FRUTAS."
    fat_txt = "BAIXA GORDURA." if getattr(profile, 'body_fat_goal', False) else "NORMAL."
    variety_txt = (
        "PRATICIDADE: pode repetir os mesmos pratos em dias diferentes, pra facilitar compras e preparo."
        if variety_mode == "repetitive"
        else "VARIEDADE: evite repetir o mesmo prato em dias diferentes do plano."
    )
    diet_txt = _diet_restrictions_prompt(profile)

    prompt = f"""
    Atue como nutricionista. Crie um plano de {days} dia(s).

    DADOS:
    - Calorias Totais: {target_calories:.0f} kcal ({avg_cal_per_meal:.0f} kcal por refeição em média — distribua de forma realista, não precisa ser idêntico em todas).
    - Estrutura: {structure}
    - Objetivo: {profile.goal}
    - {diet_txt}

    REGRAS:
    1. Quantidades exatas para 1 pessoa (peso cru).
    2. {fruit_txt}
    3. {fat_txt}
    4. {variety_txt}
    5. Gere EXATAMENTE {meals_count} refeições por dia.
    6. O array "days" precisa ter EXATAMENTE {days} objeto(s), um por dia, numerados sequencialmente ("Dia 1", "Dia 2", ..., "Dia {days}"). Nunca gere menos dias do que os {days} pedidos.
    7. Responda em português do Brasil.
    8. Cada refeição precisa de um campo "category" com EXATAMENTE um destes valores, escolhido pelo horário/tipo real da refeição (nunca invente outro valor): "cafe_da_manha", "lanche", "almoco", "jantar", "ceia".

    Responda APENAS JSON válido, sem markdown, sem comentários, sem texto fora do JSON:
    {{
      "days": [
        {{
          "day": "Dia 1",
          "calories_target": {target_calories:.0f},
          "macros": {{ "protein": "...", "carbs": "...", "fats": "..." }},
          "meals": [
             {{ "name": "...", "suggestion": "...", "category": "cafe_da_manha" }}
          ],
          "tip": "..."
        }}
      ]
    }}
    """

    res = call_gemini(prompt)
    return _safe_json_loads(res)


def swap_meal_suggestion(
    profile: ProfileResponse,
    slot_name: str,
    calories_target: float,
    current_suggestion: str,
    avoid_suggestions: list[str],
) -> str | None:
    """Gera UMA sugestão alternativa pra uma refeição específica do cardápio, sem repetir
    o que já está no dia (current_suggestion + avoid_suggestions) e respeitando o perfil."""
    diet_txt = _diet_restrictions_prompt(profile)
    avoid_all = "; ".join(dict.fromkeys([current_suggestion, *avoid_suggestions]))

    prompt = f"""
    Atue como nutricionista. O usuário não gostou de uma refeição do cardápio e quer uma alternativa.

    Refeição a substituir: {slot_name}
    Meta calórica dessa refeição: ~{calories_target:.0f} kcal
    - {diet_txt}

    Sugira UMA alternativa diferente de todas estas (não repita nenhuma, nem parecida): {avoid_all}

    Responda APENAS JSON válido, sem markdown, sem texto fora do JSON:
    {{ "suggestion": "descrição da nova refeição, com quantidades exatas para 1 pessoa" }}
    """
    res = call_gemini(prompt)
    data = _safe_json_loads(res)
    return data.get("suggestion") if data else None


def generate_recipe_from_ingredients(ingredients: list[str], servings: int = 1):
    prompt = f"""
    Atue como um chef nutricionista preciso.
    Crie uma receita criativa usando ESTRITAMENTE estes ingredientes: {', '.join(ingredients)}.

    REGRAS OBRIGATÓRIAS:
    1. RENDIMENTO: Exatamente {servings} PESSOA(S). Ajuste as quantidades de cada ingrediente pra render {servings} porção(ões).
    2. CALORIAS: Calcule as calorias somando cada ingrediente individualmente, já na quantidade total pra {servings} pessoa(s). SEJA REALISTA.
    3. INGREDIENTES: Liste cada item com quantidade exata (gramas/unidades) e calorias individuais, já escalados pra {servings} pessoa(s).
    4. CATEGORIA: classifique o prato com EXATAMENTE um destes valores, o que fizer mais sentido pro tipo de prato (nunca invente outro valor): "cafe_da_manha", "lanche", "almoco", "jantar", "ceia", "doce", "salgado".

    Responda APENAS JSON estrito:
    {{
      "title": "Nome Criativo do Prato",
      "instructions": "Passo a passo detalhado...",
      "prep_time": 20,
      "calories": 650,
      "category": "almoco",
      "ingredients": [
        {{ "name": "Nome (ex: Arroz Cru)", "quantity": 100, "unit": "g", "calories": 360 }},
        {{ "name": "Nome (ex: Azeite)", "quantity": 1, "unit": "colher sopa", "calories": 119 }}
      ]
    }}
    """
    res = call_gemini(prompt)
    return _safe_json_loads(res)

def generate_shopping_list_from_plan(plan_data: dict):
    plan_text = json.dumps(plan_data, ensure_ascii=False)
    prompt = f"""
    Analise este cardápio e gere uma lista de compras consolidada.
    Cardápio: {plan_text}

    Responda APENAS JSON:
    {{
      "title": "Lista da Semana",
      "items": ["Item A", "Item B"]
    }}
    """
    res = call_gemini(prompt)
    return _safe_json_loads(res)