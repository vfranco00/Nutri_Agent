"""add_feedback_ticket_status

Revision ID: 7a1f2c9d4e60
Revises: 4ceee3f579e0
Create Date: 2026-07-23 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a1f2c9d4e60'
down_revision: Union[str, Sequence[str], None] = '4ceee3f579e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default garante que os chamados que já existem no banco nasçam "aberto"
    # sem precisar de UPDATE manual; nullable=False mantém a consistência daqui pra frente.
    op.add_column(
        'feedback_tickets',
        sa.Column('status', sa.String(), nullable=False, server_default='aberto'),
    )
    op.add_column('feedback_tickets', sa.Column('resolved_at', sa.DateTime(), nullable=True))
    op.create_index(
        op.f('ix_feedback_tickets_status'), 'feedback_tickets', ['status'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_feedback_tickets_status'), table_name='feedback_tickets')
    op.drop_column('feedback_tickets', 'resolved_at')
    op.drop_column('feedback_tickets', 'status')
