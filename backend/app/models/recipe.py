from sqlalchemy import Integer, String, Float, Text, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    title: Mapped[str] = mapped_column(String, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    instructions: Mapped[str] = mapped_column(Text)
    prep_time: Mapped[int] = mapped_column(Integer, nullable=True)
    calories: Mapped[float] = mapped_column(Float, nullable=True)
    
    preparation_method: Mapped[str] = mapped_column(String, nullable=True, default="fogao")
    category: Mapped[str] = mapped_column(String, nullable=True, default="almoco")
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # --- FEATURES NOVAS ---
    is_new: Mapped[bool] = mapped_column(Boolean, default=True) 
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    # Mudamos de 'user' para 'creator' para bater com o que o model User espera
    creator = relationship("User", back_populates="recipes")
    
    ingredients = relationship("Ingredient", back_populates="recipe", cascade="all, delete-orphan")

    # Marcação se a receita foi gerada por IA
    is_ai: Mapped[bool] = mapped_column(Boolean, default=False)