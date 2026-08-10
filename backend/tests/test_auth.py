from app.core.limiter import limiter
from app.core.security import create_email_verification_token, create_password_reset_token
from app.models.user import User


def _reset_token_for(db_session, email: str) -> str:
    """Token de reset válido pro usuário. O token é amarrado ao hash da senha vigente
    (torna o link de uso único), então precisa ser gerado a partir do banco."""
    user = db_session.query(User).filter(User.email == email).first()
    return create_password_reset_token(email, user.hashed_password)


def test_login_wrong_password(client, make_user):
    make_user(email="login1@example.com", password="strongpassword123")
    res = client.post("/auth/login", data={"username": "login1@example.com", "password": "senhaerrada"})
    assert res.status_code == 401


def test_refresh_returns_a_valid_new_token(make_user):
    auth_client = make_user(email="refresh@example.com")
    res = auth_client.post("/auth/refresh")
    assert res.status_code == 200
    new_token = res.json()["access_token"]

    other_client_with_new_token = auth_client
    other_client_with_new_token.headers.update({"Authorization": f"Bearer {new_token}"})
    res_me = other_client_with_new_token.get("/users/me")
    assert res_me.status_code == 200


def test_refresh_requires_authentication(client):
    res = client.post("/auth/refresh")
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


def test_login_records_last_login_at(client, make_user, db_session):
    # make_user já loga uma vez internamente pra devolver o client autenticado —
    # por isso comparamos "ficou mais recente" em vez de "começou nulo".
    make_user(email="ultimologin@example.com", password="strongpassword123")
    user = db_session.query(User).filter(User.email == "ultimologin@example.com").first()
    first_login = user.last_login_at
    assert first_login is not None

    client.post("/auth/login", data={"username": "ultimologin@example.com", "password": "strongpassword123"})

    db_session.refresh(user)
    assert user.last_login_at >= first_login


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


def test_forgot_password_is_always_generic(client, make_user):
    make_user(email="tempsenha@example.com", password="strongpassword123")

    res_existing = client.post("/auth/forgot-password", json={"email": "tempsenha@example.com"})
    res_missing = client.post("/auth/forgot-password", json={"email": "naoexiste888@example.com"})
    assert res_existing.status_code == 200
    assert res_missing.status_code == 200
    assert res_existing.json() == res_missing.json()


def test_forgot_password_sends_email_for_existing_user(client, make_user, monkeypatch):
    make_user(email="mandaemail@example.com", password="strongpassword123")

    called = {}
    monkeypatch.setattr(
        "app.routers.auth.send_password_reset_email",
        lambda email, hashed_password: called.setdefault("email", email) or True,
    )

    client.post("/auth/forgot-password", json={"email": "mandaemail@example.com"})
    assert called.get("email") == "mandaemail@example.com"


def test_forgot_password_does_not_send_email_for_unknown_user(client, monkeypatch):
    called = {}
    monkeypatch.setattr(
        "app.routers.auth.send_password_reset_email",
        lambda email, hashed_password: called.setdefault("email", email) or True,
    )

    client.post("/auth/forgot-password", json={"email": "naoexiste777@example.com"})
    assert "email" not in called


def test_reset_password_with_valid_token(client, make_user, db_session):
    make_user(email="resetsenha@example.com", password="senhaoriginal123")
    token = _reset_token_for(db_session, "resetsenha@example.com")

    res = client.post("/auth/reset-password", json={"token": token, "new_password": "senhanova456"})
    assert res.status_code == 200

    # Login com a senha antiga deixa de funcionar, com a nova funciona.
    old_login = client.post("/auth/login", data={"username": "resetsenha@example.com", "password": "senhaoriginal123"})
    assert old_login.status_code == 401

    new_login = client.post("/auth/login", data={"username": "resetsenha@example.com", "password": "senhanova456"})
    assert new_login.status_code == 200


def test_reset_password_with_invalid_token(client):
    res = client.post("/auth/reset-password", json={"token": "token-lixo", "new_password": "senhanova456"})
    assert res.status_code == 400


