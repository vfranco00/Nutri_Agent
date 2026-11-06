"""L1.5: nenhum log carrega e-mail de usuário; chave do Gemini fora da URL."""
import logging

import httpx

from app.core.config import settings
from app.core.logging_config import safe_snippet
from app.services import ai, email as email_service
from tests.test_lgpd_consent import _cadastro

EMAIL = "pessoa.real@example.com"


def test_log_nao_tem_email(client, caplog, monkeypatch):
    caplog.set_level(logging.DEBUG)
    # E-mail de verdade falhando, em produção: o caminho que mais logava destinatário.
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "BREVO_API_KEY", "k")
    monkeypatch.setattr(settings, "BREVO_FROM_EMAIL", "r@example.com")

    class Resp:
        status_code = 400
        text = f'{{"message": "invalid recipient {EMAIL}"}}'

    class Cli:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def post(self, *a, **k): return Resp()

    monkeypatch.setattr(httpx, "Client", lambda *a, **k: Cli())
    email_service.send_verification_email(EMAIL)
    email_service.send_password_reset_email(EMAIL, "$argon2$x")
    email_service.send_subscription_expiring_email(EMAIL, "Plus", __import__("datetime").datetime(2026, 1, 1))

    assert _cadastro(client, EMAIL).status_code == 200
    client.post("/auth/login", data={"username": EMAIL, "password": "errada-errada"})
    client.post("/auth/login", data={"username": EMAIL, "password": "strongpassword123"})
    client.post("/auth/forgot-password", json={"email": EMAIL})
    client.post("/auth/resend-verification", json={"email": EMAIL})

    assert EMAIL not in caplog.text
    assert "pessoa.real" not in caplog.text


def test_safe_snippet_trunca_e_mascara_email():
    s = safe_snippet("x" * 300 + " " + EMAIL)
    assert len(s) == 200
    assert EMAIL not in safe_snippet(f"erro para {EMAIL}")


def test_chave_do_gemini_vai_no_cabecalho_e_nao_na_url(monkeypatch):
    visto = {}

    class Resp:
        status_code = 200

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]}

    class Cli:
        def __enter__(self): return self
        def __exit__(self, *a): return False

        def post(self, url, json=None, headers=None, timeout=None):
            visto.update(url=url, headers=headers)
            return Resp()

    monkeypatch.setattr(ai.httpx, "Client", lambda *a, **k: Cli())
    assert ai.call_gemini("oi") == "ok"
    assert settings.GEMINI_API_KEY not in visto["url"] and "key=" not in visto["url"]
    assert visto["headers"]["x-goog-api-key"] == settings.GEMINI_API_KEY


def test_resposta_de_erro_do_gemini_nao_vaza_no_log(monkeypatch, caplog):
    class Resp:
        status_code = 400
        text = f"prompt com {EMAIL} " + "y" * 600

    class Cli:
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def post(self, *a, **k): return Resp()

    monkeypatch.setattr(ai.httpx, "Client", lambda *a, **k: Cli())
    with caplog.at_level(logging.ERROR):
        assert ai.call_gemini("oi") is None
    assert EMAIL not in caplog.text
    assert max(len(r.getMessage()) for r in caplog.records) < 260
