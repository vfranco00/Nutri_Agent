"""alimento pessoal (user_foods) — Frente R da Fase 1 Nuvi

Tabela nova, sem tocar em nenhuma existente. Downgrade apaga os alimentos pessoais dos
usuários (as entradas do diário que os usaram continuam: são snapshot).

Revision ID: e7b2c4a91f30
Revises: d5a3e7c1b204
Create Date: 2026-11-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e7b2c4a91f30'
down_revision: Union[str, Sequence[str], None] = 'd5a3e7c1b204'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_foods',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('portion_label', sa.String(length=60), nullable=False),
        sa.Column('portion_grams', sa.Float(), nullable=True),
        sa.Column('kcal', sa.Float(), nullable=False),
        sa.Column('protein_g', sa.Float(), nullable=True),
        sa.Column('carbs_g', sa.Float(), nullable=True),
        sa.Column('fat_g', sa.Float(), nullable=True),
        sa.Column('barcode', sa.String(length=14), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'barcode', name='uq_user_foods_user_barcode'),
    )
    op.create_index('ix_user_foods_user_id', 'user_foods', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_user_foods_user_id', table_name='user_foods')
    op.drop_table('user_foods')
