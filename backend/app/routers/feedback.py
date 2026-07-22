from fastapi import APIRouter, HTTPException, Request

from app.core.limiter import limiter
from app.schemas.feedback import FeedbackRequest
from app.services.email import send_feedback_email

router = APIRouter()


@router.post("/")
@limiter.limit("5/hour")
def create_feedback(request: Request, data: FeedbackRequest):
    """Rota pública (sem auth) — precisa funcionar tanto pra usuário logado quanto
    pra visitante da landing page. Manda o chamado por email pro Franco."""
    ok = send_feedback_email(data.name, data.email, data.category, data.message)
    if not ok:
        raise HTTPException(status_code=502, detail="Não foi possível enviar o chamado. Tente de novo em instantes.")
    return {"message": "Chamado enviado com sucesso!"}
