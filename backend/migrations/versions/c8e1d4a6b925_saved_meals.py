"""refeições prontas (saved_meals e saved_meal_items) — Frente R da Fase 1 Nuvi

Tabelas novas, sem tocar em nenhuma existente. Downgrade apaga as refeições prontas.

Revision ID: c8e1d4a6b925
Revises: f3c9a5d7b218
Create Date: 2026-11-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c8e1d4a6b925'
down_revision: Union[str, Sequence[str], None] = 'f3c9a5d7b218'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'saved_meals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=80), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_saved_meals_user_id', 'saved_meals', ['user_id'])
    op.create_table(
        'saved_meal_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('saved_meal_id', sa.Integer(),
                  sa.ForeignKey('saved_meals.id', ondelete='CASCADE'), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('food_ref', sa.String(length=180), nullable=False),
        sa.Column('food_name', sa.String(length=120), nullable=False),
        sa.Column('source', sa.String(length=16), nullable=False),
        sa.Column('base_unit', sa.String(length=4), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(length=16), nullable=False),
        sa.Column('kcal_per_base_unit', sa.Float(), nullable=False),
        sa.Column('protein_per_base_unit', sa.Float(), nullable=True),
        sa.Column('carbs_per_base_unit', sa.Float(), nullable=True),
        sa.Column('fat_per_base_unit', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_saved_meal_items_saved_meal_id', 'saved_meal_items', ['saved_meal_id'])


def downgrade() -> None:
    op.drop_index('ix_saved_meal_items_saved_meal_id', table_name='saved_meal_items')
    op.drop_table('saved_meal_items')
    op.drop_index('ix_saved_meals_user_id', table_name='saved_meals')
    op.drop_table('saved_meals')
