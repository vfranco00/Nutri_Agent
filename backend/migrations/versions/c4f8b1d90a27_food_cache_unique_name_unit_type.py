"""food_cache: unique passa de (name) para (name, unit_type)

A leitura do cache em services/ai.py sempre foi por name + unit_type, mas o unique
estava só em name. Consequência: o segundo registro do mesmo alimento em outra unidade
("ovo" em "g" e depois "ovo" em "un") violava o unique, o `except Exception` do serviço
engolia e dava rollback — aquele par nunca era cacheado e ia pro Gemini em toda consulta.

Não há limpeza de dados a fazer: como `name` era único sozinho, não existe nenhuma
duplicata de (name, unit_type). A constraint nova é estritamente mais permissiva que a
antiga, então a migração não pode falhar por dado pré-existente.

Revision ID: c4f8b1d90a27
Revises: 7a1f2c9d4e60
Create Date: 2026-08-10

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c4f8b1d90a27'
down_revision: Union[str, Sequence[str], None] = '7a1f2c9d4e60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # O unique antigo era um índice único (criado em 8181e96ae511 como
    # create_index(..., unique=True)), não uma constraint nomeada.
    op.drop_index('ix_food_cache_name', table_name='food_cache')

    # Recriado sem unique: a busca por nome continua indexada.
    op.create_index('ix_food_cache_name', 'food_cache', ['name'], unique=False)

    op.create_unique_constraint(
        'uq_food_cache_name_unit_type', 'food_cache', ['name', 'unit_type']
    )


def downgrade() -> None:
    op.drop_constraint('uq_food_cache_name_unit_type', 'food_cache', type_='unique')
    op.drop_index('ix_food_cache_name', table_name='food_cache')

    # ATENÇÃO: voltar ao unique só em `name` falha se o cache já tiver o mesmo alimento
    # em mais de uma unidade — que é exatamente o que esta migration passou a permitir.
    # Nesse caso é preciso decidir qual linha manter antes de descer.
    op.create_index('ix_food_cache_name', 'food_cache', ['name'], unique=True)
