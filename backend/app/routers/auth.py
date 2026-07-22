from datetime import datetime, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core import security
from app.core.limiter import limiter
from app.core.deps import get_current_user
from app.crud import user as crud_user
from app.models.user import User
from app.schemas.token import Token
from app.schemas.user import ResendVerificationRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.core.config import settings
from app.services.email import send_verification_email, send_password_reset_email

router = APIRouter()

@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
def login_for_access_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db)
):
    # Busca o usuário pelo email
    user = crud_user.get_user_by_email(db, email=form_data.username)
    
    # Usuário existe e se senha bate
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ACCOUNT_DISABLED", "message": "Sua conta foi desativada."},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "EMAIL_NOT_VERIFIED", "message": "Confirme seu email antes de entrar."},
        )

    user.last_login_at = datetime.utcnow()
    db.commit()

    # Gera o tempo de expiração
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=Token)
def refresh_access_token(current_user: User = Depends(get_current_user)):
    """Renova o token de quem já tem um token válido — usado pelo aviso de
    sessão expirando no frontend pra "estender" sem pedir a senha de novo."""
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": current_user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    email = security.decode_email_verification_token(token)
    if not email:
        raise HTTPException(status_code=400, detail="Link inválido ou expirado.")

    user = crud_user.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if not user.is_verified:
        user.is_verified = True
        db.commit()

    return {"message": "Email verificado com sucesso!"}


@router.post("/resend-verification")
@limiter.limit("3/hour")
def resend_verification(request: Request, data: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_email(db, email=data.email)
    if user and not user.is_verified:
        send_verification_email(user.email)

    # Resposta sempre genérica — não revela se o email existe na base.
    return {"message": "Se o email existir e ainda não estiver verificado, enviamos um novo link."}


@router.post("/forgot-password")
@limiter.limit("3/hour")
def forgot_password(request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_email(db, email=data.email)
    if user:
        send_password_reset_email(user.email)

    # Resposta sempre genérica — não revela se o email existe na base (mesma
    # regra de segurança do resend-verification, evita enumeração de usuários).
    return {"message": "Se o email existir na nossa base, enviamos um link pra redefinir a senha."}


@router.post("/reset-password")
@limiter.limit("5/hour")
def reset_password(request: Request, data: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = security.decode_password_reset_token(data.token)
    if not email:
        raise HTTPException(status_code=400, detail="Link inválido ou expirado. Peça um novo.")

    user = crud_user.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=400, detail="Link inválido ou expirado. Peça um novo.")

    user.hashed_password = security.get_password_hash(data.new_password)
    db.commit()

    return {"message": "Senha redefinida com sucesso! Já pode entrar com a nova senha."}