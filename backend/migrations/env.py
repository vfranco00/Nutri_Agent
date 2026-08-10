import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config # Se fossemos usar async, mas vamos de sync por enquanto para simplicidade no MVP

from alembic import context

# IMPORTANTE: `app.db.base` é o agregador — importar de lá garante que TODOS os models
# estejam registrados em Base.metadata. Não volte a listar models aqui um a um: era
# assim antes, dois foram esquecidos (payment e feedback), e o autogenerate passou a
# enxergar as tabelas `payments` e `feedback_tickets` como órfãs — pronto pra emitir
# DROP TABLE nas duas. O ponto de registro tem que ser único.
from app.core.config import settings
from app.db.base import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Sobrescreve a URL do alembic.ini com a nossa do settings (Environment Variable)
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.DATABASE_URL
    
    from sqlalchemy import engine_from_config

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()