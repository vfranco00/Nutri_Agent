from sqlalchemy import Integer, String, Float, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base_class import Base

class FoodCache(Base):
    __tablename__ = "food_cache"

    # A chave de leitura em services/ai.py é (name, unit_type) — o unique tem que ser o
    # mesmo par. Enquanto `name` era único sozinho, cachear "ovo" em "g" impedia cachear
    # "ovo" em "un": o INSERT violava o unique, o `except Exception` do serviço engolia o
    # erro e dava rollback em silêncio. Efeito: aquele alimento nunca mais era cacheado
    # naquela unidade e ia pro Gemini em toda consulta, para sempre — um cache que não
    # falha ruidosamente, só degrada em custo invisível.
    __table_args__ = (
        UniqueConstraint("name", "unit_type", name="uq_food_cache_name_unit_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True, nullable=False) # Ex: "Peito de Frango Grelhado"
    calories_per_unit: Mapped[float] = mapped_column(Float, nullable=False) # Kcal por 1g ou 1 unidade
    unit_type: Mapped[str] = mapped_column(String, nullable=False) # "g", "ml", "un"