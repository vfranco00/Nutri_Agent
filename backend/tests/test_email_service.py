from unittest.mock import MagicMock, patch

import httpx

from app.core.config import settings
from app.services import email as email_service


def test_send_verification_email_returns_false_without_any_provider(monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "")
    monkeypatch.setattr(settings, "BREVO_FROM_EMAIL", "")

    ok = email_service.send_verification_email("destino@example.com")
    assert ok is False


def test_brevo_send_success(monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "chave-brevo")
    monkeypatch.setattr(settings, "BREVO_FROM_EMAIL", "remetente@example.com")
    captured = {}

    class FakeResponse:
        status_code = 201
        text = ""

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, headers=None, json=None, timeout=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            return FakeResponse()

    with patch("httpx.Client", return_value=FakeClient()):
        ok = email_service._send_via_brevo("destino@example.com", "Assunto", "<p>oi</p>")

    assert ok is True
    assert captured["url"] == email_service.BREVO_URL
    assert captured["headers"]["api-key"] == "chave-brevo"
    assert captured["json"]["sender"]["email"] == "remetente@example.com"
    assert captured["json"]["to"] == [{"email": "destino@example.com"}]


def test_brevo_send_includes_reply_to_when_provided(monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "chave-brevo")
    monkeypatch.setattr(settings, "BREVO_FROM_EMAIL", "remetente@example.com")
    captured = {}

    class FakeResponse:
        status_code = 201
        text = ""

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, headers=None, json=None, timeout=None):
            captured["json"] = json
            return FakeResponse()

    with patch("httpx.Client", return_value=FakeClient()):
        email_service._send_via_brevo("destino@example.com", "Assunto", "<p>oi</p>", reply_to="user@example.com")

    assert captured["json"]["replyTo"] == {"email": "user@example.com"}


def test_brevo_send_handles_non_success_status(monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "chave-brevo")
    monkeypatch.setattr(settings, "BREVO_FROM_EMAIL", "remetente@example.com")

    class FakeResponse:
        status_code = 400
        text = '{"message": "erro qualquer"}'

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, *args, **kwargs):
            return FakeResponse()

    with patch("httpx.Client", return_value=FakeClient()):
        ok = email_service._send_via_brevo("destino@example.com", "Assunto", "<p>oi</p>")
    assert ok is False


def test_brevo_send_handles_network_failure_without_raising(monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "chave-brevo")
    monkeypatch.setattr(settings, "BREVO_FROM_EMAIL", "remetente@example.com")

    with patch("httpx.Client", side_effect=httpx.ConnectError("falha de rede")):
        ok = email_service._send_via_brevo("destino@example.com", "Assunto", "<p>oi</p>")
    assert ok is False


def test_send_subscription_expiring_email_uses_same_fallback_chain(monkeypatch):
    from datetime import datetime

    monkeypatch.setattr(settings, "BREVO_API_KEY", "chave-brevo")
    monkeypatch.setattr(settings, "BREVO_FROM_EMAIL", "remetente@example.com")

    called = {}

    def fake_brevo(to_email, subject, html, reply_to=None):
        called["subject"] = subject
        return True

    monkeypatch.setattr(email_service, "_send_via_brevo", fake_brevo)

    ok = email_service.send_subscription_expiring_email("destino@example.com", "Plus", datetime(2026, 8, 1))

    assert ok is True
    assert "Plus" in called["subject"]


def test_send_feedback_email_uses_reporter_email_as_reply_to(monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "chave-brevo")
    monkeypatch.setattr(settings, "BREVO_FROM_EMAIL", "remetente@example.com")

    captured = {}

    def fake_brevo(to_email, subject, html, reply_to=None):
        captured["to_email"] = to_email
        captured["subject"] = subject
        captured["reply_to"] = reply_to
        return True

    monkeypatch.setattr(email_service, "_send_via_brevo", fake_brevo)

    ok = email_service.send_feedback_email("Fulano", "fulano@example.com", "bug", "Não consigo salvar receita.")

    assert ok is True
    assert captured["to_email"] == email_service.FEEDBACK_TO_EMAIL
    assert captured["reply_to"] == "fulano@example.com"
    assert "bug" in captured["subject"]


def test_send_password_reset_email_builds_link_with_token(monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "chave-brevo")
    monkeypatch.setattr(settings, "BREVO_FROM_EMAIL", "remetente@example.com")

    captured = {}

    def fake_brevo(to_email, subject, html, reply_to=None):
        captured["to_email"] = to_email
        captured["html"] = html
        return True

    monkeypatch.setattr(email_service, "_send_via_brevo", fake_brevo)

    ok = email_service.send_password_reset_email("destino@example.com", "$argon2$hash-fake")

    assert ok is True
    assert captured["to_email"] == "destino@example.com"
    assert "/reset-password?token=" in captured["html"]
