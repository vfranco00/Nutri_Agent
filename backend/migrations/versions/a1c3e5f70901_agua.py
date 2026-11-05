"""água: tabela water_entries (Frente A do redesign Nuvi)

Só cria tabela nova; não toca em dado existente. O downgrade apaga os registros de água
de todos os usuários (não regeneráveis).

Revision ID: a1c3e5f70901
Revises: e7b2c4a91f30
Create Date: 2026-11-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1c3e5f70901"
down_revision: Union[str, Sequence[str], None] = "e7b2c4a91f30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "water_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("ml", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_water_entries_id", "water_entries", ["id"])
    op.create_index("ix_water_entries_user_date", "water_entries", ["user_id", "entry_date"])


def downgrade() -> None:
    op.drop_index("ix_water_entries_user_date", table_name="water_entries")
    op.drop_index("ix_water_entries_id", table_name="water_entries")
    op.drop_table("water_entries")
