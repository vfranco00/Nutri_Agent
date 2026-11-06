from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class Consent(Base):
    """Evento de consentimento. SÓ INSERÇÃO: nunca atualize nem apague linha daqui
    (a prova do aceite é a sequência de eventos). O estado atual de uma finalidade é o
    evento mais recente dela. Some apenas junto com a conta (CASCADE)."""

    __tablename__ = "consents"
    __table_args__ = (Index("ix_consents_user_purpose", "user_id", "purpose"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    purpose: Mapped[str] = mapped_column(String(16), nullable=False)
    granted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    policy_version: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    # 'cadastro' | 'primeiro_uso' | 'perfil'
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    # SHA-256(SECRET_KEY + IP): prova de origem sem guardar o IP.
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
