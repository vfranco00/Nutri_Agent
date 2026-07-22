"""add_user_created_at

Revision ID: 0f2583dd2474
Revises: fb8d50947532
Create Date: 2026-07-22 02:14:08.305966

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0f2583dd2474'
down_revision: Union[str, Sequence[str], None] = 'fb8d50947532'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('created_at', sa.DateTime(), nullable=True))
    # Backfill: usuários existentes não têm data de cadastro real registrada —
    # melhor esforço com a data da migration em vez de deixar NULL (quebraria o
    # gráfico de crescimento no painel admin).
    op.execute("UPDATE users SET created_at = now() WHERE created_at IS NULL")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'created_at')
