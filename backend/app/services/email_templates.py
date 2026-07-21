"""
Templates de email em HTML. Usa a mesma identidade visual do frontend
(fundo escuro zinc-950/zinc-900, verde NutriAgent #16a34a/#22c55e, logo
🍎 + "NutriAgent" igual aparece na Sidebar e nas telas de Login/Registro).

Escrito com <table> e estilos inline de propósito — é o jeito que garante
renderização consistente em clientes de email como Outlook/Gmail, que não
suportam flexbox/grid e costumam ignorar <style> no <head>.
"""


def verification_email_html(to_email: str, verify_url: str) -> str:
    return f"""
    <body style="margin:0;padding:0;background-color:#09090b;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#09090b" style="background-color:#09090b;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" bgcolor="#18181b" style="max-width:480px;width:100%;background-color:#18181b;border:1px solid #27272a;border-radius:12px;">
              <tr>
                <td style="padding:40px 32px 32px;text-align:center;">
                  <div style="font-size:32px;line-height:1;margin-bottom:8px;">🍎</div>
                  <div style="font-size:20px;font-weight:bold;color:#22c55e;margin-bottom:28px;">NutriAgent</div>

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
