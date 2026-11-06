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
from app.services.subscription_lifecycle import run_subscription_lifecycle

router = APIRouter()


def _exigir_segredo(
    x_cron_secret: str | None, authorization: str | None = None
) -> None:
    """Aceita o segredo por dois caminhos: `X-Cron-Secret` (GitHub Actions) ou
    `Authorization: Bearer <CRON_SECRET>` (Vercel Cron manda assim)."""
    esperado = settings.CRON_SECRET
    if not esperado:
        # Sem segredo no servidor o endpoint nunca fica aberto.
        raise HTTPException(status_code=503, detail={"code": "CRON_NOT_CONFIGURED"})
    recebido = x_cron_secret
    if not recebido and authorization and authorization.lower().startswith("bearer "):
        recebido = authorization[7:].strip()
    if not recebido or not secrets.compare_digest(recebido.encode(), esperado.encode()):
        raise HTTPException(status_code=401, detail={"code": "INVALID_CRON_SECRET"})


@router.post("/reminders/dispatch", include_in_schema=False)
def disparar_lembretes(
    x_cron_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    _exigir_segredo(x_cron_secret, authorization)
    return asdict(dispatch_due_reminders(db, datetime.now(timezone.utc)))


@router.post("/retention/run", include_in_schema=False)
def rodar_retencao(
    x_cron_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    _exigir_segredo(x_cron_secret, authorization)
    return run_retention(db)


# --- Vercel Cron -------------------------------------------------------------
# Na Vercel não há processo longo, então o APScheduler (core/scheduler.py) não roda.
# O Vercel Cron chama estas rotas por GET, 1x/dia cada (limite do plano Hobby), com
# `Authorization: Bearer <CRON_SECRET>`. Agendamento em backend/vercel.json.


@router.get("/cron/lifecycle", include_in_schema=False)
def cron_ciclo_de_vida(
    x_cron_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    _exigir_segredo(x_cron_secret, authorization)
    run_subscription_lifecycle(db)
    return {"status": "ok"}


@router.get("/cron/retention", include_in_schema=False)
def cron_retencao(
    x_cron_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    _exigir_segredo(x_cron_secret, authorization)
    return run_retention(db)
