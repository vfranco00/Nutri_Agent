"""add_subscriptions_and_usage_events

Revision ID: 4b13acac5add
Revises: ae1bb9228618
Create Date: 2026-07-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b13acac5add'
down_revision: Union[str, Sequence[str], None] = 'ae1bb9228618'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('subscriptions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('plan', sa.String(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('mp_subscription_id', sa.String(), nullable=True),
    sa.Column('current_period_end', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_subscriptions_id'), 'subscriptions', ['id'], unique=False)

    op.create_table('usage_events',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('event_type', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_usage_events_id'), 'usage_events', ['id'], unique=False)
    op.create_index(op.f('ix_usage_events_user_id'), 'usage_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_usage_events_event_type'), 'usage_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_usage_events_created_at'), 'usage_events', ['created_at'], unique=False)

    # Backfill: todo usuário existente nasce Starter — sem isso, get_current_user
    # em diante trataria "sem Subscription" como um caso especial em todo lugar.
    op.execute(
        "INSERT INTO subscriptions (user_id, plan, status, created_at) "
        "SELECT id, 'starter', 'active', now() FROM users"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_usage_events_created_at'), table_name='usage_events')
    op.drop_index(op.f('ix_usage_events_event_type'), table_name='usage_events')
    op.drop_index(op.f('ix_usage_events_user_id'), table_name='usage_events')
    op.drop_index(op.f('ix_usage_events_id'), table_name='usage_events')
    op.drop_table('usage_events')
    op.drop_index(op.f('ix_subscriptions_id'), table_name='subscriptions')
    op.drop_table('subscriptions')
