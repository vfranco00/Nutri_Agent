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


def test_feedback_succeeds_even_when_email_fails(client, db_session, monkeypatch):
    # Regressão: antes, se o email falhasse, o chamado inteiro sumia (502) sem deixar
    # rastro. Agora persiste primeiro — o email é só um aviso best-effort em cima disso.
    from app.models.feedback import FeedbackTicket

    monkeypatch.setattr("app.routers.feedback.send_feedback_email", lambda *a, **kw: False)

    res = client.post(
        "/feedback/",
        json={"email": "falha@example.com", "message": "Isso precisa continuar funcionando."},
    )
    assert res.status_code == 200

    ticket = db_session.query(FeedbackTicket).filter(FeedbackTicket.email == "falha@example.com").first()
    assert ticket is not None
    assert ticket.message == "Isso precisa continuar funcionando."


def test_feedback_works_without_authentication(client, monkeypatch):
    # Não passa Authorization header nenhum — precisa funcionar pra visitante da landing page.
    monkeypatch.setattr("app.routers.feedback.send_feedback_email", lambda *a, **kw: True)

    res = client.post(
        "/feedback/",
        json={"email": "visitante@example.com", "message": "Ainda não tenho conta, só uma dúvida."},
    )
    assert res.status_code == 200


def test_feedback_links_to_existing_user_by_email(client, make_user, db_session, monkeypatch):
    from app.models.feedback import FeedbackTicket
    from app.models.user import User

    make_user(email="temconta@example.com")
    monkeypatch.setattr("app.routers.feedback.send_feedback_email", lambda *a, **kw: True)

    client.post("/feedback/", json={"email": "temconta@example.com", "message": "Chamado de quem já tem conta."})

    user = db_session.query(User).filter(User.email == "temconta@example.com").first()
    ticket = db_session.query(FeedbackTicket).filter(FeedbackTicket.email == "temconta@example.com").first()
    assert ticket.user_id == user.id


def test_feedback_leaves_user_id_null_for_unknown_email(client, db_session, monkeypatch):
    from app.models.feedback import FeedbackTicket

    monkeypatch.setattr("app.routers.feedback.send_feedback_email", lambda *a, **kw: True)

    client.post("/feedback/", json={"email": "semconta999@example.com", "message": "Chamado de visitante sem conta."})

    ticket = db_session.query(FeedbackTicket).filter(FeedbackTicket.email == "semconta999@example.com").first()
    assert ticket.user_id is None
