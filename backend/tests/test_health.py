"""Regressão do /health.

O endpoint antes devolvia `{"status": "ok"}` fixo — respondia 200 com o Postgres fora
do ar, o que faz o load balancer continuar mandando tráfego pra uma instância incapaz
de atender. O teste que importa aqui não é o do caminho feliz: é o de falha, porque é
exatamente ele que não existia antes.
"""

from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import app


def test_health_reports_ok_when_database_answers(client):
    res = client.get("/health")

    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "up"}


def test_health_returns_503_when_database_is_down(client):
    """Simula banco indisponível trocando a dependency por uma sessão que estoura."""

    class _SessaoQuebrada:
        def execute(self, *_args, **_kwargs):
            raise OperationalError("SELECT 1", {}, Exception("connection refused"))

    def _get_db_quebrado():
        yield _SessaoQuebrada()

    app.dependency_overrides[get_db] = _get_db_quebrado
    try:
        res = client.get("/health")
    finally:
        # Restaura o override do conftest — sem isto, todo teste seguinte quebra.
        app.dependency_overrides.pop(get_db, None)
        from tests.conftest import _override_get_db

        app.dependency_overrides[get_db] = _override_get_db

    assert res.status_code == 503
    assert res.json() == {"status": "unavailable", "database": "down"}


def test_health_does_not_leak_internals_on_failure(client):
    """A resposta é pública: não pode devolver stack trace nem string de conexão."""

    class _SessaoQuebrada:
        def execute(self, *_args, **_kwargs):
            raise OperationalError(
                "SELECT 1", {}, Exception("postgresql://user:senha@host:5432/db")
            )

    def _get_db_quebrado():
        yield _SessaoQuebrada()

    app.dependency_overrides[get_db] = _get_db_quebrado
    try:
        corpo = client.get("/health").text
    finally:
        app.dependency_overrides.pop(get_db, None)
        from tests.conftest import _override_get_db

        app.dependency_overrides[get_db] = _override_get_db

    assert "senha" not in corpo
    assert "postgresql://" not in corpo
