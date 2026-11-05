"""diário: copied_from_entry_id e índice único da cópia — Frente R da Fase 1 Nuvi

Torna "Repetir dia" idempotente. Coluna nula, sem FK. Downgrade só remove a coluna e o
índice; nenhuma entrada é apagada.

Revision ID: f3c9a5d7b218
Revises: a1c3e5f70901
Create Date: 2026-11-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f3c9a5d7b218'
down_revision: Union[str, Sequence[str], None] = 'a1c3e5f70901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('diary_entries') as batch:
        batch.add_column(sa.Column('copied_from_entry_id', sa.Integer(), nullable=True))
        batch.create_unique_constraint(
            'uq_diary_entries_copy', ['user_id', 'entry_date', 'copied_from_entry_id']
        )


def downgrade() -> None:
    with op.batch_alter_table('diary_entries') as batch:
        batch.drop_constraint('uq_diary_entries_copy', type_='unique')
        batch.drop_column('copied_from_entry_id')
