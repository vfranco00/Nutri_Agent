from sqlalchemy import Integer, String, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), nullable=False)
    
    name: Mapped[str] = mapped_column(String, index=True, nullable=False) # ex: Ovos
    quantity: Mapped[float] = mapped_column(Float, nullable=False) # ex: 2.0
    unit: Mapped[str] = mapped_column(String, nullable=False) # ex: unidades, gramas, xícaras

    calories: Mapped[float] = mapped_column(Float, nullable=True, default=0.0)
    
    # Relacionamento
    recipe = relationship("Recipe", back_populates="ingredients")