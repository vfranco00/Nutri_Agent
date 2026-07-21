"""add_meal_plans

Revision ID: 37ac714180f6
Revises: fab0b243cff8
Create Date: 2026-07-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '37ac714180f6'
down_revision: Union[str, Sequence[str], None] = 'fab0b243cff8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('meal_plans',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(), nullable=False),
    sa.Column('source', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_meal_plans_id'), 'meal_plans', ['id'], unique=False)

    op.create_table('meal_plan_days',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('meal_plan_id', sa.Integer(), nullable=False),
    sa.Column('day_label', sa.String(), nullable=False),
    sa.Column('day_index', sa.Integer(), nullable=False),
    sa.Column('calories_target', sa.Float(), nullable=True),
    sa.Column('macros_protein', sa.String(), nullable=True),
    sa.Column('macros_carbs', sa.String(), nullable=True),
    sa.Column('macros_fats', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['meal_plan_id'], ['meal_plans.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_meal_plan_days_id'), 'meal_plan_days', ['id'], unique=False)

    op.create_table('meal_plan_meals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('meal_plan_day_id', sa.Integer(), nullable=False),
    sa.Column('slot_name', sa.String(), nullable=False),
    sa.Column('recipe_id', sa.Integer(), nullable=True),
    sa.Column('custom_title', sa.String(), nullable=True),
    sa.Column('custom_description', sa.Text(), nullable=True),
    sa.Column('calories', sa.Float(), nullable=True),
    sa.ForeignKeyConstraint(['meal_plan_day_id'], ['meal_plan_days.id'], ),
    sa.ForeignKeyConstraint(['recipe_id'], ['recipes.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_meal_plan_meals_id'), 'meal_plan_meals', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_meal_plan_meals_id'), table_name='meal_plan_meals')
    op.drop_table('meal_plan_meals')
    op.drop_index(op.f('ix_meal_plan_days_id'), table_name='meal_plan_days')
    op.drop_table('meal_plan_days')
    op.drop_index(op.f('ix_meal_plans_id'), table_name='meal_plans')
    op.drop_table('meal_plans')
