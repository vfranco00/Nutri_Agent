"""Rotas internas, chamadas por automação (cron) e nunca pelo navegador."""

import secrets
from dataclasses import asdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.services.reminder_dispatch import dispatch_due_reminders
from app.services.retention import run_retention

router = APIRouter()


def _exigir_segredo(x_cron_secret: str | None) -> None:
    esperado = settings.CRON_SECRET
    if not esperado:
        # Sem segredo no servidor o endpoint nunca fica aberto.
        raise HTTPException(status_code=503, detail={"code": "CRON_NOT_CONFIGURED"})
    if not x_cron_secret or not secrets.compare_digest(
        x_cron_secret.encode(), esperado.encode()
    ):
        raise HTTPException(status_code=401, detail={"code": "INVALID_CRON_SECRET"})


@router.post("/reminders/dispatch", include_in_schema=False)
def disparar_lembretes(
    x_cron_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    _exigir_segredo(x_cron_secret)
    return asdict(dispatch_due_reminders(db, datetime.now(timezone.utc)))


@router.post("/retention/run", include_in_schema=False)
def rodar_retencao(
    x_cron_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    _exigir_segredo(x_cron_secret)
    return run_retention(db)
