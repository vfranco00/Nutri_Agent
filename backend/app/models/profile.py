from sqlalchemy import Integer, Float, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False) # kg
    height: Mapped[float] = mapped_column(Float, nullable=False) # cm
    gender: Mapped[str] = mapped_column(String, nullable=False)  # H/M
    
    # Vamos salvar como string (ex: "sedentary", "active") e validar no Pydantic
    activity_level: Mapped[str] = mapped_column(String, nullable=False)
    goal: Mapped[str] = mapped_column(String, nullable=False)

    bmr: Mapped[float] = mapped_column(Float, nullable=True) # Taxa Metabólica Basal
    daily_calories: Mapped[float] = mapped_column(Float, nullable=True) # Calorias Diárias Recomendadas

    # Relacionamento com a tabela User
    user = relationship("User", back_populates="profile")