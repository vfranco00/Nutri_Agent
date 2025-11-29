import httpx
import json
from app.core.config import settings
from app.schemas.profile import ProfileResponse

def generate_meal_plan(profile: ProfileResponse):
    """
    Gera plano alimentar usando o modelo disponível na sua lista: gemini-flash-latest
    """
    
    # URL EXATA baseada no seu log
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={settings.GEMINI_API_KEY}"
    
    # Prompt (Mantivemos o mesmo, pois é bom)
    prompt_text = f"""
    Atue como um nutricionista esportivo. Crie um plano alimentar diário para:
    - Idade: {profile.age} anos, Peso: {profile.weight} kg, Altura: {profile.height} cm
    - Objetivo: {profile.goal}
    
    Responda APENAS um JSON estrito (sem markdown ```json) com esta estrutura:
    {{
      "calories_target": 2500,
      "macros": {{ "protein": "200g", "carbs": "300g", "fats": "80g" }},
      "meals": [
        {{ "name": "Café da Manhã", "suggestion": "Ovos e aveia..." }},
        {{ "name": "Almoço", "suggestion": "Frango e salada..." }},
        {{ "name": "Jantar", "suggestion": "Peixe e legumes..." }}
      ],
      "tip": "Dica rápida."
    }}
    """

    payload = {
        "contents": [{
            "parts": [{"text": prompt_text}]
        }]
    }

    try:
        print(f"📡 Conectando no modelo: gemini-flash-latest") 

        with httpx.Client() as client:
            response = client.post(url, json=payload, timeout=60.0)
            
            if response.status_code != 200:
                print(f"❌ Erro Google ({response.status_code}): {response.text}")
                return None

            data = response.json()
            
            # Extração segura
            try:
                raw_text = data['candidates'][0]['content']['parts'][0]['text']
                clean_text = raw_text.replace('```json', '').replace('```', '').strip()
                print("✅ Sucesso! JSON gerado.")
                return json.loads(clean_text)
            except Exception as e:
                print(f"❌ Erro ao ler resposta: {data}")
                return None

    except Exception as e:
        print(f"❌ Erro Python: {e}")
        return None