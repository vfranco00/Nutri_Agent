from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core import security
from app.core.config import settings


def test_password_hash_roundtrip():
    hashed = security.get_password_hash("strongpassword123")
    assert hashed != "strongpassword123"
    assert security.verify_password("strongpassword123", hashed)


def test_password_verify_rejects_wrong_password():
    hashed = security.get_password_hash("strongpassword123")
    assert not security.verify_password("outrasenha", hashed)


def test_create_access_token_roundtrip():
    token = security.create_access_token({"sub": "user@example.com"}, expires_delta=timedelta(minutes=5))
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == "user@example.com"


def test_email_verification_token_roundtrip():
    token = security.create_email_verification_token("user@example.com")
    assert security.decode_email_verification_token(token) == "user@example.com"


def test_email_verification_token_rejects_garbage():
    assert security.decode_email_verification_token("token-invalido-qualquer") is None


def test_email_verification_token_rejects_wrong_type():
    # um access token normal não pode ser usado como token de verificação de email
    access_token = security.create_access_token({"sub": "user@example.com"})
    assert security.decode_email_verification_token(access_token) is None


def test_email_verification_token_rejects_expired():
    expired_payload = {
        "sub": "user@example.com",
        "type": "email_verification",
        "exp": datetime(2000, 1, 1, tzinfo=timezone.utc),
    }
    expired_token = jwt.encode(expired_payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    assert security.decode_email_verification_token(expired_token) is None
