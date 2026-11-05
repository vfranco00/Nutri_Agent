from datetime import date, time

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base

REMINDER_KINDS = ("cafe", "almoco", "lanche", "jantar", "agua", "peso")

DEFAULT_TIMES = {
    "cafe": time(8, 0),
    "almoco": time(12, 30),
    "lanche": time(16, 0),
    "jantar": time(19, 30),
    "agua": time(10, 0),
    "peso": time(7, 30),
}

DEFAULT_TIMEZONE = "America/Sao_Paulo"


class Reminder(Base):
    """Um lembrete por (usuário, tipo). `local_time` é hora de parede no `timezone`."""

    __tablename__ = "reminders"
    __table_args__ = (UniqueConstraint("user_id", "kind", name="uq_reminders_user_kind"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    local_time: Mapped[time] = mapped_column(Time, nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default=DEFAULT_TIMEZONE)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Dia LOCAL do último envio: trava o envio duplo (ver reminder_dispatch).
    last_sent_on: Mapped[date | None] = mapped_column(Date, nullable=True)
