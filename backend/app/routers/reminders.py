"""Lembretes por usuário, com fuso (Frente A). `user_id` só de `current_user`."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.reminder import DEFAULT_TIMES, DEFAULT_TIMEZONE, REMINDER_KINDS, Reminder
from app.models.user import User
from app.schemas.reminder import ReminderItem, RemindersResponse, RemindersUpdate

router = APIRouter()


def _resposta(db: Session, user: User) -> RemindersResponse:
    linhas = {r.kind: r for r in db.query(Reminder).filter(Reminder.user_id == user.id).all()}
    fuso = next(iter(linhas.values())).timezone if linhas else DEFAULT_TIMEZONE
    itens = []
    for kind in REMINDER_KINDS:
        linha = linhas.get(kind)
        hora = linha.local_time if linha else DEFAULT_TIMES[kind]
        itens.append(
            ReminderItem(kind=kind, time=hora.strftime("%H:%M"), enabled=bool(linha and linha.enabled))
        )
    return RemindersResponse(timezone=fuso, reminders=itens)


@router.get("", response_model=RemindersResponse)
def ler(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _resposta(db, current_user)


@router.put("", response_model=RemindersResponse)
def salvar(
    payload: RemindersUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    linhas = {r.kind: r for r in db.query(Reminder).filter(Reminder.user_id == current_user.id).all()}
    # O fuso vale para todas as linhas do usuário; trocar zera a marca de envio.
    for linha in linhas.values():
        if linha.timezone != payload.timezone:
            linha.timezone = payload.timezone
            linha.last_sent_on = None
    for item in payload.reminders:
        hora = item.as_time()
        linha = linhas.get(item.kind)
        if linha is None:
            db.add(
                Reminder(
                    user_id=current_user.id,
                    kind=item.kind,
                    local_time=hora,
                    timezone=payload.timezone,
                    enabled=item.enabled,
                )
            )
            continue
        if linha.local_time != hora:
            linha.local_time = hora
            linha.last_sent_on = None  # o novo horário vale já no mesmo dia
        linha.enabled = item.enabled
    db.commit()
    return _resposta(db, current_user)
