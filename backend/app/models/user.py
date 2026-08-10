from datetime import datetime

from sqlalchemy import Integer, String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base_class import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    has_seen_onboarding: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=True)
    last_login_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # RELACIONAMENTOS (Isso corrige os erros de Mapper)
    
    # 1. Perfil (Um para Um)
    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    # 2. Histórico de Peso (Um para Muitos) - CORREÇÃO AQUI
    weight_history = relationship("WeightHistory", back_populates="user", cascade="all, delete-orphan")
    
    # 3. Receitas (Um para Muitos) - Atenção ao nome 'creator'
    recipes = relationship("Recipe", back_populates="creator", cascade="all, delete-orphan")
    
    # 4. Lista de Compras (Um para Muitos)
    shopping_lists = relationship("ShoppingList", back_populates="user", cascade="all, delete-orphan")

    # 5. Assinatura (Um para Um)
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")

    # 6. Pontuação de Usuário (User Score)
    score: Mapped[int] = mapped_column(Integer, default=0)

    @property
    def has_profile(self) -> bool:
        """Usado pelo onboarding no frontend pra saber se é a primeira vez do usuário."""
        return self.profile is not None

    @property
    def plan(self) -> str:
        """Usado na listagem do admin — usuário sem Subscription ainda conta como starter."""
        return self.subscription.plan if self.subscription else "starter"