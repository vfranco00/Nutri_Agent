from sqlalchemy import Integer, String, Text, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    
    title: Mapped[str] = mapped_column(String, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    instructions: Mapped[str] = mapped_column(Text, nullable=False)
    
    prep_time: Mapped[int] = mapped_column(Integer, nullable=True) # minutos
    calories: Mapped[float] = mapped_column(Float, nullable=True) # Kcal
    
    # Saber quem criou/gerou a receita
    creator = relationship("User", back_populates="recipes")

    # Ingredientes da receita
    ingredients = relationship("Ingredient", back_populates="recipe", cascade="all, delete-orphan")