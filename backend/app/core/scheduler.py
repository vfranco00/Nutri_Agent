"""
Job periódico em thread de background, dentro do próprio processo — sem infra nova
(mesmo espírito de "zero dependência externa" já usado no projeto). Roda o ciclo de
vida de assinatura (aviso de vencimento + downgrade automático) uma vez ao subir e
depois a cada 24h.
"""
import sys

from apscheduler.schedulers.background import BackgroundScheduler

from app.db.session import SessionLocal
from app.services.subscription_lifecycle import run_subscription_lifecycle

_scheduler: BackgroundScheduler | None = None


def _run_lifecycle_job() -> None:
    db = SessionLocal()
    try:
        run_subscription_lifecycle(db)
    except Exception as e:
        # Uma falha aqui não pode derrubar o processo — é um job de background.
        print(f"[scheduler] Falha ao rodar o ciclo de vida de assinatura: {e}")
    finally:
        db.close()


def start_scheduler() -> None:
    global _scheduler
    if "pytest" in sys.modules:
        # Nunca inicia em teste — evita thread de background tocando o banco
        # de teste (ou tentando abrir uma conexão real) fora do controle do pytest.
        return
    if _scheduler is not None:
        return

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(_run_lifecycle_job, "interval", hours=24)
    _scheduler.start()
    # Roda uma vez já na subida, sem esperar as primeiras 24h.
    _scheduler.add_job(_run_lifecycle_job)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
