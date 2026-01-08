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

    # Calcula média por refeição (Agora seguro)
    avg_cal_per_meal = target_calories / meals_count
    
    # Dados opcionais com fallback
    fruit_txt = "INCLUA FRUTAS." if getattr(profile, 'eats_fruit', True) else "SEM FRUTAS."
    fat_txt = "BAIXA GORDURA." if getattr(profile, 'body_fat_goal', False) else "NORMAL."

    prompt = f"""
    Atue como nutricionista. Crie um plano de {days} dia(s).
    
    DADOS:
    - Calorias Totais: {target_calories:.0f} kcal.
    - Estrutura: {structure}
    - Objetivo: {profile.goal}
    
    REGRAS:
    1. Quantidades exatas para 1 pessoa (peso cru).
    2. {fruit_txt}
    3. {fat_txt}
    4. Gere EXATAMENTE {meals_count} refeições por dia.
    
    Responda APENAS JSON:
    {{
      "days": [
        {{
          "day": "Dia 1",
          "calories_target": {target_calories:.0f},
          "macros": {{ "protein": "...", "carbs": "...", "fats": "..." }},
          "meals": [
             {{ "name": "...", "suggestion": "...", "category": "almoco" }} 
          ],
          "tip": "..."
        }}
      ]
    }}
    """
    
    res = call_gemini(prompt)
    return json.loads(res) if res else None

# --- OUTRAS FUNÇÕES MANTIDAS ---
def get_food_calories(db: Session, food_name: str, unit: str) -> float:
    # Tenta cache
    cache = db.query(FoodCache).filter(FoodCache.food_name == food_name, FoodCache.unit == unit).first()
    if cache: return cache.calories
    
    prompt = f"Quantas calorias tem em 1 {unit} de {food_name}? Responda APENAS o número (float). Ex: 105.5"
    try:
        res = call_gemini(prompt)
        kcal = float(res.strip())
        # Salva cache
        db.add(FoodCache(food_name=food_name, unit=unit, calories=kcal))
        db.commit()
        return kcal
    except: return 0.0

def generate_recipe_from_ingredients(ingredients: list[str]):
    # Prompt ajustado para 1 pessoa e precisão calórica
    prompt = f"""
    Atue como um chef nutricionista preciso.
    Crie uma receita criativa usando ESTRITAMENTE estes ingredientes: {', '.join(ingredients)}.
    
    REGRAS OBRIGATÓRIAS:
    1. RENDIMENTO: Exatamente 1 PESSOA (Porção individual). Ajuste as quantidades para isso.
    2. CALORIAS: Calcule as calorias somando cada ingrediente individualmente. SEJA REALISTA (não invente valores baixos).
    3. INGREDIENTES: Liste cada item com quantidade exata (gramas/unidades) e calorias individuais.
    
    Responda APENAS JSON estrito:
    {{
      "title": "Nome Criativo do Prato",
      "instructions": "Passo a passo detalhado...",
      "prep_time": 20,
      "calories": 650, 
      "ingredients": [
        {{ "name": "Nome (ex: Arroz Cru)", "quantity": 100, "unit": "g", "calories": 360 }},
        {{ "name": "Nome (ex: Azeite)", "quantity": 1, "unit": "colher sopa", "calories": 119 }}
      ]
    }}
    """
    res = call_gemini(prompt)
    return json.loads(res) if res else None

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
    return json.loads(res) if res else None