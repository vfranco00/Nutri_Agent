import httpx
import json
from sqlalchemy.orm import Session
from app.core.config import settings
from app.schemas.profile import ProfileResponse
from app.models.food_cache import FoodCache

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={settings.GEMINI_API_KEY}"

def call_gemini(prompt: str):
    """Função centralizada para chamar o Google."""
    payload = { "contents": [{ "parts": [{"text": prompt}] }] }
    try:
        print(f"📡 Chamando IA...")
        with httpx.Client() as client:
            # Aumentei o timeout para 120s porque gerar 7 dias demora mais
            response = client.post(GEMINI_URL, json=payload, timeout=120.0)
            
            if response.status_code != 200:
                print(f"❌ Erro Google ({response.status_code}): {response.text}")
                return None

            data = response.json()
            if 'candidates' in data and data['candidates']:
                raw_text = data['candidates'][0]['content']['parts'][0]['text']
                clean_text = raw_text.replace('```json', '').replace('```', '').strip()
                return clean_text
            else:
                return None
    except Exception as e:
        print(f"❌ Erro Python: {e}")
        return None

def generate_meal_plan(profile: ProfileResponse, days: int = 1):
    """
    Gera o plano alimentar (1 dia ou 7 dias).
    """
    duration_text = "UM DIA (1 dia)" if days == 1 else "UMA SEMANA (7 dias)"
    
    # Lógica de Variedade
    variety_instruction = ""
    if days > 1:
        variety_instruction = "VARIEDADE É OBRIGATÓRIA: Não repita as mesmas refeições todos os dias. Alterne as fontes de proteína e carboidrato. Não coloque todos os 'gostos' do usuário no mesmo dia."

    prompt = f"""
    Atue como um nutricionista esportivo. Crie um plano alimentar para {duration_text}.
    
    DADOS:
    - Perfil: {profile.age} anos, {profile.weight} kg, {profile.height} cm.
    - Meta Diária: {profile.daily_calories:.0f} kcal.
    - Objetivo: {profile.goal}.
    - Dieta: {profile.diet_type}.
    - Alergias (CRÍTICO): {profile.allergies or "Nenhuma"}.
    - Gosta: {profile.food_likes} (Use com moderação).
    - Odeia: {profile.food_dislikes}.
    
    {variety_instruction}
    
    Responda APENAS JSON estrito com esta estrutura:
    {{
      "days": [
        {{
          "day": "Dia 1",
          "calories_target": 2000,
          "macros": {{ "protein": "...", "carbs": "...", "fats": "..." }},
          "meals": [
            {{ "name": "Café da Manhã", "suggestion": "..." }},
            {{ "name": "Almoço", "suggestion": "..." }},
            {{ "name": "Lanche", "suggestion": "..." }},
            {{ "name": "Jantar", "suggestion": "..." }}
          ],
          "tip": "Dica do dia."
        }}
        // ... repita para os outros dias se for semanal
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