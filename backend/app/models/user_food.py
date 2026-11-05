from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class UserFood(Base):
    """Alimento pessoal do usuário. `food_ref` = `mine:<id>`, sempre restrito ao dono.

    Valores POR PORÇÃO, não por grama: é como a pessoa lê o rótulo ("1 pote = 150 kcal").
    No diário vira `base_unit = "un"` e `quantity` = número de porções. `portion_grams`
    é só informativo — nenhuma conta depende dele.

    A entrada do diário guarda snapshot (ADR-0001 § 4.4): editar ou apagar este alimento
    não reescreve o que já foi registrado.
    """

    __tablename__ = "user_foods"

    # O mesmo código de barras pode existir em contas diferentes (é o produto que as duas
    # compram), mas não duas vezes na mesma: a busca por código precisa de resposta única.
    # NULL não colide com NULL em unique, nos dois bancos — alimento sem código é livre.
    __table_args__ = (
        UniqueConstraint("user_id", "barcode", name="uq_user_foods_user_barcode"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # NOT NULL e CASCADE pelos mesmos motivos de diary_entries (RS-06, RS-29).
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    portion_label: Mapped[str] = mapped_column(String(60), nullable=False)
    portion_grams: Mapped[float | None] = mapped_column(Float, nullable=True)
    kcal: Mapped[float] = mapped_column(Float, nullable=False)
    # None = o usuário não informou. NÃO é zero (§ 9.4).
    protein_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_g: Mapped[float | None] = mapped_column(Float, nullable=True)
    barcode: Mapped[str | None] = mapped_column(String(14), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
