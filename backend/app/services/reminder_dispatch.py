"""Dispara os lembretes que caíram nos últimos 5 minutos (chamado pelo cron externo).

Regras que não podem ser quebradas:
- só o que caiu em `(agora - WINDOW, agora]`, olhando o dia local de hoje E o de ontem
  (um lembrete das 23h58 chamado às 00h01 pertence ao dia anterior);
- nunca duas vezes no mesmo dia local: a marcação é um UPDATE atômico condicional e só
  quem muda a linha envia (duas chamadas simultâneas do cron não duplicam);
- inscrição cujo push responde 404/410 é apagada.
"""

import logging
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import or_, update
from sqlalchemy.orm import Session

from app.models.push_subscription import PushSubscription
from app.models.reminder import Reminder
from app.services.webpush import send_push

logger = logging.getLogger(__name__)

WINDOW = timedelta(minutes=5)

# Texto GENÉRICO de propósito: a tela de bloqueio aparece para terceiros, então a
# notificação nunca leva número, meta nem dado de saúde (LGPD Art. 11; G-20).
_TEXTOS = {
    "cafe": ("Hora de registrar seu café da manhã", "Abra o Nuvi.", "/hoje"),
    "almoco": ("Hora de registrar seu almoço", "Abra o Nuvi.", "/hoje"),
    "lanche": ("Hora de registrar seu lanche", "Abra o Nuvi.", "/hoje"),
    "jantar": ("Hora de registrar seu jantar", "Abra o Nuvi.", "/hoje"),
    "agua": ("Hora de beber água", "Abra o Nuvi.", "/hoje"),
    "peso": ("Hora de registrar seu peso", "Abra o Nuvi.", "/progresso"),
}


@dataclass
class DispatchResult:
    reminders: int = 0
    sent: int = 0
    removed: int = 0
    failed: int = 0


def _dia_devido(r: Reminder, agora: datetime) -> date | None:
    """Dia local cujo horário do lembrete caiu em `(agora - WINDOW, agora]`, ou None."""
    try:
        tz = ZoneInfo(r.timezone)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        logger.warning("Fuso inválido no lembrete %s; ignorado", r.id)
        return None
    hoje = agora.astimezone(tz).date()
    for dia in (hoje, hoje - timedelta(days=1)):
        devido = datetime.combine(dia, r.local_time, tzinfo=tz).astimezone(timezone.utc)
        if agora - WINDOW < devido <= agora:
            return dia
    return None


def _payload(kind: str) -> dict:
    title, body, url = _TEXTOS[kind]
    return {"title": title, "body": body, "url": url, "tag": f"nuvi-{kind}"}


def dispatch_due_reminders(db: Session, now_utc: datetime) -> DispatchResult:
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=timezone.utc)
    now_utc = now_utc.astimezone(timezone.utc)
    resultado = DispatchResult()

    for r in db.query(Reminder).filter(Reminder.enabled.is_(True)).all():
        dia = _dia_devido(r, now_utc)
        if dia is None:
            continue
        # Marca ANTES de enviar. rowcount == 0 = outra chamada já levou este dia.
        marcou = db.execute(
            update(Reminder)
            .where(Reminder.id == r.id)
            .where(or_(Reminder.last_sent_on.is_(None), Reminder.last_sent_on != dia))
            .values(last_sent_on=dia)
        ).rowcount
        db.commit()
        if marcou != 1:
            continue
        resultado.reminders += 1
        payload = _payload(r.kind)
        for sub in db.query(PushSubscription).filter(PushSubscription.user_id == r.user_id).all():
            saida = send_push(sub, payload)
            if saida == "ok":
                sub.last_success_at = now_utc.replace(tzinfo=None)
                resultado.sent += 1
            elif saida == "gone":
                db.delete(sub)
                resultado.removed += 1
            else:
                resultado.failed += 1
        db.commit()
    return resultado
