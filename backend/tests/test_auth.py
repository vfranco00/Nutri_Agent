from app.core.limiter import limiter
from app.core.security import create_email_verification_token
from app.models.user import User


def test_login_wrong_password(client, make_user):
    make_user(email="login1@example.com", password="strongpassword123")
    res = client.post("/auth/login", data={"username": "login1@example.com", "password": "senhaerrada"})
    assert res.status_code == 401


def test_protected_route_rejects_malformed_token(client):
    client.headers.update({"Authorization": "Bearer token-completamente-invalido"})
    res = client.get("/users/me")
    assert res.status_code == 401


def test_protected_route_rejects_token_without_sub_claim(client):
    from jose import jwt as jose_jwt
    from app.core.config import settings as app_settings

    token = jose_jwt.encode({"foo": "bar"}, app_settings.SECRET_KEY, algorithm=app_settings.ALGORITHM)
    client.headers.update({"Authorization": f"Bearer {token}"})
    res = client.get("/users/me")
    assert res.status_code == 401


def test_login_success(client, make_user):
    make_user(email="login2@example.com", password="strongpassword123")
    res = client.post("/auth/login", data={"username": "login2@example.com", "password": "strongpassword123"})
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_blocked_when_account_disabled(client, make_user, db_session):
    make_user(email="banned@example.com", password="strongpassword123")
    user = db_session.query(User).filter(User.email == "banned@example.com").first()
    user.is_active = False
    db_session.commit()

    res = client.post("/auth/login", data={"username": "banned@example.com", "password": "strongpassword123"})
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "ACCOUNT_DISABLED"


def test_login_blocked_when_email_not_verified(client, db_session):
    # Cadastra sem passar pelo fixture make_user, que já marca is_verified=True
    client.post("/users/", json={"email": "unverified@example.com", "password": "strongpassword123"})
    res = client.post("/auth/login", data={"username": "unverified@example.com", "password": "strongpassword123"})
    assert res.status_code == 403
    assert res.json()["detail"]["code"] == "EMAIL_NOT_VERIFIED"


def test_verify_email_with_valid_token(client, db_session):
    client.post("/users/", json={"email": "toverify@example.com", "password": "strongpassword123"})
    token = create_email_verification_token("toverify@example.com")

    res = client.get("/auth/verify-email", params={"token": token})
    assert res.status_code == 200

    user = db_session.query(User).filter(User.email == "toverify@example.com").first()
    assert user.is_verified is True


def test_verify_email_with_invalid_token(client):
    res = client.get("/auth/verify-email", params={"token": "token-lixo"})
    assert res.status_code == 400


def test_verify_email_unknown_user(client):
    token = create_email_verification_token("naoexiste@example.com")
    res = client.get("/auth/verify-email", params={"token": token})
    assert res.status_code == 404


def test_resend_verification_is_always_generic(client):
    # Pra não revelar se o email existe na base, a resposta é igual nos dois casos.
    res_existing = client.post("/auth/resend-verification", json={"email": "unverified@example.com"})
    res_missing = client.post("/auth/resend-verification", json={"email": "naoexiste999@example.com"})
    assert res_existing.status_code == 200
    assert res_missing.status_code == 200
    assert res_existing.json() == res_missing.json()


def test_login_rate_limited_after_five_attempts(client, make_user):
    make_user(email="ratelimit@example.com", password="strongpassword123")

    limiter.reset()
    limiter.enabled = True
    try:
        for _ in range(5):
            res = client.post(
                "/auth/login",
                data={"username": "ratelimit@example.com", "password": "senhaerrada"},
            )
            assert res.status_code == 401

        blocked = client.post(
            "/auth/login",
            data={"username": "ratelimit@example.com", "password": "senhaerrada"},
        )
        assert blocked.status_code == 429
    finally:
        limiter.reset()
        limiter.enabled = False
