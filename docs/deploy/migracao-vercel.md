# Migração da API do Nuvi: Render para Vercel

A API (pasta `backend/`) passa a rodar na Vercel, no projeto **`nuvi-api`**, no endereço `https://nuvi-api.vercel.app`.
Se esse nome já estiver ocupado, o endereço será `https://meunuvi-api.vercel.app`. Nos passos abaixo, troque o endereço se for o caso.

Os valores dos segredos **não** estão neste guia. Os que foram gerados (`SECRET_KEY` opcional, `VAPID_*`, `CRON_SECRET`) estão no arquivo `segredos-nuvi.txt` que te passei.

## 1. Variáveis secretas no projeto `nuvi-api` (Vercel)

Vercel → projeto `nuvi-api` → Settings → Environment Variables → ambiente **Production**.

| Variável | Onde pegar |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → **Transaction pooler** (porta 6543). Troque `[YOUR-PASSWORD]` pela senha do banco. |
| `SECRET_KEY` | Gere uma com `python3 -c "import secrets;print(secrets.token_urlsafe(48))"`. Atenção: ao trocar a chave, todo mundo precisa entrar de novo. |
| `GEMINI_API_KEY` | Google AI Studio → Get API key. Recomendo usar o plano pago, por causa da política de privacidade (no plano gratuito o Google pode usar os dados para treinar modelos). |
| `BREVO_API_KEY` | Brevo → SMTP & API → API keys. |
| `BREVO_FROM_EMAIL` | E-mail remetente já verificado no Brevo. |
| `MERCADO_PAGO_ACCESS_TOKEN` | Mercado Pago → Suas integrações → sua aplicação → Credenciais de produção → Access Token. |
| `VAPID_PUBLIC_KEY` | No arquivo `segredos-nuvi.txt` que te passei. |
| `VAPID_PRIVATE_KEY` | No arquivo `segredos-nuvi.txt` que te passei. |
| `VAPID_SUBJECT` | `mailto:victorfranco02@outlook.com` |
| `CRON_SECRET` | No arquivo `segredos-nuvi.txt` que te passei. |

Não cadastre `ENVIRONMENT`, `FRONTEND_URL`, `CORS_ORIGINS` nem `TRUSTED_PROXY_COUNT` por aqui, a menos que a sessão principal peça: ela cuida do que depende do código.

## 2. Segredos do GitHub

GitHub → `vfranco00/nuvi` → Settings → Secrets and variables → Actions.

Aba **Secrets**:

- `DATABASE_URL`: a conexão do banco usada pelas migrações (workflow `Migrações`). Para migração, prefira a **conexão direta** ou o **Session pooler** (porta 5432), não o Transaction pooler (6543), que não lida bem com mudanças de estrutura. O runner do GitHub só usa IPv4; se a conexão direta não resolver, use o Session pooler (`...pooler.supabase.com:5432`).
- `CRON_SECRET`: o mesmo valor cadastrado na Vercel.

Aba **Variables**:

- `NUVI_API_URL` = `https://nuvi-api.vercel.app` (ou o endereço `meunuvi-api` se for o caso). Sem barra no final.

Sem o segredo `DATABASE_URL`, o workflow de migrações só avisa e termina sem erro.

## 3. Mercado Pago

Se houver URL de notificação (webhook) cadastrada no painel (Suas integrações → sua aplicação → Webhooks / Notificações), troque para:

`https://nuvi-api.vercel.app/subscriptions/webhook/mercadopago`

(ou `meunuvi-api` se for o caso). Se não houver nenhuma cadastrada, não precisa fazer nada.

## 4. Ordem

1. Cadastrar as variáveis do passo 1 na Vercel (`nuvi-api`).
2. Fazer **Redeploy** do `nuvi-api` (Deployments → ... → Redeploy), para as variáveis valerem.
3. Cadastrar os segredos e a variável do GitHub (passo 2) e ajustar o Mercado Pago (passo 3).
4. Avisar a sessão principal. Ela testa a API nova e troca o site para usá-la.
5. Só no fim, com tudo funcionando, desligar o serviço no Render.
