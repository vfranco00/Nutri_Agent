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

def get_food_calories(db: Session, food_name: str, unit: str) -> float:
    # 1. Tenta cache (NOMES CORRIGIDOS: unit_type e calories_per_unit)
    cache = db.query(FoodCache).filter(
        FoodCache.name == food_name, 
        FoodCache.unit_type == unit
    ).first()
    
    if cache: return cache.calories_per_unit

    # --- CHEAT CODE: CORREÇÕES MANUAIS BRASIL ---
    # CORREÇÃO AQUI: Usar 'food_name' em vez de 'name'
    name_lower = food_name.lower() 
    manual_calories = 0
    
    # Ajuste para pegar variações
    if "rap10" in name_lower or "rap 10" in name_lower: manual_calories = 120.0
    elif "tapioca" in name_lower: manual_calories = 130.0
    elif "pão francês" in name_lower or "pao frances" in name_lower: manual_calories = 135.0
    elif "requeijão" in name_lower or "requeijao" in name_lower: manual_calories = 80.0
    
    # Se achou no manual, salva no cache e retorna
    if manual_calories > 0:
        try:
            # Verifica se já não existe antes de adicionar para evitar erro de unique
            exists = db.query(FoodCache).filter(FoodCache.name == food_name, FoodCache.unit_type == unit).first()
            if not exists:
                db.add(FoodCache(
                    name=food_name, 
                    unit_type=unit, 
                    calories_per_unit=manual_calories
                ))
                db.commit()
        except:
            db.rollback()
        return manual_calories
    # --------------------------------------------
    
    # 2. PROMPT BLINDADO
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
            # CORREÇÃO AQUI TAMBÉM NO INSERT
            db.add(FoodCache(
                name=food_name, 
                unit_type=unit, 
                calories_per_unit=kcal
            ))
            db.commit()
            
        return kcal
    except: 
        return 0.0
    
def generate_meal_plan(profile: ProfileResponse, days: int = 1, variety_mode: str = "varied", meals_count: int = 4):
    
    # Proteção contra nulos
    target_calories = profile.daily_calories if profile.daily_calories and profile.daily_calories > 0 else 2000
    
    if meals_count == 3:
        structure = "APENAS 3 REFEIÇÕES: Café da Manhã, Almoço, Jantar."
    elif meals_count == 4:
        structure = "4 REFEIÇÕES: Café da Manhã, Almoço, Lanche da Tarde, Jantar."
    elif meals_count == 5:
        structure = "5 REFEIÇÕES: Café da Manhã, Lanche da Manhã, Almoço, Lanche da Tarde, Jantar."
    else:
        structure = "6 REFEIÇÕES: Café, Lanche Manhã, Almoço, Lanche Tarde, Jantar, Ceia."

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

def generate_recipe_from_ingredients(ingredients: list[str]):
    prompt = f"""
    Atue como um chef nutricionista preciso.
    Crie uma receita criativa usando ESTRITAMENTE estes ingredientes: {', '.join(ingredients)}.
    
    REGRAS OBRIGATÓRIAS:
    1. RENDIMENTO: Exatamente 1 PESSOA (Porção individual). Ajuste as quantidades para isso.
    2. CALORIAS: Calcule as calorias somando cada ingrediente individualmente. SEJA REALISTA.
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