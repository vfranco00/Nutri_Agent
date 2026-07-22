"""
Templates de email em HTML. Usa a mesma identidade visual do frontend
(fundo escuro zinc-950/zinc-900, verde NutriAgent #16a34a/#22c55e, logo
igual à que aparece na Sidebar e nas telas de Login/Registro).

Escrito com <table> e estilos inline de propósito — é o jeito que garante
renderização consistente em clientes de email como Outlook/Gmail, que não
suportam flexbox/grid e costumam ignorar <style> no <head>.
"""
import html as _html
from datetime import datetime

from app.core.config import settings

FEEDBACK_CATEGORY_LABELS = {
    "duvida": "Dúvida",
    "bug": "Bug",
    "sugestao": "Sugestão",
    "outro": "Outro",
}


def _logo_header_html() -> str:
    # Precisa de URL absoluta — cliente de email não tem base URL pra resolver
    # caminho relativo. Mesmo arquivo servido pelo frontend em /nutri-agent-logo-horizontal.png
    # (usado também na Sidebar e no Login).
    logo_url = f"{settings.FRONTEND_URL}/nutri-agent-logo-horizontal.png"
    return (
        f'<img src="{logo_url}" alt="NutriAgent" width="180" '
        f'style="display:block;margin:0 auto 28px;width:180px;max-width:180px;height:auto;" />'
    )


def verification_email_html(to_email: str, verify_url: str) -> str:
    return f"""
    <body style="margin:0;padding:0;background-color:#09090b;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#09090b" style="background-color:#09090b;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" bgcolor="#18181b" style="max-width:480px;width:100%;background-color:#18181b;border:1px solid #27272a;border-radius:12px;">
              <tr>
                <td style="padding:40px 32px 32px;text-align:center;">
                  {_logo_header_html()}

                  <h1 style="font-size:20px;font-weight:bold;color:#fafafa;margin:0 0 12px;">Confirme seu email</h1>
                  <p style="font-size:14px;line-height:1.6;color:#a1a1aa;margin:0 0 28px;">
                    Falta pouco pra começar sua jornada nutricional. Clique no botão abaixo pra confirmar
                    <strong style="color:#e4e4e7;">{to_email}</strong> e ativar sua conta.
                  </p>

                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                    <tr>
                      <td bgcolor="#16a34a" style="border-radius:8px;">
                        <a href="{verify_url}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
                          Confirmar Email
                        </a>
                      </td>
                    </tr>
                  </table>

                  <p style="font-size:12px;color:#71717a;margin:0 0 6px;">Ou copie e cole este link no navegador:</p>
                  <p style="font-size:12px;color:#4ade80;word-break:break-all;margin:0;">{verify_url}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px;border-top:1px solid #27272a;text-align:center;">
                  <p style="font-size:12px;color:#52525b;margin:0;">
                    Se você não criou essa conta, pode ignorar este email. Este link expira em 24 horas.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    """


def feedback_email_html(name: str | None, email: str, category: str, message: str) -> str:
    # Conteúdo vem direto do usuário (nome/mensagem) — escapado pra não virar HTML/markup
    # dentro do próprio email (o cliente de email não deveria renderizar tags do usuário).
    safe_name = _html.escape(name) if name else "Não informado"
    safe_email = _html.escape(email)
    safe_message = _html.escape(message).replace("\n", "<br>")
    category_label = FEEDBACK_CATEGORY_LABELS.get(category, category)
    return f"""
    <body style="margin:0;padding:0;background-color:#09090b;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#09090b" style="background-color:#09090b;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" bgcolor="#18181b" style="max-width:480px;width:100%;background-color:#18181b;border:1px solid #27272a;border-radius:12px;">
              <tr>
                <td style="padding:40px 32px 32px;">
                  <div style="text-align:center;">
                    {_logo_header_html()}
                  </div>

                  <h1 style="font-size:20px;font-weight:bold;color:#fafafa;margin:0 0 16px;">Novo chamado de {category_label}</h1>

                  <p style="font-size:13px;color:#a1a1aa;margin:0 0 4px;">De</p>
                  <p style="font-size:14px;color:#e4e4e7;margin:0 0 16px;">{safe_name} &lt;{safe_email}&gt;</p>

                  <p style="font-size:13px;color:#a1a1aa;margin:0 0 4px;">Mensagem</p>
                  <p style="font-size:14px;line-height:1.6;color:#e4e4e7;background-color:#09090b;border:1px solid #27272a;border-radius:8px;padding:16px;margin:0;">{safe_message}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px;border-top:1px solid #27272a;text-align:center;">
                  <p style="font-size:12px;color:#52525b;margin:0;">
                    Responda este email pra falar direto com {safe_name}.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    """


def subscription_expiring_email_html(plan_label: str, expires_at: datetime) -> str:
    expires_str = expires_at.strftime("%d/%m/%Y")
    return f"""
    <body style="margin:0;padding:0;background-color:#09090b;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#09090b" style="background-color:#09090b;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" bgcolor="#18181b" style="max-width:480px;width:100%;background-color:#18181b;border:1px solid #27272a;border-radius:12px;">
              <tr>
                <td style="padding:40px 32px 32px;text-align:center;">
                  {_logo_header_html()}

                  <h1 style="font-size:20px;font-weight:bold;color:#fafafa;margin:0 0 12px;">Sua assinatura vence em breve</h1>
                  <p style="font-size:14px;line-height:1.6;color:#a1a1aa;margin:0 0 28px;">
                    Seu plano <strong style="color:#e4e4e7;">{plan_label}</strong> vence em
                    <strong style="color:#e4e4e7;">{expires_str}</strong>. Se não for renovado até lá,
                    sua conta volta automaticamente pro plano Starter (gratuito) e seus limites de uso.
                  </p>

                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                    <tr>
                      <td bgcolor="#16a34a" style="border-radius:8px;">
                        <a href="{settings.FRONTEND_URL}/planos" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
                          Gerenciar assinatura
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px;border-top:1px solid #27272a;text-align:center;">
                  <p style="font-size:12px;color:#52525b;margin:0;">
                    Se você já renovou, pode ignorar este email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    """
