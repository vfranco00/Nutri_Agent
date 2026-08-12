"""diario alimentar e particao do food_cache por procedencia

=======================================================================================
ATENÇÃO — ESTA MIGRATION DESTRÓI DADO, NOS DOIS SENTIDOS.

UPGRADE: APAGA TODAS AS LINHAS DE `food_cache`. AS LINHAS ATUAIS NÃO TÊM PROCEDÊNCIA E
NÃO PODEM SER CLASSIFICADAS DEPOIS DO FATO — PROMOVÊ-LAS A `taco`/`curated` SERIA
INVENTAR PROCEDÊNCIA E IMPORTAR UM POSSÍVEL ENVENENAMENTO PARA DENTRO DA ESTRUTURA
CONSTRUÍDA PARA CONTÊ-LO. O CACHE É REGENERÁVEL; NENHUM DADO DE USUÁRIO SE PERDE AQUI.
FAZER `pg_dump` DE `food_cache` ANTES DE APLICAR.

DOWNGRADE: APAGA A TABELA `diary_entries` INTEIRA — OU SEJA, O DIÁRIO ALIMENTAR DE TODOS
OS USUÁRIOS. ISSO **NÃO É REGENERÁVEL**. O `downgrade` TAMBÉM NÃO RESTAURA AS LINHAS DE
`food_cache` APAGADAS NO UPGRADE: DESCER DEIXA A TABELA VAZIA. DESCER EM PRODUÇÃO DEPOIS
DE A FEATURE ESTAR NO AR EXIGE `pg_dump` COMPLETO ANTES.
=======================================================================================

Escrita à mão, sem --autogenerate: o autogenerate não emite o DELETE do passo 4, não
gera índice parcial corretamente e ordena as operações pelo que lhe convém.

Revision ID: d5a3e7c1b204
Revises: c4f8b1d90a27
Create Date: 2026-08-11

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd5a3e7c1b204'
down_revision: Union[str, Sequence[str], None] = 'c4f8b1d90a27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---- Passo 1: food_catalog -------------------------------------------------------
    # Criada VAZIA. Quem popula é sync_food_catalog() no lifespan do main.py.
    op.create_table(
        'food_catalog',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(length=160), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('name_normalized', sa.String(length=120), nullable=False),
        sa.Column('base_unit', sa.String(length=4), nullable=False),
        sa.Column('kcal_per_base_unit', sa.Float(), nullable=False),
        # Macros NULLABLE, divergindo do § 4.2 do ADR-0001, que os pede NOT NULL.
        # O § 4.2 fundamenta o NOT NULL em "a curadoria é nossa" — premissa que vale
        # quando os macros vêm conferidos da publicação oficial da TACO/UNICAMP. Este
        # dataset saiu UNVERIFIED e tem itens sem macro publicado. Com NOT NULL, as duas
        # saídas seriam gravar 0.0 (afirmar "não tem proteína", o que o § 9.4 proíbe) ou
        # excluir o item de TACO_FOODS (quebrando TACO_PER_100G/TACO_PER_UNIT e, com
        # eles, services/ai.py). Reavaliar quando os macros forem conferidos.
        sa.Column('protein_per_base_unit', sa.Float(), nullable=True),
        sa.Column('carbs_per_base_unit', sa.Float(), nullable=True),
        sa.Column('fat_per_base_unit', sa.Float(), nullable=True),
        sa.Column('dataset_version', sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_food_catalog_id', 'food_catalog', ['id'])
    op.create_index('uq_food_catalog_slug', 'food_catalog', ['slug'], unique=True)
    op.create_index(
        'uq_food_catalog_name_unit', 'food_catalog',
        ['name_normalized', 'base_unit'], unique=True,
    )

    # ---- Passo 2: diary_entries ------------------------------------------------------
    op.create_table(
        'diary_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        # CASCADE fecha o direito de eliminação da LGPD (RS-29). NOT NULL é requisito de
        # segurança: linha órfã escapa de todo filtro de escopo user_id == X.
        sa.Column('user_id', sa.Integer(),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('meal_slot', sa.String(length=16), nullable=False),
        # Referência FRACA, sem FK: a entrada guarda snapshot e a fonte pode expirar.
        sa.Column('food_ref', sa.String(length=180), nullable=False),
        sa.Column('food_name', sa.String(length=120), nullable=False),
        sa.Column('source', sa.String(length=16), nullable=False),
        sa.Column('base_unit', sa.String(length=4), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(length=16), nullable=False),
        sa.Column('kcal_per_base_unit', sa.Float(), nullable=False),
        sa.Column('protein_per_base_unit', sa.Float(), nullable=True),
        sa.Column('carbs_per_base_unit', sa.Float(), nullable=True),
        sa.Column('fat_per_base_unit', sa.Float(), nullable=True),
        sa.Column('calories_total', sa.Float(), nullable=False),
        sa.Column('protein_g_total', sa.Float(), nullable=True),
        sa.Column('carbs_g_total', sa.Float(), nullable=True),
        sa.Column('fat_g_total', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_diary_entries_id', 'diary_entries', ['id'])
    op.create_index('ix_diary_entries_user_date', 'diary_entries', ['user_id', 'entry_date'])

    # ---- Passo 3: diary_plan_bindings ------------------------------------------------
    op.create_table(
        'diary_plan_bindings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('meal_plan_id', sa.Integer(),
                  sa.ForeignKey('meal_plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_diary_plan_bindings_id', 'diary_plan_bindings', ['id'])
    op.create_index('ix_diary_plan_bindings_user_start', 'diary_plan_bindings',
                    ['user_id', 'start_date'])

    # ---- Passo 4: esvaziar food_cache ANTES de alterá-la -----------------------------
    # Tem que vir antes do passo 5: duas das colunas novas são NOT NULL sem valor
    # derivável para as linhas existentes.
    op.execute("DELETE FROM food_cache")

    # ---- Passo 5: alterar food_cache -------------------------------------------------
    # batch_alter_table é obrigatório e não é preciosismo: o SQLite (onde a suíte inteira
    # roda) não implementa ALTER TABLE ... DROP CONSTRAINT nem ADD COLUMN NOT NULL sem
    # default. O batch recria a tabela e contorna os dois; em Postgres o Alembic emite o
    # ALTER nativo.
    with op.batch_alter_table('food_cache') as batch:
        batch.drop_constraint('uq_food_cache_name_unit_type', type_='unique')
        batch.add_column(sa.Column('name_normalized', sa.String(length=120), nullable=False))
        batch.add_column(sa.Column('source', sa.String(length=16), nullable=False))
        batch.add_column(sa.Column('created_by_user_id', sa.Integer(), nullable=True))
        # server_default só aqui, para não deixar default de banco em coluna que a
        # aplicação sempre preenche.
        batch.add_column(sa.Column('created_at', sa.DateTime(), nullable=False,
                                   server_default=sa.func.now()))
        batch.add_column(sa.Column('protein_per_base_unit', sa.Float(), nullable=True))
        batch.add_column(sa.Column('carbs_per_base_unit', sa.Float(), nullable=True))
        batch.add_column(sa.Column('fat_per_base_unit', sa.Float(), nullable=True))
        batch.add_column(sa.Column('off_product_id', sa.String(length=64), nullable=True))
        # SET NULL e não CASCADE: a linha é anonimizada, não apagada (RS-29). O par
        # obrigatório disso é o expurgo das órfãs (§ 8.4) — sem ele, a linha sem dono
        # passa a casar o índice parcial COMPARTILHADO e fica visível a todos.
        batch.create_foreign_key('fk_food_cache_created_by_user', 'users',
                                 ['created_by_user_id'], ['id'], ondelete='SET NULL')

    # ---- Passo 6: índices de food_cache, fora do batch --------------------------------
    op.create_index('ix_food_cache_lookup', 'food_cache', ['name_normalized', 'unit_type'])
    op.create_index('ix_food_cache_retention', 'food_cache', ['source', 'created_at'])
    # Os DOIS kwargs de dialeto são obrigatórios. Passar só postgresql_where faz o SQLite
    # criar um índice único TOTAL — e o teste do RS-17 (dois usuários, mesmo nome, mesma
    # unidade, source="llm") passa a estourar IntegrityError só na suíte, com o Postgres
    # se comportando corretamente. Divergência de dialeto silenciosa é a pior classe de
    # bug de migration.
    op.create_index(
        'uq_food_cache_shared', 'food_cache',
        ['name_normalized', 'unit_type', 'source'], unique=True,
        postgresql_where=sa.text('created_by_user_id IS NULL'),
        sqlite_where=sa.text('created_by_user_id IS NULL'),
    )
    op.create_index(
        'uq_food_cache_private', 'food_cache',
        ['name_normalized', 'unit_type', 'source', 'created_by_user_id'], unique=True,
        postgresql_where=sa.text('created_by_user_id IS NOT NULL'),
        sqlite_where=sa.text('created_by_user_id IS NOT NULL'),
    )


def downgrade() -> None:
    # LEIA O AVISO NO TOPO DO ARQUIVO ANTES DE RODAR ISTO. Ordem inversa exata.
    op.drop_index('uq_food_cache_private', table_name='food_cache')
    op.drop_index('uq_food_cache_shared', table_name='food_cache')
    op.drop_index('ix_food_cache_retention', table_name='food_cache')
    op.drop_index('ix_food_cache_lookup', table_name='food_cache')

    with op.batch_alter_table('food_cache') as batch:
        batch.drop_constraint('fk_food_cache_created_by_user', type_='foreignkey')
        batch.drop_column('off_product_id')
        batch.drop_column('fat_per_base_unit')
        batch.drop_column('carbs_per_base_unit')
        batch.drop_column('protein_per_base_unit')
        batch.drop_column('created_at')
        batch.drop_column('created_by_user_id')
        batch.drop_column('source')
        batch.drop_column('name_normalized')
        batch.create_unique_constraint('uq_food_cache_name_unit_type', ['name', 'unit_type'])

    op.drop_index('ix_diary_plan_bindings_user_start', table_name='diary_plan_bindings')
    op.drop_index('ix_diary_plan_bindings_id', table_name='diary_plan_bindings')
    op.drop_table('diary_plan_bindings')

    # A LINHA ABAIXO APAGA O DIÁRIO DE TODOS OS USUÁRIOS. NÃO É REGENERÁVEL.
    op.drop_index('ix_diary_entries_user_date', table_name='diary_entries')
    op.drop_index('ix_diary_entries_id', table_name='diary_entries')
    op.drop_table('diary_entries')

    op.drop_index('uq_food_catalog_name_unit', table_name='food_catalog')
    op.drop_index('uq_food_catalog_slug', table_name='food_catalog')
    op.drop_index('ix_food_catalog_id', table_name='food_catalog')
    op.drop_table('food_catalog')
