"""Inscrição de push Web (Frente A). `user_id` só de `current_user`."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.services.consents import require_consent
from app.schemas.push import (
    PushSubscriptionCreate,
    PushSubscriptionCreated,
    PushSubscriptionDelete,
    VapidPublicKey,
)

router = APIRouter()

MAX_INSCRICOES_POR_USUARIO = 10


@router.get("/vapid-public-key", response_model=VapidPublicKey)
def chave_publica(current_user: User = Depends(get_current_user)):
    if not settings.VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=503,
            detail={"code": "PUSH_NOT_CONFIGURED", "message": "Notificações ainda não estão configuradas."},
        )
    return VapidPublicKey(public_key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscriptions", response_model=PushSubscriptionCreated, status_code=status.HTTP_201_CREATED)
def inscrever(
    payload: PushSubscriptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_consent("push")),
):
    sub = db.query(PushSubscription).filter(PushSubscription.endpoint == payload.endpoint).first()
    if sub is None:
        sub = PushSubscription(endpoint=payload.endpoint, user_id=current_user.id,
                               p256dh=payload.keys.p256dh, auth=payload.keys.auth)
        db.add(sub)
    else:
        # Mesmo navegador, outra conta: a inscrição passa para quem está logado agora,
        # em vez de notificar a conta antiga.
        sub.user_id = current_user.id
        sub.p256dh = payload.keys.p256dh
        sub.auth = payload.keys.auth
    db.flush()

    minhas = (
        db.query(PushSubscription)
        .filter(PushSubscription.user_id == current_user.id)
        .order_by(PushSubscription.created_at, PushSubscription.id)
        .all()
    )
    for velha in minhas[: max(0, len(minhas) - MAX_INSCRICOES_POR_USUARIO)]:
        if velha.id != sub.id:
            db.delete(velha)
    db.commit()
    return PushSubscriptionCreated(id=sub.id)


@router.delete("/subscriptions", status_code=status.HTTP_204_NO_CONTENT)
def desinscrever(
    payload: PushSubscriptionDelete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Alheio ou inexistente: mesmo 204, sem apagar nada que não seja do usuário.
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == payload.endpoint,
        PushSubscription.user_id == current_user.id,
    ).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
