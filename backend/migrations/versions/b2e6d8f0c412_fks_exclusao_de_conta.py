"""FKs com ondelete para a exclusão de conta (LGPD, G-03)

payments.user_id -> SET NULL (e passa a aceitar NULL: pagamento anonimizado);
feedback_tickets.user_id -> SET NULL; usage_events.user_id e subscriptions.user_id -> CASCADE.

Revision ID: b2e6d8f0c412
Revises: a1d5c7e9b301
Create Date: 2026-11-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b2e6d8f0c412'
down_revision: Union[str, Sequence[str], None] = 'a1d5c7e9b301'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (tabela, ondelete novo)
_FKS = [
    ('payments', 'SET NULL'),
    ('feedback_tickets', 'SET NULL'),
    ('usage_events', 'CASCADE'),
    ('subscriptions', 'CASCADE'),
]


def _refazer(ondelete_por_tabela: dict[str, str | None]) -> None:
    for tabela, ondelete in ondelete_por_tabela.items():
        nome = f'{tabela}_user_id_fkey'
        op.drop_constraint(nome, tabela, type_='foreignkey')
        op.create_foreign_key(nome, tabela, 'users', ['user_id'], ['id'], ondelete=ondelete)


def upgrade() -> None:
    op.alter_column('payments', 'user_id', existing_type=sa.Integer(), nullable=True)
    _refazer(dict(_FKS))


def downgrade() -> None:
    _refazer({t: None for t, _ in _FKS})
    # Pagamentos anonimizados não têm como voltar a ter dono: descartá-los é o único
    # caminho para restaurar NOT NULL.
    op.execute('DELETE FROM payments WHERE user_id IS NULL')
    op.alter_column('payments', 'user_id', existing_type=sa.Integer(), nullable=False)
