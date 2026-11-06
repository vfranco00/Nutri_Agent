"""food_cache: tamanho da embalagem e da porção (lata de 473 ml) e reinício das leituras da OFF

Revision ID: d4a8f1c6b305
Revises: c3f7e9a1d523
Create Date: 2026-11-06

As linhas `openfoodfacts` gravadas antes desta versão têm kcal/macros errados e unidade
sempre em g (bebida lida como sólido). Elas não são apagadas: o serviço de código de
barras só aceita a chave `barcode:v2:<código>` e reescreve a linha antiga no lugar (mesmo
`id`) na próxima leitura.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd4a8f1c6b305'
down_revision: Union[str, Sequence[str], None] = 'c3f7e9a1d523'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('food_cache', sa.Column('package_quantity', sa.Float(), nullable=True))
    op.add_column('food_cache', sa.Column('serving_quantity', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('food_cache', 'serving_quantity')
    op.drop_column('food_cache', 'package_quantity')
