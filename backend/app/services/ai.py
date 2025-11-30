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

def generate_meal_plan(profile: ProfileResponse, days: int = 1, variety_mode: str = "varied"):
    """
    Gera o plano alimentar com controle de variedade.
    variety_mode: 'varied' (muita variedade) ou 'repetitive' (meal prep/prático).
    """
    
    # Lógica de Variedade
    variety_instruction = ""
    if days > 1:
        if variety_mode == "repetitive":
            variety_instruction = """
            ESTRATÉGIA DE PRATICIDADE (MEAL PREP):
            - O usuário prefere cozinhar pouco e repetir as refeições.
            - Mantenha o MESMO Café da Manhã e Lanches todos os dias.
            - Alterne no máximo entre 2 opções de Almoço/Jantar durante a semana.
            - Foco em ingredientes que podem ser feitos em grande quantidade.
            """
        else:
            variety_instruction = """
            ESTRATÉGIA DE VARIEDADE TOTAL:
            - O usuário odeia rotina.
            - Crie refeições DIFERENTES para cada dia.
            - Explore diferentes texturas e sabores.
            - Não repita o prato principal em dias seguidos.
            """

    prompt = f"""
    Atue como um nutricionista esportivo. Crie um plano alimentar para {days} dias.
    
    DADOS:
    - Perfil: {profile.age} anos, {profile.weight} kg, {profile.height} cm.
    - Meta Diária: {profile.daily_calories:.0f} kcal.
    - Objetivo: {profile.goal}.
    - Dieta: {profile.diet_type}.
    - Alergias (CRÍTICO): {profile.allergies or "Nenhuma"}.
    - Gosta: {profile.food_likes}.
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
          "tip": "Dica específica."
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