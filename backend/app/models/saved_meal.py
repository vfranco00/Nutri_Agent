from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class SavedMeal(Base):
    """Refeição pronta: um conjunto nomeado de itens que o usuário registra de uma vez."""

    __tablename__ = "saved_meals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # NOT NULL e CASCADE pelos mesmos motivos de diary_entries (RS-06, RS-29).
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    items = relationship(
        "SavedMealItem",
        cascade="all, delete-orphan",
        order_by="SavedMealItem.position",
    )


class SavedMealItem(Base):
    """Snapshot por item (mesmos campos da entrada do diário): registrar a refeição não
    depende de o `food_ref` ainda resolver."""

    __tablename__ = "saved_meal_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    saved_meal_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("saved_meals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    food_ref: Mapped[str] = mapped_column(String(180), nullable=False)
    food_name: Mapped[str] = mapped_column(String(120), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    base_unit: Mapped[str] = mapped_column(String(4), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(16), nullable=False)
    kcal_per_base_unit: Mapped[float] = mapped_column(Float, nullable=False)
    protein_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
