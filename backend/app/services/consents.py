"""Consentimento por finalidade: leitura do estado atual, gravação de evento e a trava
`require_consent` usada pelas rotas que mandam dado ao Gemini ou ao serviço de push."""
import hashlib

from fastapi import Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.legal import POLICY_VERSION, PURPOSES
from app.core.limiter import client_ip_key
from app.db.session import get_db
from app.models.consent import Consent
from app.models.push_subscription import PushSubscription
from app.models.user import User


class ConsentRequired(Exception):
    def __init__(self, purpose: str):
        self.purpose = purpose


def ip_hash(request: Request | None) -> str | None:
    if request is None:
        return None
    ip = client_ip_key(request)
    return hashlib.sha256(f"{settings.SECRET_KEY}:{ip}".encode()).hexdigest()


def current_state(db: Session, user_id: int) -> dict[str, Consent | None]:
    """Último evento de cada finalidade (None = nunca respondeu)."""
    ultimos = (
        db.query(func.max(Consent.id))
        .filter(Consent.user_id == user_id)
        .group_by(Consent.purpose)
        .all()
    )
    ids = [i for (i,) in ultimos]
    eventos = db.query(Consent).filter(Consent.id.in_(ids)).all() if ids else []
    estado: dict[str, Consent | None] = {p: None for p in PURPOSES}
    for e in eventos:
        estado[e.purpose] = e
    return estado


def has_consent(db: Session, user_id: int, purpose: str) -> bool:
    ultimo = (
        db.query(Consent)
        .filter(Consent.user_id == user_id, Consent.purpose == purpose)
        .order_by(Consent.id.desc())
        .first()
    )
    return bool(ultimo and ultimo.granted)


def record(db: Session, user_id: int, purpose: str, granted: bool, source: str,
           request: Request | None = None, commit: bool = True) -> Consent:
    ev = Consent(user_id=user_id, purpose=purpose, granted=granted, source=source,
                 policy_version=POLICY_VERSION, ip_hash=ip_hash(request))
    db.add(ev)
    if purpose == "push" and not granted:
        # Revogar push apaga as inscrições: a inscrição é identificador persistente do aparelho.
        db.query(PushSubscription).filter(PushSubscription.user_id == user_id).delete(
            synchronize_session=False)
    if commit:
        db.commit()
    else:
        db.flush()
    return ev


def require_consent(purpose: str):
    def _dep(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if not has_consent(db, current_user.id, purpose):
            raise ConsentRequired(purpose)
        return current_user

    return _dep
