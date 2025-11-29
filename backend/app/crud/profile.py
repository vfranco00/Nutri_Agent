from sqlalchemy.orm import Session
from app.models.profile import Profile
from app.schemas.profile import ProfileCreate

def get_profile_by_user_id(db: Session, user_id: int):
    return db.query(Profile).filter(Profile.user_id == user_id).first()

def create_or_update_profile(db: Session, profile: ProfileCreate, user_id: int):
    # Já existe
    db_profile = get_profile_by_user_id(db, user_id)
    
    if db_profile:
        # Atualiza campos
        db_profile.age = profile.age
        db_profile.weight = profile.weight
        db_profile.height = profile.height
        db_profile.gender = profile.gender
        db_profile.activity_level = profile.activity_level
        db_profile.goal = profile.goal
    else:
        # Cria novo
        db_profile = Profile(**profile.model_dump(), user_id=user_id)
        db.add(db_profile)
    
    db.commit()
    db.refresh(db_profile)
    return db_profile


def calculate_metrics(profile_data):
    # 1. Calcula BMR (Harris-Benedict Revisada)
    # Homens: 88.36 + (13.4 x peso) + (4.8 x altura) - (5.7 x idade)
    # Mulheres: 447.6 + (9.2 x peso) + (3.1 x altura) - (4.3 x idade)
    
    weight = profile_data.weight
    height = profile_data.height
    age = profile_data.age
    
    if profile_data.gender == 'male':
        bmr = 88.36 + (13.4 * weight) + (4.8 * height) - (5.7 * age)
    else:
        bmr = 447.6 + (9.2 * weight) + (3.1 * height) - (4.3 * age)
        
    # 2. Calcula Gasto Total (TDEE) baseado na atividade
    activity_multipliers = {
        'sedentary': 1.2,
        'lightly_active': 1.375,
        'moderately_active': 1.55,
        'very_active': 1.725,
        'super_active': 1.9
    }
    tdee = bmr * activity_multipliers.get(profile_data.activity_level, 1.2)
    
    # 3. Aplica o Objetivo (Déficit ou Superávit)
    if profile_data.goal == 'lose_weight':
        daily_calories = tdee - 500 # Déficit padrão
    elif profile_data.goal == 'gain_muscle':
        daily_calories = tdee + 300 # Superávit leve
    else:
        daily_calories = tdee
        
    return bmr, round(daily_calories)