def test_reset_password_with_unknown_user(client):
    token = create_password_reset_token("naoexiste666@example.com", "$argon2-hash-qualquer")
    res = client.post("/auth/reset-password", json={"token": token, "new_password": "senhanova456"})
    assert res.status_code == 400


def test_reset_password_rejects_short_password(client, make_user, db_session):
    make_user(email="senhacurta@example.com", password="strongpassword123")
    token = _reset_token_for(db_session, "senhacurta@example.com")

    res = client.post("/auth/reset-password", json={"token": token, "new_password": "curta"})
    assert res.status_code == 422


def test_reset_password_token_cannot_be_reused_as_verification_token(client, make_user, db_session):
    # Um token de reset de senha nunca pode ser aceito como token de verificação de
    # email (nem vice-versa) — o campo "type" no JWT existe exatamente pra isso.
    from app.core.security import decode_email_verification_token

    make_user(email="tipotoken@example.com", password="strongpassword123")
    reset_token = _reset_token_for(db_session, "tipotoken@example.com")

    assert decode_email_verification_token(reset_token) is None


def test_reset_password_token_is_single_use(client, make_user, db_session):
    # O link do email vale 1h. Sem amarrar o token à senha vigente, o MESMO link
    # redefine a senha quantas vezes quiser dentro dessa hora — quem interceptar o
    # email (ou pegar o link no histórico do navegador) recupera a conta de volta
    # depois que a vítima já trocou a senha.
    make_user(email="usounico@example.com", password="senhaoriginal123")
    token = _reset_token_for(db_session, "usounico@example.com")

    primeira = client.post("/auth/reset-password", json={"token": token, "new_password": "senhanova456"})
    assert primeira.status_code == 200

    segunda = client.post("/auth/reset-password", json={"token": token, "new_password": "senhadoatacante789"})
    assert segunda.status_code == 400

    login = client.post("/auth/login", data={"username": "usounico@example.com", "password": "senhadoatacante789"})
    assert login.status_code == 401


def test_password_reset_invalidates_existing_sessions(client, make_user, db_session):
    """Trocar a senha tem que expulsar quem já está dentro.

    Cenário: o atacante roubou o token de sessão da vítima. Ela percebe e redefine a
    senha. Sem revogação, o token roubado continua valendo até expirar sozinho — o
    reset de senha vira teatro, porque o acesso do atacante não é interrompido.
    """
    sessao = make_user(email="revoga@example.com", password="senhaoriginal123")
    assert sessao.get("/users/me").status_code == 200

    token = _reset_token_for(db_session, "revoga@example.com")
    assert client.post(
        "/auth/reset-password", json={"token": token, "new_password": "senhanova456"}
    ).status_code == 200

    # Mesmo token de sessão, senha nova: não vale mais.
    assert sessao.get("/users/me").status_code == 401


def test_reset_password_token_is_not_accepted_as_session_token(client, make_user, db_session):
    # Todos os tokens são assinados com a mesma SECRET_KEY. Sem checar o claim "type"
    # na validação da sessão, o token de reset (que trafega em query string no link do
    # email, entra no histórico do navegador e no log de acesso) vale como Bearer e dá
    # acesso completo à conta.
    make_user(email="tokentroca@example.com", password="strongpassword123")
    reset_token = _reset_token_for(db_session, "tokentroca@example.com")

    client.headers.update({"Authorization": f"Bearer {reset_token}"})
    assert client.get("/users/me").status_code == 401


def test_email_verification_token_is_not_accepted_as_session_token(client, make_user):
    make_user(email="tokenverif@example.com", password="strongpassword123")
    verification_token = create_email_verification_token("tokenverif@example.com")

    client.headers.update({"Authorization": f"Bearer {verification_token}"})
    assert client.get("/users/me").status_code == 401


def test_verification_token_cannot_be_reused_as_reset_password_token(client, make_user):
    # E o inverso também não pode: um token de verificação de email não serve
    # pra resetar senha.
    from app.core.security import decode_password_reset_token

    make_user(email="tipotoken2@example.com", password="strongpassword123")
    verification_token = create_email_verification_token("tipotoken2@example.com")

    assert decode_password_reset_token(verification_token) is None


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
