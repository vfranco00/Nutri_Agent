from sqlalchemy import Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class FoodCatalog(Base):
    """Catálogo curado que `GET /diary/foods/search` lê — e a ÚNICA fonte dessa busca.

    A tabela `food_cache` não é fonte de leitura de nenhum endpoint de busca (RS-13):
    `food_cache.name` guarda a string crua que um usuário digitou, e nome de alimento
    identifica suplemento oncológico, fórmula infantil, produto ritual. Ler dali numa
    rota de autocomplete vazaria dado de saúde de terceiro sem nenhum controle de
    acesso quebrado — o endpoint estaria funcionando exatamente como escrito.
    """

    __tablename__ = "food_catalog"

    # Nomeados no ADR-0001 § 4.2. Não existe btree em `name_normalized` sozinho de
    # propósito: `uq_food_catalog_name_unit` já atende a igualdade pela coluna líder, e
    # a busca é ILIKE '%termo%' — curinga à esquerda, nenhum btree é usável. Com ~96
    # linhas o seq scan é livre; se o catálogo passar de alguns milhares, a resposta é
    # pg_trgm + GIN, não um btree inútil.
    __table_args__ = (
        Index("uq_food_catalog_slug", "slug", unique=True),
        Index("uq_food_catalog_name_unit", "name_normalized", "base_unit", unique=True),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # Metade do food_ref ("catalog:<slug>"). Estável — é chave externa de verdade.
    slug: Mapped[str] = mapped_column(String(160), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    name_normalized: Mapped[str] = mapped_column(String(120), nullable=False)
    base_unit: Mapped[str] = mapped_column(String(4), nullable=False)  # "g" | "ml" | "un"

    # Por UNIDADE BASE (1 g, 1 ml ou 1 unidade), nunca por 100 — § 4.0 do ADR-0001.
    # A divisão por 100 acontece uma única vez, no seeder.
    kcal_per_base_unit: Mapped[float] = mapped_column(Float, nullable=False)

    # DIVERGÊNCIA DELIBERADA do § 4.2 do ADR-0001, que pede os macros NOT NULL.
    # O § 4.2 fundamenta o NOT NULL em "a curadoria é nossa": vale quando os macros vêm
    # conferidos da publicação oficial. Este dataset saiu `UNVERIFIED` (ver o topo de
    # `data/taco_foods.py`) e tem itens sem macro publicado — granola, pipoca, Rap10.
    # Com NOT NULL, as duas saídas seriam gravar 0.0 (afirmar "não tem proteína", que é
    # exatamente o que o § 9.4 proíbe) ou excluir o item de TACO_FOODS (que quebraria
    # TACO_PER_100G/TACO_PER_UNIT e, com eles, services/ai.py e a suíte). Nullable é a
    # única opção que não mente nem quebra contrato.
    # Ao conferir os macros contra a TACO oficial, reavaliar o NOT NULL.
    protein_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    carbs_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)
    fat_per_base_unit: Mapped[float | None] = mapped_column(Float, nullable=True)

    dataset_version: Mapped[str] = mapped_column(String(32), nullable=False)
