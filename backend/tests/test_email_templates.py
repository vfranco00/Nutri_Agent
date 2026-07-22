from datetime import datetime

from app.core.config import settings
from app.services.email_templates import (
    verification_email_html,
    feedback_email_html,
    subscription_expiring_email_html,
    password_reset_email_html,
)


def test_verification_email_uses_real_logo_not_emoji():
    html = verification_email_html("user@example.com", "https://example.com/verify?token=abc")
    assert "🍎" not in html
    assert f"{settings.FRONTEND_URL}/nutri-agent-logo-horizontal.png" in html


def test_feedback_email_escapes_user_content():
    # Nome e mensagem vêm direto do usuário — precisam ser escapados, senão viram
    # HTML/markup dentro do próprio email.
    html = feedback_email_html("<b>Fulano</b>", "fulano@example.com", "bug", "<script>alert(1)</script>")
    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "&lt;b&gt;Fulano&lt;/b&gt;" in html


def test_feedback_email_preserves_line_breaks_in_message():
    html = feedback_email_html("Fulano", "fulano@example.com", "duvida", "linha 1\nlinha 2")
    assert "linha 1<br>linha 2" in html


def test_feedback_email_defaults_name_when_missing():
    html = feedback_email_html(None, "anonimo@example.com", "outro", "mensagem qualquer aqui")
    assert "Não informado" in html


def test_feedback_email_translates_category_label():
    html = feedback_email_html("Fulano", "f@example.com", "sugestao", "ideia legal")
    assert "Sugestão" in html


def test_feedback_email_uses_real_logo():
    html = feedback_email_html("Fulano", "f@example.com", "bug", "algo quebrou")
    assert "🍎" not in html
    assert "nutri-agent-logo-horizontal.png" in html


def test_subscription_expiring_email_uses_real_logo():
    html = subscription_expiring_email_html("Plus", datetime(2026, 8, 1))
    assert "🍎" not in html
    assert "nutri-agent-logo-horizontal.png" in html


def test_password_reset_email_includes_reset_url():
    html = password_reset_email_html("user@example.com", "https://example.com/reset-password?token=abc")
    assert "https://example.com/reset-password?token=abc" in html
    assert "user@example.com" in html


def test_password_reset_email_uses_real_logo():
    html = password_reset_email_html("user@example.com", "https://example.com/reset-password?token=abc")
    assert "🍎" not in html
    assert "nutri-agent-logo-horizontal.png" in html
