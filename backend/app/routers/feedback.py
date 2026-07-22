from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.db.session import get_db
from app.models.feedback import FeedbackTicket
from app.models.user import User
from app.schemas.feedback import FeedbackRequest
from app.services.email import send_feedback_email

router = APIRouter()


@router.post("/")
@limiter.limit("5/hour")
def create_feedback(request: Request, data: FeedbackRequest, db: Session = Depends(get_db)):
    """Rota pública (sem auth) — precisa funcionar tanto pra usuário logado quanto
    pra visitante da landing page. Persiste o chamado primeiro (pra sempre existir
    um registro consultável no painel admin, mesmo que o email falhe) e só depois
    tenta avisar por email — best-effort, não derruba a requisição se o envio falhar."""
    matching_user = db.query(User).filter(User.email == data.email).first()

    ticket = FeedbackTicket(
        user_id=matching_user.id if matching_user else None,
        name=data.name,
        email=data.email,
        category=data.category,
        message=data.message,
    )
    db.add(ticket)
    db.commit()

    send_feedback_email(data.name, data.email, data.category, data.message)

    return {"message": "Chamado enviado com sucesso!"}
