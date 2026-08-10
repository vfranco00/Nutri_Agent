import hashlib

from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.core.config import settings

# Argon2 (o comentário anterior dizia Bcrypt — o esquema configurado é Argon2, que é
# a escolha certa aqui: resistente a GPU/ASIC por ser memory-hard).
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# Hash descartável, calculado uma vez na subida do processo, usado só pra gastar o
# mesmo tempo de CPU do Argon2 quando o email do login não existe (ver
# routers/auth.py::login_for_access_token).
_DUMMY_HASH = pwd_context.hash("nutriagent-dummy-password-for-constant-time-login")


def verify_dummy_password(plain_password: str) -> bool:
    """Sempre False. Existe só pelo efeito colateral do tempo gasto."""
    try:
        return pwd_context.verify(plain_password, _DUMMY_HASH)
    except Exception:
        return False

# Todos os tokens do sistema são assinados com a MESMA SECRET_KEY. Sem um claim
# "type" checado na validação, um token emitido pra um propósito de baixo
# privilégio (confirmar email, redefinir senha) é aceito como credencial de
# sessão completa por qualquer rota protegida. O claim abaixo separa os escopos.
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_EMAIL_VERIFICATION = "email_verification"
TOKEN_TYPE_PASSWORD_RESET = "password_reset"


def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
    hashed_password: str | None = None,
):
    """Token de sessão.

    `hashed_password` grava no token a impressão digital da senha vigente. É o que
    permite derrubar sessões antigas quando a senha muda (ver deps.py::get_current_user):
    sem isso, "redefinir a senha" não expulsa ninguém — quem roubou o token continua
    dentro da conta até o token expirar sozinho, que é justamente o cenário em que a
    vítima está trocando a senha."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)

    to_encode.update({"exp": expire, "type": TOKEN_TYPE_ACCESS})
    if hashed_password is not None:
        to_encode["pwd"] = password_fingerprint(hashed_password)
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_email_verification_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    payload = {"sub": email, "type": TOKEN_TYPE_EMAIL_VERIFICATION, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_email_verification_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    if payload.get("type") != TOKEN_TYPE_EMAIL_VERIFICATION:
        return None
    return payload.get("sub")


def password_fingerprint(hashed_password: str) -> str:
    """Impressão digital curta e irreversível do hash da senha atual.

    Vai dentro do token de reset pra amarrá-lo à senha vigente: assim que a senha
    muda, o fingerprint deixa de bater e o link vira lixo. É o que torna o token
    de uso único (sem precisar de tabela de jti/denylist nem de migration)."""
    return hashlib.sha256(hashed_password.encode()).hexdigest()[:16]


def create_password_reset_token(email: str, hashed_password: str) -> str:
    # Expira em 1h (bem mais curto que a verificação de email, 24h) — reset de
    # senha é mais sensível: se o link vazar, dá acesso à conta na hora.
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = {
        "sub": email,
        "type": TOKEN_TYPE_PASSWORD_RESET,
        "pwd": password_fingerprint(hashed_password),
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_password_reset_token(token: str) -> tuple[str, str] | None:
    """Devolve (email, fingerprint_da_senha) ou None. Quem chama precisa comparar o
    fingerprint com a senha atual do usuário — ver routers/auth.py::reset_password."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    # Checagem de "type" impede que um token de outro propósito (verificação de
    # email, access token de login) seja reaproveitado aqui pra resetar senha.
    if payload.get("type") != TOKEN_TYPE_PASSWORD_RESET:
        return None
    email = payload.get("sub")
    fingerprint = payload.get("pwd")
    # isinstance explícito: quem chama passa o fingerprint pro secrets.compare_digest,
    # que levanta TypeError se não for str — 500 no lugar de um 400 limpo.
    if not isinstance(email, str) or not isinstance(fingerprint, str) or not email or not fingerprint:
        return None
    return email, fingerprint