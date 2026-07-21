"""add_user_has_seen_onboarding

Revision ID: ae1bb9228618
Revises: 9e1e57dd7e9a
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ae1bb9228618'
down_revision: Union[str, Sequence[str], None] = '9e1e57dd7e9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default=true pros usuários já existentes não verem o tour do zero —
    # só cadastros novos (default=False do lado do modelo) passam pelo onboarding.
    op.add_column('users', sa.Column('has_seen_onboarding', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.alter_column('users', 'has_seen_onboarding', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'has_seen_onboarding')
