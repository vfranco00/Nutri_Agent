"""Água do dia (Frente A).

Mesmas regras de `routers/diary.py`: `user_id` só de `current_user`, e recurso alheio
responde 404 idêntico ao inexistente (nunca 403).
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.profile import Profile
from app.models.user import User
from app.models.water import WaterEntry
from app.schemas.water import WaterDay, WaterEntryCreate, WaterEntryResponse
from app.services.water_goal import water_goal_ml

router = APIRouter()

# Teto de SEGURANÇA, igual em todos os planos (como o RS-11 do diário): sem ele, um
# laço de POST enche a tabela. 50 copos é muito acima de qualquer dia real.
MAX_ENTRADAS_AGUA_POR_DIA = 50


def _nao_encontrada() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "WATER_NOT_FOUND", "message": "Registro de água não encontrado"},
    )


def _dia(db: Session, user: User, dia: date) -> WaterDay:
    peso = db.query(Profile.weight).filter(Profile.user_id == user.id).scalar()
    entradas = (
        db.query(WaterEntry)
        .filter(WaterEntry.user_id == user.id, WaterEntry.entry_date == dia)
        .order_by(WaterEntry.created_at, WaterEntry.id)
        .all()
    )
    return WaterDay(
        date=dia,
        goal_ml=water_goal_ml(peso),
        total_ml=sum(e.ml for e in entradas),
        entries=[WaterEntryResponse.model_validate(e) for e in entradas],
    )


@router.get("", response_model=WaterDay)
def ler_dia(
    date_: date = Query(alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _dia(db, current_user, date_)


@router.post("", response_model=WaterDay, status_code=status.HTTP_201_CREATED)
def registrar(
    payload: WaterEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    usadas = (
        db.query(func.count(WaterEntry.id))
        .filter(WaterEntry.user_id == current_user.id, WaterEntry.entry_date == payload.date)
        .scalar()
    )
    if usadas >= MAX_ENTRADAS_AGUA_POR_DIA:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PLAN_LIMIT_REACHED",
                "message": "Limite de registros de água para um único dia atingido.",
                "event_type": "water_entries_per_day",
                "limit": MAX_ENTRADAS_AGUA_POR_DIA,
                "used": usadas,
            },
        )
    db.add(WaterEntry(user_id=current_user.id, entry_date=payload.date, ml=payload.ml))
    db.commit()
    return _dia(db, current_user, payload.date)


@router.delete("/{entry_id}", response_model=WaterDay)
def apagar(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entrada = (
        db.query(WaterEntry)
        .filter(WaterEntry.id == entry_id, WaterEntry.user_id == current_user.id)
        .first()
    )
    if entrada is None:
        raise _nao_encontrada()
    dia = entrada.entry_date
    db.delete(entrada)
    db.commit()
    return _dia(db, current_user, dia)
