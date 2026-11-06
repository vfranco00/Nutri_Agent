"""push_subscriptions.last_success_at: base da retenção de 90 dias (LGPD, G-08)

Revision ID: c3f7e9a1d523
Revises: b2e6d8f0c412
Create Date: 2026-11-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c3f7e9a1d523'
down_revision: Union[str, Sequence[str], None] = 'b2e6d8f0c412'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('push_subscriptions', sa.Column('last_success_at', sa.DateTime(), nullable=True))




def downgrade() -> None:
    op.drop_column('push_subscriptions', 'last_success_at')
