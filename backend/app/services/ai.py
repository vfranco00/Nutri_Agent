import httpx
import json
from sqlalchemy.orm import Session
from app.core.config import settings
from app.schemas.profile import ProfileResponse
from app.models.food_cache import FoodCache

# URL Única e Correta (A que funcionou no seu teste)
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={settings.GEMINI_API_KEY}"

def call_gemini(prompt: str):
    """Função centralizada para chamar o Google."""
    payload = { "contents": [{ "parts": [{"text": prompt}] }] }
    
    try:
        print(f"📡 Chamando IA...") # Debug
        with httpx.Client() as client:
            response = client.post(GEMINI_URL, json=payload, timeout=60.0)
            
            if response.status_code != 200:
                print(f"❌ Erro Google ({response.status_code}): {response.text}")
                return None

            data = response.json()
            
            # Extração Segura
            if 'candidates' in data and data['candidates']:
                raw_text = data['candidates'][0]['content']['parts'][0]['text']
                clean_text = raw_text.replace('```json', '').replace('```', '').strip()
                return clean_text
            else:
                print(f"⚠️ Resposta vazia da IA: {data}")
                return None

    except Exception as e:
        print(f"❌ Erro Python: {e}")
        return None

def generate_meal_plan(profile: ProfileResponse):
    """Gera o plano alimentar diário com personalização total."""
    
    # Monta strings descritivas baseadas nos campos novos
    diet_info = f"Dieta: {profile.diet_type}" if profile.diet_type else "Dieta: Sem restrições (Onívoro)"
    allergies_info = f"ALERGIAS/INTOLERÂNCIAS (PROIBIDO): {profile.allergies}" if profile.allergies else "Sem alergias"
    likes_info = f"Alimentos preferidos (tente incluir): {profile.food_likes}" if profile.food_likes else ""
    dislikes_info = f"Alimentos odiados (NÃO INCLUIR): {profile.food_dislikes}" if profile.food_dislikes else ""

    prompt = f"""
    Atue como um nutricionista esportivo de elite. Crie um plano alimentar diário altamente personalizado.
    
    DADOS DO PACIENTE:
    - Idade: {profile.age} anos, Peso: {profile.weight} kg, Altura: {profile.height} cm
    - TMB (Basal): {profile.bmr:.0f} kcal (JÁ CALCULADO)
    - Meta Calórica do Dia: {profile.daily_calories:.0f} kcal (JÁ CALCULADO COM DÉFICIT/SUPERÁVIT)
    - Objetivo: {profile.goal}
    
    PREFERÊNCIAS E RESTRIÇÕES:
    - {diet_info}
    - {allergies_info}
    - {likes_info}
    - {dislikes_info}
    
    REGRA DE OURO: Respeite RIGOROSAMENTE as alergias e exclusões.
    
    Responda APENAS um JSON estrito (sem markdown ```json) com esta estrutura:
    {{
      "calories_target": {profile.daily_calories:.0f},
      "macros": {{ "protein": "200g", "carbs": "300g", "fats": "80g" }},
      "meals": [
        {{ "name": "Café da Manhã", "suggestion": "..." }},
        {{ "name": "Almoço", "suggestion": "..." }},
        {{ "name": "Lanche", "suggestion": "..." }},
        {{ "name": "Jantar", "suggestion": "..." }}
      ],
      "tip": "Dica personalizada baseada nas restrições."
    }}
    """
    
    res = call_gemini(prompt)
    return json.loads(res) if res else None

def get_food_calories(db: Session, food_name: str, unit: str) -> float:
    """Busca calorias no Cache ou IA."""
    clean_name = food_name.lower().strip()
    
    # 1. Tenta Cache
    cached = db.query(FoodCache).filter(FoodCache.name == clean_name).first()
    if cached:
        print(f"✅ Cache Hit: {clean_name}")
        return cached.calories_per_unit

    # 2. Pergunta pra IA
    print(f"🤖 Cache Miss: Perguntando pra IA sobre {clean_name}...")
    prompt = f"""
    Responda APENAS um número (float).
    Quantas calorias (kcal) tem em exatamente 1 {unit} de {food_name}?
    Exemplo de resposta: 1.5
    """
    res_text = call_gemini(prompt)
    
    try:
        if res_text:
            calories = float(res_text)
            # 3. Salva no Cache
            new_cache = FoodCache(name=clean_name, calories_per_unit=calories, unit_type=unit)
            db.add(new_cache)
            db.commit()
            return calories
    except:
        print(f"❌ Falha ao converter resposta da IA: {res_text}")
    
    return 0.0

def generate_recipe_from_ingredients(ingredients: list[str]):
    """Cria receita criativa."""
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