import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from app.core.config import settings
from app.core.security import create_email_verification_token
from app.services.email_templates import (
    verification_email_html,
    subscription_expiring_email_html,
    feedback_email_html,
)

RESEND_URL = "https://api.resend.com/emails"
VERIFICATION_SUBJECT = "Confirme seu email — NutriAgent"
FEEDBACK_TO_EMAIL = "victorfranco02@outlook.com"


def _send_via_smtp(to_email: str, subject: str, html: str, reply_to: str | None = None) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_USER
        msg["To"] = to_email
        if reply_to:
            msg["Reply-To"] = reply_to
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


def _send_via_resend(to_email: str, subject: str, html: str, reply_to: str | None = None) -> bool:
    try:
        payload = {
            "from": settings.RESEND_FROM_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        if reply_to:
            payload["reply_to"] = reply_to

        with httpx.Client() as client:
            response = client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json=payload,
                timeout=10.0,
            )
            if response.status_code >= 300:
                print(f"[email] Resend retornou {response.status_code} ao enviar pra {to_email}: {response.text}")
                return False
            return True
    except httpx.HTTPError as e:
        print(f"[email] Falha ao enviar via Resend pra {to_email}: {e}")
        return False


def _send_email(
    to_email: str, subject: str, html: str, *, fallback_log: str, reply_to: str | None = None,
) -> bool:
    """Mesma ordem de prioridade usada em todos os emails transacionais do app — e uma
    cascata de verdade: se o SMTP (Gmail, grátis, manda pra qualquer destinatário) está
    configurado mas falha (porta bloqueada, credencial revogada, etc.), tenta o Resend
    antes de desistir, em vez de parar no primeiro provedor configurado independente do
    resultado. Resend sozinho só manda pro próprio email da conta enquanto não tiver
    domínio verificado — por isso é o segundo da fila, não o primeiro. Sem nenhum dos
    dois configurado, só loga no console (dev local)."""
    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        if _send_via_smtp(to_email, subject, html, reply_to):
            return True

    if settings.RESEND_API_KEY:
        if _send_via_resend(to_email, subject, html, reply_to):
            return True

    print(f"[email] Nenhum provedor de email conseguiu enviar. {fallback_log}")
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


def send_feedback_email(name: str | None, email: str, category: str, message: str) -> bool:
    """Manda o chamado de ajuda/feedback pro email do Franco, com Reply-To pro email de
    quem abriu o chamado — responder o email já cai direto pro usuário."""
    subject = f"[NutriAgent] Novo chamado: {category}"
    html = feedback_email_html(name, email, category, message)
    return _send_email(
        FEEDBACK_TO_EMAIL, subject, html,
        fallback_log=f"Chamado de {email} ({category}): {message}",
        reply_to=email,
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
