from sqlalchemy.orm import Session
from app.models.profile import Profile
from app.schemas.profile import ProfileCreate

def get_profile_by_user_id(db: Session, user_id: int):
    return db.query(Profile).filter(Profile.user_id == user_id).first()

def calculate_metrics(profile_data: ProfileCreate):
    """Calcula BMR e Meta Calórica automaticamente."""
    weight = profile_data.weight
    height = profile_data.height
    age = profile_data.age
    
    # 1. Calcula BMR (Harris-Benedict Revisada)
    if profile_data.gender == 'male':
        bmr = 88.36 + (13.4 * weight) + (4.8 * height) - (5.7 * age)
    else:
        bmr = 447.6 + (9.2 * weight) + (3.1 * height) - (4.3 * age)
        
    # 2. Fator de Atividade
    activity_multipliers = {
        'sedentary': 1.2,
        'lightly_active': 1.375,
        'moderately_active': 1.55,
        'very_active': 1.725,
        'super_active': 1.9
    }
    # Se o valor vier errado, usa 1.2 como padrão
    multiplier = activity_multipliers.get(profile_data.activity_level, 1.2)
    tdee = bmr * multiplier
    
    # 3. Meta (Déficit/Superávit)
    if profile_data.goal == 'lose_weight':
        daily_calories = tdee - 500
    elif profile_data.goal == 'gain_muscle':
        daily_calories = tdee + 300
    else:
        daily_calories = tdee
        
    return bmr, round(daily_calories)

def create_or_update_profile(db: Session, profile: ProfileCreate, user_id: int):
    # 1. Calcula métricas
    bmr, daily = calculate_metrics(profile)
    
    # 2. Prepara o dicionário de dados
    # model_dump() converte o Schema do Pydantic em um dicionário Python simples
    data = profile.model_dump()
    
    # Injeta os valores calculados
    data['bmr'] = bmr
    data['daily_calories'] = daily
    
    # 3. Busca perfil existente
    db_profile = get_profile_by_user_id(db, user_id)
    
    if db_profile:
        # ATUALIZAÇÃO DINÂMICA (Aqui estava o problema antes!)
        # Percorre todos os campos do JSON e atualiza no objeto do banco
        for key, value in data.items():
            setattr(db_profile, key, value)
    else:
        # CRIAÇÃO
        # O **data desenrola o dicionário para criar o objeto
        db_profile = Profile(**data, user_id=user_id)
        db.add(db_profile)
    
    db.commit()
    db.refresh(db_profile)
    return db_profile