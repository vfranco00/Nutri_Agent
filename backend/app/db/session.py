import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite (usado só em teste) não aceita os parâmetros de QueuePool — o pool dele é outro.
_is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")

_pool_kwargs = {} if _is_sqlite else {
    # Sem isto, a conexão que morreu enquanto o processo estava ocioso volta do pool e
    # estoura no primeiro request seguinte (500 intermitente, tipicamente o primeiro
    # acesso depois de um período parado). O pre_ping gasta um round-trip trivial pra
    # validar antes de entregar. É a linha que resolve o sintoma mais confuso daqui.
    "pool_pre_ping": True,

    # O Postgres é o pooler do Supabase em session mode: cada conexão nossa ocupa um
    # slot lá. Dimensionado pra caber com folga e não brigar com o pooler:
    # 5 permanentes + 5 de pico = teto de 10 por processo.
    "pool_size": 5,
    "max_overflow": 5,

    # O APScheduler (core/scheduler.py) roda no MESMO processo e abre a própria
    # SessionLocal(), disputando este pool com os requests. 30s de espera antes de
    # falhar evita que um job segurando conexão derrube requests com erro imediato.
    "pool_timeout": 30,

    # Poolers e balanceadores derrubam conexão ociosa em silêncio; reciclar antes
    # (30 min) evita entregar uma conexão que o outro lado já considera fechada.
    "pool_recycle": 1800,
}

# Na Vercel (variável VERCEL presente) cada instância é efêmera e pode haver muitas ao
# mesmo tempo: um pool por instância esgotaria as conexões do Postgres. Aí usamos
# NullPool (abre/fecha por request) e quem faz o pooling de verdade é o Supabase.
# POR ISSO a DATABASE_URL cadastrada na Vercel deve ser a do POOLER DE TRANSAÇÃO do
# Supabase (Connection string > Transaction pooler, porta 6543). O pre_ping continua
# ligado. As migrações (alembic) NÃO usam esta URL: rodam pelo GitHub Actions com a
# conexão direta/session pooler (porta 5432).
if os.getenv("VERCEL") and not _is_sqlite:
    _pool_kwargs = {"poolclass": NullPool, "pool_pre_ping": True}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **_pool_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()