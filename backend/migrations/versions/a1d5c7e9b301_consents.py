"""consents: registro de consentimento por finalidade (LGPD, G-01)

Tabela nova, só de inserção. Downgrade apaga o histórico de consentimentos.

Revision ID: a1d5c7e9b301
Revises: c8e1d4a6b925
Create Date: 2026-11-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1d5c7e9b301'
down_revision: Union[str, Sequence[str], None] = 'c8e1d4a6b925'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'consents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('purpose', sa.String(length=16), nullable=False),
        sa.Column('granted', sa.Boolean(), nullable=False),
        sa.Column('policy_version', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('source', sa.String(length=16), nullable=False),
        sa.Column('ip_hash', sa.String(length=64), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_consents_id', 'consents', ['id'])
    op.create_index('ix_consents_user_purpose', 'consents', ['user_id', 'purpose'])


def downgrade() -> None:
    op.drop_index('ix_consents_user_purpose', table_name='consents')
    op.drop_index('ix_consents_id', table_name='consents')
    op.drop_table('consents')
