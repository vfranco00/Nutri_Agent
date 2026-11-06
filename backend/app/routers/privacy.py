"""Direitos do titular: exportar e excluir os próprios dados (LGPD Art. 18)."""
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.security import verify_password
from app.db.session import get_db
from app.models.user import User
from app.services.account_erasure import ErasureBlocked, erase_account
from app.services.data_export import export_user_data

router = APIRouter()


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


@router.get("/export")
@limiter.limit("3/hour")
def exportar(request: Request, db: Session = Depends(get_db),
             current_user: User = Depends(get_current_user)):
    corpo = json.dumps(export_user_data(db, current_user), ensure_ascii=False, indent=2)
    return Response(
        content=corpo,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="nuvi-meus-dados.json"'},
    )


@router.delete("/account")
@limiter.limit("5/hour")
def excluir_conta(request: Request, payload: DeleteAccountRequest,
                  db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(status_code=403, detail="Senha incorreta.")
    try:
        erase_account(db, current_user)
    except ErasureBlocked:
        raise HTTPException(
            status_code=502,
            detail="Não conseguimos cancelar sua assinatura no Mercado Pago agora. "
                   "Nada foi apagado; tente novamente em alguns minutos.",
        )
    return {"message": "Conta excluída."}
