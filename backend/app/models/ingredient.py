from sqlalchemy import Integer, String, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), nullable=False)
    
    name: Mapped[str] = mapped_column(String)
    quantity: Mapped[float] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String)
    calories: Mapped[float] = mapped_column(Float, nullable=True)

    # Relação com Receita
    recipe = relationship("Recipe", back_populates="ingredients")