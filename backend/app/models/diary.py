from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


class DiaryEntry(Base):
    """Uma linha do diário. É o FATO (o que foi comido), não a intenção.

    Não há FK para `meal_plan_meals`: comer o que estava planejado e comer outra coisa
    produzem a mesma linha (§ 3.2 do ADR-0001). O cruzamento com o cardápio acontece na
    leitura, por data e por slot.
    """

    __tablename__ = "diary_entries"

    # (user_id, entry_date) é a chave de leitura real da tela e é exigido nominalmente
    # pelo RS-06. Serve GET /diary?date=, o range scan do /summary, a contagem do teto do
    # RS-11 e o CASCADE da exclusão de conta pela coluna líder.
    # NÃO existe (user_id, entry_date, meal_slot): meal_slot tem 6 valores e o dia inteiro
    # cabe em 60 linhas — um terceiro nível só engordaria o INSERT.
    __table_args__ = (Index("ix_diary_entries_user_date", "user_id", "entry_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # NOT NULL é requisito de segurança, não higiene (RS-06): uma linha órfã escapa de
    # TODO filtro `user_id == X` — fica invisível pro dono e inalcançável pela exclusão
    # de conta. CASCADE fecha o direito de eliminação da LGPD (RS-29).
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Data local do usuário, não timestamp (RS-09).
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    meal_slot: Mapped[str] = mapped_column(String(16), nullable=False)

    # "catalog:<slug>" ou "cache:<id>". Referência FRACA, sem FK: só rastro de auditoria
    # ("de onde veio este número"). Nenhuma leitura de tela depende de ele resolver.
    food_ref: Mapped[str] = mapped_column(String(180), nullable=False)
    food_name: Mapped[str] = mapped_column(String(120), nullable=False)
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    base_unit: Mapped[str] = mapped_column(String(4), nullable=False)

    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(16), nullable=False)

    # SNAPSHOT dos valores nutricionais, e não FK, por três razões de correção:
    # (1) corrigir o azeite no catálogo amanhã não pode reescrever o total de terça
    # passada; (2) linhas llm/openfoodfacts expiram em 90 dias e uma FK CASCADE levaria
    # o registro do usuário junto; (3) o PATCH recalcula a partir da própria linha —
    # sem query, sem rede, sem chance de o valor mudar entre criar e editar.
    kcal_per_base_unit: Mapped[float] = mapped_column(Float, nullable=False)
    protein_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Derivados e persistidos. RS-10: calculados no servidor, NUNCA recebidos do cliente.
    calories_total: Mapped[float] = mapped_column(Float, nullable=False)
    # None = macro desconhecido para este alimento. NÃO é zero (§ 9.4).
    protein_g_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_g_total: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_g_total: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class DiaryPlanBinding(Base):
    """Vínculo cardápio↔calendário: "este cardápio vale a partir de tal dia, e cicla".

    Existe para o cardápio continuar sendo TEMPLATE (sem data) e ainda assim "o planejado
    do dia D" ter resposta única. Sem constraint de não sobreposição: EXCLUDE exige
    btree_gist e não existe em SQLite, onde a suíte inteira roda. O desempate é
    determinístico e testável — `start_date DESC, id DESC` (§ 4.5, § 6.9).
    """

    __tablename__ = "diary_plan_bindings"

    __table_args__ = (
        Index("ix_diary_plan_bindings_user_start", "user_id", "start_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Apagar o cardápio desfaz o vínculo, sem linha pendurada apontando pro nada.
    meal_plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("meal_plans.id", ondelete="CASCADE"), nullable=False
    )
    # Data de calendário que corresponde a day_index = 0.
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    # None = sem fim; o plano cicla indefinidamente.
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    meal_plan = relationship("MealPlan")
