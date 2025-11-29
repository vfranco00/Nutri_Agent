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
    """Gera o plano alimentar diário com inteligência nutricional ajustada."""
    
    diet_info = f"Dieta: {profile.diet_type}" if profile.diet_type else "Dieta: Sem restrições"
    likes_info = f"Gosta de: {profile.food_likes}" if profile.food_likes else ""
    # Adicionamos uma instrução explícita sobre adaptação
    likes_instruction = "Tente incluir os gostos do usuário, MAS ADAPTE PARA VERSÕES SAUDÁVEIS se o objetivo for perder peso (ex: Hambúrguer -> Hambúrguer caseiro magro sem pão)."
    
    prompt = f"""
    Atue como um nutricionista esportivo rigoroso. Crie um plano alimentar diário.
    
    DADOS:
    - Perfil: {profile.age} anos, {profile.weight} kg, {profile.height} cm.
    - Meta Calculada: {profile.daily_calories:.0f} kcal (NÃO ULTRAPASSE ESTE VALOR).
    - Objetivo: {profile.goal} (Se for 'lose_weight', foque em volume e baixa caloria).
    
    PREFERÊNCIAS:
    - {diet_info}
    - Alergias (CRÍTICO): {profile.allergies or "Nenhuma"}
    - {likes_info}
    - Odeia: {profile.food_dislikes or "Nada"}
    
    DIRETRIZES:
    1. {likes_instruction}
    2. Respeite as alergias acima de tudo.
    3. Distribua as calorias e macros de forma equilibrada.
    
    Responda APENAS JSON estrito:
    {{
      "calories_target": {profile.daily_calories:.0f},
      "macros": {{ "protein": "...", "carbs": "...", "fats": "..." }},
      "meals": [
        {{ "name": "Café da Manhã", "suggestion": "Descrição detalhada do prato..." }},
        {{ "name": "Almoço", "suggestion": "Descrição detalhada..." }},
        {{ "name": "Lanche", "suggestion": "..." }},
        {{ "name": "Jantar", "suggestion": "..." }}
      ],
      "tip": "Dica sobre como encaixar os gostos na dieta."
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