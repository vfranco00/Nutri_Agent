"""add_expiry_warned_at_to_subscriptions

Revision ID: fb8d50947532
Revises: 4b13acac5add
Create Date: 2026-07-22 01:21:22.556229

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb8d50947532'
down_revision: Union[str, Sequence[str], None] = '4b13acac5add'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('subscriptions', sa.Column('expiry_warned_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('subscriptions', 'expiry_warned_at')
