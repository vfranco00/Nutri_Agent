import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from app.core.config import settings
from app.core.security import create_email_verification_token
from app.services.email_templates import verification_email_html, subscription_expiring_email_html

RESEND_URL = "https://api.resend.com/emails"
VERIFICATION_SUBJECT = "Confirme seu email — NutriAgent"


def _send_via_smtp(to_email: str, subject: str, html: str) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_USER
        msg["To"] = to_email
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, [to_email], msg.as_string())
        return True
    except (smtplib.SMTPException, OSError) as e:
        # OSError cobre falhas de conexão (timeout, DNS, porta bloqueada pelo host) —
        # smtplib.SMTPException sozinho não pega isso, e sem esse catch o registro
        # de usuário quebrava inteiro (500) quando o SMTP não conseguia nem conectar.
        print(f"[email] Falha ao enviar via SMTP pra {to_email}: {e}")
        return False


def _send_via_resend(to_email: str, subject: str, html: str) -> bool:
    try:
        with httpx.Client() as client:
            response = client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={
                    "from": settings.RESEND_FROM_EMAIL,
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
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


def _send_email(to_email: str, subject: str, html: str, *, fallback_log: str) -> bool:
    """Mesma ordem de prioridade usada em todos os emails transacionais do app:
    SMTP (Gmail, grátis, manda pra qualquer destinatário) -> Resend (só manda pro
    próprio email da conta enquanto não tiver domínio verificado) -> fallback que só
    loga no console (útil em dev local sem nenhuma das duas credenciais configuradas)."""
    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        return _send_via_smtp(to_email, subject, html)

    if settings.RESEND_API_KEY:
        return _send_via_resend(to_email, subject, html)

    print(f"[email] Nenhum provedor de email configurado. {fallback_log}")
    return False


def send_verification_email(to_email: str) -> bool:
    """Gera o token de verificação e envia o email de confirmação."""
    token = create_email_verification_token(to_email)
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = verification_email_html(to_email, verify_url)
    return _send_email(
        to_email, VERIFICATION_SUBJECT, html,
        fallback_log=f"Link de verificação para {to_email}: {verify_url}",
    )


def send_subscription_expiring_email(to_email: str, plan_label: str, expires_at: datetime) -> bool:
    """Aviso de que a assinatura vence em até 7 dias — mandado uma vez por ciclo
    (ver app/services/subscription_lifecycle.py)."""
    subject = f"Sua assinatura {plan_label} vence em breve — NutriAgent"
    html = subscription_expiring_email_html(plan_label, expires_at)
    return _send_email(
        to_email, subject, html,
        fallback_log=f"Assinatura {plan_label} de {to_email} vence em {expires_at}.",
    )
