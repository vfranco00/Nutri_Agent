"""Rotas internas, chamadas por automação (cron) e nunca pelo navegador."""

import secrets
from dataclasses import asdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.services.reminder_dispatch import dispatch_due_reminders

router = APIRouter()


@router.post("/reminders/dispatch", include_in_schema=False)
def disparar_lembretes(
    x_cron_secret: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    esperado = settings.CRON_SECRET
    if not esperado:
        # Sem segredo no servidor o endpoint nunca fica aberto.
        raise HTTPException(status_code=503, detail={"code": "CRON_NOT_CONFIGURED"})
    if not x_cron_secret or not secrets.compare_digest(
        x_cron_secret.encode(), esperado.encode()
    ):
        raise HTTPException(status_code=401, detail={"code": "INVALID_CRON_SECRET"})
    return asdict(dispatch_due_reminders(db, datetime.now(timezone.utc)))
