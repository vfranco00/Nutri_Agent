"""add_payments_table

Revision ID: 5edcb0977336
Revises: 0f2583dd2474
Create Date: 2026-07-22 03:00:24.004006

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5edcb0977336'
down_revision: Union[str, Sequence[str], None] = '0f2583dd2474'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('mp_payment_id', sa.String(), nullable=False),
        sa.Column('plan', sa.String(), nullable=False),
        sa.Column('amount_brl', sa.Float(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('mp_payment_id'),
    )
    op.create_index(op.f('ix_payments_id'), 'payments', ['id'], unique=False)
    op.create_index(op.f('ix_payments_user_id'), 'payments', ['user_id'], unique=False)
    op.create_index(op.f('ix_payments_mp_payment_id'), 'payments', ['mp_payment_id'], unique=True)
    op.create_index(op.f('ix_payments_created_at'), 'payments', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_payments_created_at'), table_name='payments')
    op.drop_index(op.f('ix_payments_mp_payment_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_user_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_id'), table_name='payments')
    op.drop_table('payments')
