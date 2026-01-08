from sqlalchemy import Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)

    # RELACIONAMENTOS (Isso corrige os erros de Mapper)
    
    # 1. Perfil (Um para Um)
    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    # 2. Histórico de Peso (Um para Muitos) - CORREÇÃO AQUI
    weight_history = relationship("WeightHistory", back_populates="user", cascade="all, delete-orphan")
    
    # 3. Receitas (Um para Muitos) - Atenção ao nome 'creator'
    recipes = relationship("Recipe", back_populates="creator", cascade="all, delete-orphan")
    
    # 4. Lista de Compras (Um para Muitos)
    shopping_lists = relationship("ShoppingList", back_populates="user", cascade="all, delete-orphan")

    # 5. Pontuação de Usuário (User Score)
    score: Mapped[int] = mapped_column(Integer, default=0)