"""add_user_last_login_and_feedback_tickets

Revision ID: 4ceee3f579e0
Revises: 5edcb0977336
Create Date: 2026-07-22 10:11:50.028546

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ceee3f579e0'
down_revision: Union[str, Sequence[str], None] = '5edcb0977336'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('last_login_at', sa.DateTime(), nullable=True))

    op.create_table(
        'feedback_tickets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_feedback_tickets_id'), 'feedback_tickets', ['id'], unique=False)
    op.create_index(op.f('ix_feedback_tickets_user_id'), 'feedback_tickets', ['user_id'], unique=False)
    op.create_index(op.f('ix_feedback_tickets_created_at'), 'feedback_tickets', ['created_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_feedback_tickets_created_at'), table_name='feedback_tickets')
    op.drop_index(op.f('ix_feedback_tickets_user_id'), table_name='feedback_tickets')
    op.drop_index(op.f('ix_feedback_tickets_id'), table_name='feedback_tickets')
    op.drop_table('feedback_tickets')
    op.drop_column('users', 'last_login_at')
