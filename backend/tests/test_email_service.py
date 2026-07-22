import smtplib
from unittest.mock import MagicMock, patch

import httpx

from app.core.config import settings
from app.services import email as email_service


def test_smtp_send_success(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_USER", "bot@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "senha-de-app")

    fake_server = MagicMock()
    with patch("smtplib.SMTP") as mock_smtp:
        mock_smtp.return_value.__enter__.return_value = fake_server
        ok = email_service._send_via_smtp("destino@example.com", "Assunto", "<p>oi</p>")

    assert ok is True
    fake_server.starttls.assert_called_once()
    fake_server.login.assert_called_once_with("bot@example.com", "senha-de-app")
    fake_server.sendmail.assert_called_once()


def test_smtp_send_sets_reply_to_header(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_USER", "bot@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "senha-de-app")

    fake_server = MagicMock()
    with patch("smtplib.SMTP") as mock_smtp:
        mock_smtp.return_value.__enter__.return_value = fake_server
        email_service._send_via_smtp("destino@example.com", "Assunto", "<p>oi</p>", reply_to="user@example.com")

    sent_message = fake_server.sendmail.call_args[0][2]
    assert "Reply-To: user@example.com" in sent_message


def test_smtp_send_handles_connection_failure_without_raising():
    # Regressão do bug real em produção: falha de conexão (OSError) derrubava
    # o cadastro inteiro com 500 porque só smtplib.SMTPException era capturado.
    with patch("smtplib.SMTP", side_effect=OSError("conexão recusada")):
        ok = email_service._send_via_smtp("destino@example.com", "Assunto", "<p>oi</p>")
    assert ok is False


def test_smtp_send_handles_auth_failure():
    fake_server = MagicMock()
    fake_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"bad credentials")
    with patch("smtplib.SMTP") as mock_smtp:
        mock_smtp.return_value.__enter__.return_value = fake_server
        ok = email_service._send_via_smtp("destino@example.com", "Assunto", "<p>oi</p>")
    assert ok is False


def test_send_verification_email_prefers_smtp_over_resend(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_USER", "bot@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "senha")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_algumachave")

    called = {}

    def fake_smtp(to_email, subject, html, reply_to=None):
        called["smtp"] = True
        return True

    def fake_resend(to_email, subject, html, reply_to=None):
        called["resend"] = True
        return True

    monkeypatch.setattr(email_service, "_send_via_smtp", fake_smtp)
    monkeypatch.setattr(email_service, "_send_via_resend", fake_resend)

    email_service.send_verification_email("destino@example.com")

    assert called.get("smtp") is True
    assert "resend" not in called


def test_send_verification_email_falls_back_to_resend_without_smtp(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_USER", "")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_algumachave")

    called = {}
    monkeypatch.setattr(
        email_service, "_send_via_resend",
        lambda to_email, subject, html, reply_to=None: called.setdefault("resend", True) or True,
    )

    ok = email_service.send_verification_email("destino@example.com")

    assert ok is True
    assert called.get("resend") is True


def test_send_verification_email_falls_back_to_resend_when_smtp_fails(monkeypatch):
    # Regressão do bug real: antes, se o SMTP estava configurado mas falhava (porta
    # bloqueada no Render, credencial revogada, etc.), o código nunca tentava o Resend —
    # só caía pro Resend se SMTP não tivesse credencial nenhuma configurada.
    monkeypatch.setattr(settings, "SMTP_USER", "bot@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "senha")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_algumachave")

    called = {}
    monkeypatch.setattr(email_service, "_send_via_smtp", lambda *a, **kw: False)
    monkeypatch.setattr(
        email_service, "_send_via_resend",
        lambda to_email, subject, html, reply_to=None: called.setdefault("resend", True) or True,
    )

    ok = email_service.send_verification_email("destino@example.com")

    assert ok is True
    assert called.get("resend") is True


def test_send_verification_email_returns_false_without_any_provider(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_USER", "")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "")
    monkeypatch.setattr(settings, "RESEND_API_KEY", "")

    ok = email_service.send_verification_email("destino@example.com")
    assert ok is False


def test_resend_send_handles_non_success_status(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_algumachave")

    class FakeResponse:
        status_code = 422
        text = '{"message": "erro qualquer"}'

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, *args, **kwargs):
            return FakeResponse()

    with patch("httpx.Client", return_value=FakeClient()):
        ok = email_service._send_via_resend("destino@example.com", "Assunto", "<p>oi</p>")
    assert ok is False


def test_resend_send_includes_reply_to_when_provided(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_algumachave")
    captured = {}

    class FakeResponse:
        status_code = 200
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
        email_service._send_via_resend("destino@example.com", "Assunto", "<p>oi</p>", reply_to="user@example.com")

    assert captured["json"]["reply_to"] == "user@example.com"


def test_send_subscription_expiring_email_uses_same_fallback_chain(monkeypatch):
    from datetime import datetime

    monkeypatch.setattr(settings, "SMTP_USER", "bot@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "senha")

    called = {}

    def fake_smtp(to_email, subject, html, reply_to=None):
        called["subject"] = subject
        return True

    monkeypatch.setattr(email_service, "_send_via_smtp", fake_smtp)

    ok = email_service.send_subscription_expiring_email("destino@example.com", "Plus", datetime(2026, 8, 1))

    assert ok is True
    assert "Plus" in called["subject"]


def test_resend_send_handles_network_failure_without_raising(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_algumachave")

    with patch("httpx.Client", side_effect=httpx.ConnectError("falha de rede")):
        ok = email_service._send_via_resend("destino@example.com", "Assunto", "<p>oi</p>")
    assert ok is False


def test_send_feedback_email_uses_reporter_email_as_reply_to(monkeypatch):
    monkeypatch.setattr(settings, "SMTP_USER", "bot@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "senha")

    captured = {}

    def fake_smtp(to_email, subject, html, reply_to=None):
        captured["to_email"] = to_email
        captured["subject"] = subject
        captured["reply_to"] = reply_to
        return True

    monkeypatch.setattr(email_service, "_send_via_smtp", fake_smtp)

    ok = email_service.send_feedback_email("Fulano", "fulano@example.com", "bug", "Não consigo salvar receita.")

    assert ok is True
    assert captured["to_email"] == email_service.FEEDBACK_TO_EMAIL
    assert captured["reply_to"] == "fulano@example.com"
    assert "bug" in captured["subject"]
