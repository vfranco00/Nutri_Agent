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