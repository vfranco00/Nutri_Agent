from sqlalchemy import Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base


class Payment(Base):
    """Registro de cada cobrança confirmada pelo Mercado Pago (tópico de webhook
    subscription_authorized_payment — uma por ciclo de cobrança, não por assinatura).
    mp_payment_id é único pra suportar reenvio de webhook sem duplicar "venda"."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    mp_payment_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)

    plan: Mapped[str] = mapped_column(String, nullable=False)
    amount_brl: Mapped[float] = mapped_column(Float, nullable=False)
    # "approved" | "rejected" | "pending" | outro status vindo direto do Mercado Pago
    status: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")
