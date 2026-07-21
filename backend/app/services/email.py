import httpx
from app.core.config import settings
from app.core.security import create_email_verification_token
from app.services.email_templates import verification_email_html

RESEND_URL = "https://api.resend.com/emails"


def send_verification_email(to_email: str) -> bool:
    """Gera o token de verificação e envia o email via Resend.

    Se RESEND_API_KEY não estiver configurada (ou a chamada falhar), cai num
    fallback que só loga o link no console — permite testar o fluxo inteiro
    localmente sem depender de envio real de email.
    """
    token = create_email_verification_token(to_email)
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    if not settings.RESEND_API_KEY:
        print(f"[email] RESEND_API_KEY não configurada. Link de verificação para {to_email}: {verify_url}")
        return False

    try:
        with httpx.Client() as client:
            response = client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": [to_email],
                    "subject": "Confirme seu email — NutriAgent",
                    "html": verification_email_html(to_email, verify_url),
                },
                timeout=10.0,
            )
            if response.status_code >= 300:
                print(f"[email] Resend retornou {response.status_code} ao enviar pra {to_email}: {response.text}")
                return False
            return True
    except httpx.HTTPError as e:
        print(f"[email] Falha ao enviar via Resend pra {to_email}: {e}")
        return False
