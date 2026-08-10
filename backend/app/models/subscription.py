from sqlalchemy import Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base_class import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)

    # "starter" | "plus" | "pro"
    plan: Mapped[str] = mapped_column(String, nullable=False, default="starter")
    # "active" | "canceled" | "past_due"
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")

    mp_subscription_id: Mapped[str] = mapped_column(String, nullable=True)
    current_period_end: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    # Marca quando o email de "assinatura vencendo" foi mandado — evita reenviar
    # todo dia dentro da janela de aviso. Resetado a cada renovação de current_period_end.
    expiry_warned_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="subscription")


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # "chef_ai" | "generate_plan_weekly" | "generate_plan_daily" | "generate_plan_starter"
    event_type: Mapped[str] = mapped_column(String, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")
