from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    # TODO: Hashear a senha antes de salvar! (Faremos no próximo passo)
    fake_hashed_password = user.password + "notreallyhashed"
    
    db_user = User(
        email=user.email,
        hashed_password=fake_hashed_password,
        full_name=user.full_name,
        is_active=user.is_active
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user