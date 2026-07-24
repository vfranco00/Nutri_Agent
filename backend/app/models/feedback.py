from sqlalchemy import Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db.base import Base


class FeedbackTicket(Base):
    """Registro persistido de cada chamado de ajuda/feedback — o email pro Franco
    (services/email.py::send_feedback_email) é só um aviso best-effort em cima disso;
    se o envio falhar, o chamado continua existindo aqui e visível no painel admin.
    user_id é resolvido por email no momento do envio, fica nulo se ninguém com esse
    email tem conta (ex: visitante da landing page sem cadastro)."""

    __tablename__ = "feedback_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    name: Mapped[str] = mapped_column(String, nullable=True)
    email: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)

    # Status de atendimento — "aberto" (default) ou "resolvido". resolved_at guarda
    # quando foi resolvido (nulo enquanto aberto), pra dar tempo de resposta no painel.
    status: Mapped[str] = mapped_column(String, nullable=False, default="aberto", server_default="aberto", index=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")
