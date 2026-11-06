from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.legal import POLICY_VERSION, PURPOSES
from app.db.session import get_db
from app.models.user import User
from app.schemas.consent import ConsentChange, ConsentItem, ConsentState
from app.services import consents as svc

router = APIRouter()


def _estado(db: Session, user: User) -> ConsentState:
    atual = svc.current_state(db, user.id)
    return ConsentState(
        policy_version=POLICY_VERSION,
        items=[
            ConsentItem(purpose=p, granted=bool(atual[p] and atual[p].granted),
                        at=atual[p].created_at if atual[p] else None)
            for p in PURPOSES
        ],
    )


@router.get("/me", response_model=ConsentState)
def meus_consentimentos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _estado(db, current_user)


@router.post("/me", response_model=ConsentState)
def registrar_consentimento(
    request: Request,
    payload: ConsentChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.purpose == "saude" and not payload.granted:
        raise HTTPException(
            status_code=409,
            detail="Revogar o consentimento de saúde é excluir a conta. Use a opção "
                   "'Excluir minha conta' em Privacidade.",
        )
    svc.record(db, current_user.id, payload.purpose, payload.granted, payload.source, request)
    return _estado(db, current_user)
