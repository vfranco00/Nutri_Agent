import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from app.core.config import settings
from app.core.security import create_email_verification_token, create_password_reset_token
from app.services.email_templates import (
    verification_email_html,
    subscription_expiring_email_html,
    feedback_email_html,
    password_reset_email_html,
)

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
RESEND_URL = "https://api.resend.com/emails"
VERIFICATION_SUBJECT = "Confirme seu email — NutriAgent"
PASSWORD_RESET_SUBJECT = "Redefinir sua senha — NutriAgent"
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


def _send_via_brevo(to_email: str, subject: str, html: str, reply_to: str | None = None) -> bool:
    try:
        payload = {
            "sender": {"name": "NutriAgent", "email": settings.BREVO_FROM_EMAIL},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html,
        }
        if reply_to:
            payload["replyTo"] = {"email": reply_to}

        with httpx.Client() as client:
            response = client.post(
                BREVO_URL,
                headers={"api-key": settings.BREVO_API_KEY, "Accept": "application/json"},
                json=payload,
                timeout=10.0,
            )
            if response.status_code >= 300:
                print(f"[email] Brevo retornou {response.status_code} ao enviar pra {to_email}: {response.text}")
                return False
            return True
    except httpx.HTTPError as e:
        print(f"[email] Falha ao enviar via Brevo pra {to_email}: {e}")
        return False


def _send_email(
    to_email: str, subject: str, html: str, *, fallback_log: str, reply_to: str | None = None,
) -> bool:
    """Mesma ordem de prioridade usada em todos os emails transacionais do app — e uma
    cascata de verdade: cada provedor configurado é tentado até um funcionar, em vez de
    parar no primeiro independente do resultado. SMTP (Gmail) vem primeiro mas na prática
    nunca funciona em produção (Render bloqueia porta 587 de saída). Brevo com sender único
    verificado (sem precisar de domínio) manda pra qualquer destinatário de graça — é o que
    sobra funcionando de verdade. Resend fica por último porque sem domínio verificado só
    manda pro próprio email da conta. Sem nenhum configurado, só loga no console (dev local)."""
    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        if _send_via_smtp(to_email, subject, html, reply_to):
            return True

    if settings.BREVO_API_KEY and settings.BREVO_FROM_EMAIL:
        if _send_via_brevo(to_email, subject, html, reply_to):
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


def send_password_reset_email(to_email: str) -> bool:
    """Gera o token de reset e envia o link — mesmo padrão de send_verification_email."""
    token = create_password_reset_token(to_email)
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = password_reset_email_html(to_email, reset_url)
    return _send_email(
        to_email, PASSWORD_RESET_SUBJECT, html,
        fallback_log=f"Link de redefinição de senha para {to_email}: {reset_url}",
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
