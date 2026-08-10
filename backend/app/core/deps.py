import secrets
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import TOKEN_TYPE_ACCESS, password_fingerprint
from app.db.session import get_db
from app.models.user import User
from app.crud.user import get_user_by_email

# Define que o token vem do header "Authorization: Bearer <token>" e aponta para a URL de login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decodifica o token usando a nossa SECRET_KEY
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception

        # Só token de sessão vale como credencial. Tokens de verificação de email e
        # de reset de senha são assinados com a MESMA chave e também carregam "sub":
        # sem essa checagem, um link de email (que trafega em query string, entra no
        # histórico do navegador e nos logs de acesso) vira sessão completa na API.
        # Ausência de "type" = token de sessão emitido antes desta correção; continua
        # aceito até expirar sozinho pra não deslogar todo mundo no deploy.
        if payload.get("type", TOKEN_TYPE_ACCESS) != TOKEN_TYPE_ACCESS:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Busca o usuário no banco
    user = get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception

    # Revogação de sessão na troca de senha. O token carrega a impressão digital da
    # senha que valia quando ele foi emitido; se a senha mudou, o token morre na hora.
    # Sem isso, "esqueci minha senha" não expulsa o invasor: ele segue autenticado com
    # o token que já tinha, exatamente no momento em que a vítima está tentando
    # retomar a conta. Token sem o claim (emitido antes desta correção) segue aceito
    # até expirar — a alternativa era deslogar toda a base num deploy.
    token_pwd = payload.get("pwd")
    if token_pwd is not None:
        # isinstance antes do compare_digest: com um claim não-string ele levanta
        # TypeError, o que viraria um 500 em vez de um 401 limpo.
        if not isinstance(token_pwd, str) or not secrets.compare_digest(
            token_pwd, password_fingerprint(user.hashed_password)
        ):
            raise credentials_exception

    # Reforça a cada request: se o admin baniu o usuário depois que o token foi emitido,
    # o token não pode continuar valendo até expirar sozinho.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ACCOUNT_DISABLED", "message": "Sua conta foi desativada."},
        )
    return user

def get_current_active_superuser(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user