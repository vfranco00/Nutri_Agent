"""Configuração única de logging da aplicação.

Antes daqui o backend não tinha `logging` em lugar nenhum: eram ~10 `print()` soltos.
`print` escreve em stdout sem nível, sem timestamp e sem nome do módulo — então não dá
pra filtrar por severidade, não dá pra silenciar ruído sem apagar código, e um erro de
pagamento fica visualmente idêntico a uma mensagem de startup. Em produção isso vira
uma parede de texto onde o incidente não se distingue do normal.

Formato de linha única de propósito: os coletores de log de PaaS (Render, Vercel)
quebram entrada multilinha em eventos separados, o que picota stack trace.
"""

import logging
import sys

from app.core.config import settings

_LOG_FORMAT = "%(asctime)s %(levelname)-8s [%(name)s] %(message)s"
_DATE_FORMAT = "%Y-%m-%dT%H:%M:%S%z"


def setup_logging() -> None:
    """Idempotente — chamar duas vezes não duplica handler (nem duplica linha de log)."""
    root = logging.getLogger()

    if any(getattr(h, "_nutriagent", False) for h in root.handlers):
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT, datefmt=_DATE_FORMAT))
    handler._nutriagent = True  # type: ignore[attr-defined]

    # DEBUG fora de produção ajuda no desenvolvimento; em produção INFO evita vazar
    # payload em log (o DEBUG do httpx/sqlalchemy é verboso e carrega dado de request).
    # Reusa a mesma propriedade que decide headers de segurança e /docs — a definição
    # de "é produção" precisa ser uma só.
    root.setLevel(logging.INFO if settings.is_production else logging.DEBUG)
    root.addHandler(handler)

    # Estes dois são barulhentos em DEBUG e não agregam no dia a dia.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
