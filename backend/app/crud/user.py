from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash 

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = get_password_hash(user.password)

    # is_active/is_superuser/is_verified são fixados aqui, NUNCA lidos do payload.
    # A versão anterior fazia `is_active=user.is_active`: hoje isso nem existe em
    # UserCreate (quebraria com AttributeError), mas basta alguém acrescentar o campo
    # ao schema — por conveniência, pra um formulário de admin — pra virar mass
    # assignment: o cadastro público passa a escolher o próprio estado da conta.
    # O router (routers/users.py::create_user) segue a mesma regra; esta função existe
    # como caminho alternativo e precisa ser igualmente segura por si só.
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        is_active=True,
        is_superuser=False,
        is_verified=False,
    )


    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user