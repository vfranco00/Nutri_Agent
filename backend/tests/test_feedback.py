def test_feedback_sends_email_with_reply_to(client, monkeypatch):
    captured = {}
    monkeypatch.setattr(
        "app.routers.feedback.send_feedback_email",
        lambda name, email, category, message: captured.update(
            name=name, email=email, category=category, message=message
        )
        or True,
    )

    res = client.post(
        "/feedback/",
        json={
            "name": "Fulano",
            "email": "fulano@example.com",
            "category": "bug",
            "message": "O botão de salvar não funciona no cardápio.",
        },
    )

    assert res.status_code == 200
    assert captured["email"] == "fulano@example.com"
    assert captured["category"] == "bug"


def test_feedback_works_without_name(client, monkeypatch):
    monkeypatch.setattr("app.routers.feedback.send_feedback_email", lambda *a, **kw: True)

    res = client.post(
        "/feedback/",
        json={"email": "anonimo@example.com", "message": "Sugestão: adicionar filtro por calorias."},
    )
    assert res.status_code == 200


def test_feedback_rejects_short_message(client):
    res = client.post(
        "/feedback/",
        json={"email": "curto@example.com", "message": "oi"},
    )
    assert res.status_code == 422


def test_feedback_returns_502_when_email_fails(client, monkeypatch):
    monkeypatch.setattr("app.routers.feedback.send_feedback_email", lambda *a, **kw: False)

    res = client.post(
        "/feedback/",
        json={"email": "falha@example.com", "message": "Isso não deveria ir pra frente."},
    )
    assert res.status_code == 502


def test_feedback_works_without_authentication(client, monkeypatch):
    # Não passa Authorization header nenhum — precisa funcionar pra visitante da landing page.
    monkeypatch.setattr("app.routers.feedback.send_feedback_email", lambda *a, **kw: True)

    res = client.post(
        "/feedback/",
        json={"email": "visitante@example.com", "message": "Ainda não tenho conta, só uma dúvida."},
    )
    assert res.status_code == 200
