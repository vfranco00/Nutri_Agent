from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class FoodCache(Base):
    """Memória de cálculo de valor nutricional, PARTICIONADA POR PROCEDÊNCIA (RS-17).

    A chave de leitura em services/ai.py sempre foi (name, unit_type). O unique antigo
    `uq_food_cache_name_unit_type` foi substituído pelos dois índices parciais abaixo —
    não por gosto, mas porque com o escopo do RS-17 dois usuários resolvendo o mesmo
    nome via LLM colidiriam num unique global.

    A partição existe porque a tabela não tinha procedência: uma linha vinda da Open Food
    Facts — base wiki, editável por qualquer pessoa do mundo — era indistinguível de uma
    linha vinda da TACO, e era servida a todos os usuários (achado A-3, Alto). Agora:
    `taco`/`curated` são determinísticos e compartilhados; `openfoodfacts`/`llm` são
    estimativas isoladas por `created_by_user_id`.
    """

    __tablename__ = "food_cache"

    __table_args__ = (
        # Deduplicação global das linhas confiáveis. PARCIAL porque, num UNIQUE comum,
        # NULL != NULL no Postgres e a dedupe simplesmente não aconteceria.
        Index(
            "uq_food_cache_shared",
            "name_normalized",
            "unit_type",
            "source",
            unique=True,
            postgresql_where=text("created_by_user_id IS NULL"),
            sqlite_where=text("created_by_user_id IS NULL"),
        ),
        # Uma linha por (alimento, unidade, fonte, dono). É o que impede que RS-19 e
        # RS-17 se atropelem.
        Index(
            "uq_food_cache_private",
            "name_normalized",
            "unit_type",
            "source",
            "created_by_user_id",
            unique=True,
            postgresql_where=text("created_by_user_id IS NOT NULL"),
            sqlite_where=text("created_by_user_id IS NOT NULL"),
        ),
        # A leitura do RS-17: as duas colunas líderes cortam quase tudo e o OR de escopo
        # avalia sobre um punhado de linhas.
        Index("ix_food_cache_lookup", "name_normalized", "unit_type"),
        # Job de retenção (§ 8.4): sem ele o expurgo é seq scan na tabela que mais cresce.
        Index("ix_food_cache_retention", "source", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True, nullable=False)  # rótulo de exibição
    # RS-19: a chave REAL de leitura. Sem ela, "Ovo", "ovo", "OVO" e " ovo " são quatro
    # linhas para o mesmo alimento — quatro misses do caminho pago, e um espaço de escrita
    # limitado só pela criatividade em variar caixa e espaço.
    name_normalized: Mapped[str] = mapped_column(String(120), nullable=False)
    # calories_per_unit NÃO é renomeada para kcal_per_base_unit: já significa exatamente
    # isso, e renomear coluna em SQLite via batch_alter_table custa recriação de tabela
    # por ganho cosmético. A API expõe o nome novo; o banco mantém o antigo.
    calories_per_unit: Mapped[float] = mapped_column(Float, nullable=False)
    unit_type: Mapped[str] = mapped_column(String, nullable=False)  # "g", "ml", "un"

    # "taco" | "curated" | "openfoodfacts" | "llm". Validado no Pydantic, não no banco:
    # o projeto não usa Enum nativo em lugar nenhum e CHECK não é alterável em SQLite.
    source: Mapped[str] = mapped_column(String(16), nullable=False)
    # NULL = linha compartilhada. ondelete=SET NULL e não CASCADE por causa do RS-29: a
    # linha é anonimizada, não apagada.
    #
    # ATENÇÃO: o SET NULL TEM que vir acompanhado do expurgo do § 8.4 — com
    # created_by_user_id = NULL a linha passa a casar o índice parcial COMPARTILHADO e
    # ficaria visível a todos. Sem esse par, o RS-29 vira vazamento.
    created_by_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    # None = a fonte não informou o macro. NÃO é zero (§ 9.4).
    protein_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)

    # RS-21: torna um valor ruim da Open Food Facts rastreável e removível em lote.
    off_product_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
