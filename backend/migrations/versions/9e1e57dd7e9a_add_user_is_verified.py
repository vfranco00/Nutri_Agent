"""add_user_is_verified

Revision ID: 9e1e57dd7e9a
Revises: 37ac714180f6
Create Date: 2026-07-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e1e57dd7e9a'
down_revision: Union[str, Sequence[str], None] = '37ac714180f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default=true garante que usuários já existentes fiquem marcados como
    # verificados (grandfathered) — só cadastros novos, feitos pelo app depois
    # desta migration, nascem com is_verified=False (default do lado do modelo).
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.alter_column('users', 'is_verified', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_verified')
