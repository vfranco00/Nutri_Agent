import httpx
import json
from sqlalchemy.orm import Session
from app.core.config import settings
from app.schemas.profile import ProfileResponse
from app.models.food_cache import FoodCache

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={settings.GEMINI_API_KEY}"

def call_gemini(prompt: str):
    payload = { "contents": [{ "parts": [{"text": prompt}] }] }
    try:
        with httpx.Client() as client:
            response = client.post(GEMINI_URL, json=payload, timeout=120.0)
            if response.status_code != 200: return None
            data = response.json()
            if 'candidates' in data and data['candidates']:
                return data['candidates'][0]['content']['parts'][0]['text'].replace('```json', '').replace('```', '').strip()
    except: return None
    return None

def generate_meal_plan(profile: ProfileResponse, days: int = 1, variety_mode: str = "varied", meals_count: int = 4):
    """
    Gera o plano alimentar com controle estrito de porções e frequência.
    """
    
    # 1. Definição da Estrutura de Refeições
    if meals_count == 3:
        structure = "3 Refeições: Café da Manhã, Almoço, Jantar."
    elif meals_count == 4:
        structure = "4 Refeições: Café da Manhã, Almoço, Lanche da Tarde, Jantar."
    elif meals_count == 5:
        structure = "5 Refeições: Café da Manhã, Lanche da Manhã, Almoço, Lanche da Tarde, Jantar."
    else: # 6
        structure = "6 Refeições: Café, Lanche Manhã, Almoço, Lanche Tarde, Jantar, Ceia."

    # 2. Cálculo de Calorias por Refeição (Para a IA não se perder)
    avg_cal_per_meal = profile.daily_calories / meals_count
    
    # 3. Instruções de Perfil
    fruit_instruction = "INCLUA FRUTAS: O usuário gosta de frutas." if getattr(profile, 'eats_fruit', True) else "SEM FRUTAS: Substitua por vegetais."
    fat_instruction = "FOCO PERDA DE GORDURA: Baixo carbo simples, alta proteína." if getattr(profile, 'body_fat_goal', False) else ""
    variety_instruction = "VARIEDADE TOTAL." if variety_mode == "varied" else "MEAL PREP (Repita almoço/jantar)."

    prompt = f"""
    Atue como um nutricionista pessoal. Crie um plano alimentar para {days} dia(s).
    
    PERFIL DO USUÁRIO:
    - Meta Diária TOTAL: {profile.daily_calories:.0f} kcal (NÃO ULTRAPASSE).
    - Refeições por dia: {meals_count}.
    - Calorias Média por refeição: ~{avg_cal_per_meal:.0f} kcal.
    - Objetivo: {profile.goal}.
    - Dieta: {profile.diet_type}.
    - Alergias: {profile.allergies or "Nenhuma"}.
    
    REGRAS CRÍTICAS (OBRIGATÓRIO):
    1. {structure} (Gere EXATAMENTE essas refeições).
    2. PORÇÕES PARA 1 PESSOA APENAS. (Ex: 100g de frango, não 1kg).
    3. Quantidades realistas (Nada de "500g de arroz" numa sentada).
    4. {fruit_instruction}
    5. {fat_instruction}
    6. {variety_instruction}
    
    Responda APENAS JSON estrito:
    {{
      "days": [
        {{
          "day": "Dia 1",
          "calories_target": {profile.daily_calories:.0f},
          "macros": {{ "protein": "...", "carbs": "...", "fats": "..." }},
          "meals": [
            {{ "name": "Nome da Refeição (ex: Almoço)", "suggestion": "Descrição detalhada com quantidades para 1 pessoa...", "category": "almoco" }}
          ],
          "tip": "Dica."
        }}
      ]
    }}
    """
    
    res = call_gemini(prompt)
    return json.loads(res) if res else None

def get_food_calories(db: Session, food_name: str, unit: str) -> float:
    clean_name = food_name.lower().strip()
    cached = db.query(FoodCache).filter(FoodCache.name == clean_name).first()
    if cached: return cached.calories_per_unit

    prompt = f"Responda APENAS um número (float). Quantas calorias (kcal) tem em exatamente 1 {unit} de {food_name}? Exemplo: 1.5"
    res_text = call_gemini(prompt)
    
    try:
        if res_text:
            calories = float(res_text)
            new_cache = FoodCache(name=clean_name, calories_per_unit=calories, unit_type=unit)
            db.add(new_cache)
            db.commit()
            return calories
    except: pass
    return 0.0

def generate_recipe_from_ingredients(ingredients: list[str]):
    ing_list = ", ".join(ingredients)
    prompt = f"""
    Crie uma receita usando: {ing_list}.
    Responda JSON estrito:
    {{
      "title": "Nome do Prato",
      "prep_time": 30,
      "calories": 500,
      "instructions": "Passo a passo...",
      "ingredients": [ {{ "name": "Ingrediente", "quantity": 100, "unit": "g" }} ]
    }}
    """
    res = call_gemini(prompt)
    return json.loads(res) if res else None

def generate_shopping_list_from_plan(plan_data: dict):
    """
    Recebe o JSON do plano alimentar e cria uma lista de compras consolidada.
    """
    # Transforma o JSON do plano em texto para a IA ler
    plan_text = json.dumps(plan_data, indent=2, ensure_ascii=False)
    
    prompt = f"""
    Atue como um assistente de compras inteligente. Analise este plano alimentar semanal/diário:
    
    {plan_text}
    
    TAREFA:
    1. Extraia TODOS os ingredientes necessários para preparar essas refeições.
    2. CONSOLIDE as quantidades (ex: se tem ovos no café e no jantar, some tudo).
    3. Ignore itens básicos de despensa como sal, óleo e água, a menos que sejam específicos.
    4. Gere uma lista de compras prática.
    
    Responda APENAS um JSON estrito com esta estrutura:
    {{
      "title": "Compras do Cardápio NutriAgent",
      "items": [
        "1 dúzia de Ovos",
        "500g de Peito de Frango",
        "1kg de Batata Doce",
        "2 litros de Leite Desnatado"
      ]
    }}
    """
    
    res = call_gemini(prompt)
    return json.loads(res) if res else None