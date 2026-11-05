from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


def _agora_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class WaterEntry(Base):
    """Um copo registrado. Somado por dia na leitura; nada de total persistido."""

    __tablename__ = "water_entries"
    __table_args__ = (Index("ix_water_entries_user_date", "user_id", "entry_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # NOT NULL + CASCADE: mesma regra do diário (RS-06 e exclusão de conta, RS-29).
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Data local do usuário, não timestamp (RS-09).
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    ml: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=_agora_utc)
