from sqlalchemy import Integer, String, Float
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

class FoodCache(Base):
    __tablename__ = "food_cache"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False) # Ex: "Peito de Frango Grelhado"
    calories_per_unit: Mapped[float] = mapped_column(Float, nullable=False) # Kcal por 1g ou 1 unidade
    unit_type: Mapped[str] = mapped_column(String, nullable=False) # "g", "ml", "un"