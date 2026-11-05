# Correção das lacunas LGPD: plano para as sessões

> Para quem executa: leia **primeiro** o relatório `docs/lgpd/auditoria-2026-11.md` (seções 7 a 15) e as regras de `docs/superpowers/plans/2026-11-05-nuvi-continuacao.md`. Elas valem aqui também: posse, rebase e testes antes de cada push, `git push origin HEAD:main` sem `--force`, Alembic em linha e o rodapé de commit indicado lá.
>
> Execute com superpowers:executing-plans, em TDD. As skills do plugin `lgpd-skills` (`lgpd-consent-schema`, `lgpd-dsar`, `lgpd-retention-erasure`, `lgpd-privacy-policy`, `lgpd-ropa`, `lgpd-ripd`, `lgpd-incident-response` e `lgpd-dpo-encarregado`) são a referência normativa de cada parte.

**Fica fora deste plano (depende do Franco, não de código):**
- G-04: região e plano pago do Gemini;
- G-14: DPAs arquivados;
- G-18: retenção dos backups do Supabase;
- designar o encarregado e definir quem é o controlador;
- revisão jurídica dos textos.

Os documentos usam os marcadores `[[CONTROLADOR]]`, `[[CNPJ]]`, `[[ENCARREGADO_NOME]]` e `[[ENCARREGADO_EMAIL]]`, que o Franco preenche depois.

Há três sessões, com posse disjunta. **L1** e **L2** começam já. **L3** também pode começar, porque a F6 está na `main` (`97dc94f`).

---

## L1: backend LGPD

**Posse:**
- Criar: `app/models/consent.py`, `app/schemas/consent.py`, `app/routers/consents.py`, `app/routers/privacy.py`, `app/services/account_erasure.py`, `app/services/data_export.py`, `app/services/retention.py` e `app/core/legal.py`.
- Alterar, com mudança mínima: `app/models/user.py`, `models/payment.py`, `models/feedback.py` e o modelo de `usage_events` (ondelete e cascade); `routers/users.py`; `schemas/profile.py` e `schemas/user.py` (idade); `core/scheduler.py`; `routers/ai.py` e `services/ai.py` (log e consentimento); `routers/agent.py` (consentimento); `routers/push.py` e `routers/internal.py` (consentimento e texto); os pontos de log com e-mail; `services/email*.py` (remover Resend e SMTP sem uso).
- Testes em `tests/test_lgpd_*.py`.

### L1.1 Registro de consentimento (G-01)

- `app/core/legal.py`:
  - `POLICY_VERSION = "2026-11-v1"`;
  - `Purpose = Literal["saude", "ia", "push", "ranking", "marketing"]`;
  - `REQUIRED_PURPOSES = ("saude",)`.
- Tabela `consents`, **só de inserção**: `id`, `user_id` (FK com `ondelete=CASCADE`), `purpose`, `granted: bool`, `policy_version`, `created_at`, `source` (`'cadastro' | 'primeiro_uso' | 'perfil'`) e `ip_hash` (SHA-256 do IP com o `SECRET_KEY` como sal). O estado atual de cada finalidade é o último evento.
- `GET /consents/me` → `{ policy_version, items: [{ purpose, granted, at }] }`, com todas as finalidades; as que nunca receberam resposta vêm como `granted=false` e `at=null`.
- `POST /consents/me` com `{ purpose, granted, source }` → o mesmo formato do GET. Grava um evento novo; nunca atualiza.
- `POST /users/` (cadastro) passa a exigir `accepted_policy_version == POLICY_VERSION` e `consent_saude == true` (senão, `422`). Grava o evento de `saude` com a origem `cadastro`.
- **Efeito real da finalidade:**
  - **`ia`:** sem ela, as rotas que mandam dado ao Gemini (`/ai/*` com perfil ou foto, e `/agent/parse`) respondem `403 {"detail":"consent_required","purpose":"ia"}`.
  - **`push`:** sem ela, `POST /push/subscribe` responde `403` com o mesmo formato; ao revogar, as inscrições do usuário são apagadas.
  - **`ranking`:** sem ela, o usuário não aparece em `/users/leaderboard`. O padrão é não aparecer, e isso fecha também a G-15.
  - **`saude`** não se revoga pela rota: revogar a finalidade de saúde é apagar a conta. A rota responde `409` com uma mensagem apontando para a exclusão.
- **Testes:**
  - `test_cadastro_sem_aceite_422`;
  - `test_cadastro_grava_consentimento_saude`;
  - `test_ia_sem_consentimento_403`;
  - `test_revogar_push_apaga_inscricoes`;
  - `test_ranking_padrao_oculto`;
  - `test_consentimento_e_append_only`.

### L1.2 Exportação e exclusão pelo titular (G-03)

- `GET /privacy/export` → JSON com perfil, usuário (sem `hashed_password`), diário, peso, água, lembretes, alimentos pessoais, refeições prontas, receitas, cardápios, listas de compras, consentimentos, assinatura e pagamentos (sem dados de cartão).
  - Cabeçalho `Content-Disposition: attachment; filename="nuvi-meus-dados.json"`.
  - Rate limit de 3 por hora.
- `DELETE /privacy/account` com `{ password }` (reautenticação), em `services/account_erasure.py`, numa transação:
  1. cancelar a assinatura recorrente no Mercado Pago (`preapproval`). Se o MP falhar, responder `502` e não apagar nada;
  2. **anonimizar** `payments` (`user_id=NULL`, guardando `mp_payment_id`, valor e data; base no Art. 16, I);
  3. apagar `usage_events` e `feedback_tickets` (ou anonimizar o texto dos chamados);
  4. apagar as inscrições de push;
  5. apagar o usuário, com cascata no resto;
  6. linhas de `food_cache` criadas pelo usuário: apagar as de origem `llm` ou `openfoodfacts` que só ele usava.
- Corrigir as FKs sem `ondelete` (`payments`, `usage_events`, `feedback_tickets`) com migração. `DELETE /users/{id}` (admin) passa a usar o mesmo serviço.
- **Testes, também em Postgres** (como o `test_migrations`):
  - `test_exclusao_com_pagamento_evento_e_chamado`;
  - `test_exclusao_cancela_mp_antes`;
  - `test_falha_mp_nao_apaga`;
  - `test_exportacao_sem_senha_hash`;
  - `test_exportacao_isolada_por_usuario`.

### L1.3 Menores (G-07)

- No cadastro e no perfil, `age` passa a ser `Field(ge=18, le=120)`.
- Mensagem do `422`: "O Nuvi é para maiores de 18 anos."
- Teste: `test_idade_menor_de_18_422`.

### L1.4 Retenção (G-08 e G-17)

Em `services/retention.py`, um job diário registrado em `core/scheduler.py` e também exposto em `POST /internal/retention/run`, com o `X-Cron-Secret` que já existe. Adicionar um passo ao `.github/workflows/lembretes.yml`, uma vez por dia às 3h UTC.

| Dado | Regra |
|---|---|
| `food_cache` de origem `llm` ou `openfoodfacts` | sem uso há 90 dias, ou órfão |
| `usage_events` | mais de 12 meses |
| conta não verificada | mais de 30 dias |
| `feedback_tickets` fechados | mais de 24 meses |
| `push_subscriptions` | sem envio com sucesso há 90 dias |

Teste: um teste por regra, com datas fixas.

### L1.5 Logs e operadores (G-10 e G-13)

- Trocar o e-mail por `user_id` em todo log (`grep -rn "email" app | grep -i log` serve de ponto de partida).
- Truncar o `response.text` de terceiros em log a 200 caracteres, sem o corpo enviado.
- Chave do Gemini no cabeçalho `x-goog-api-key`, nunca na URL.
- Remover Resend e SMTP do Gmail, se não forem usados (confirmar pelo `config.py` e pelo envio atual, que é pelo Brevo).
- Teste: `test_log_nao_tem_email` (`caplog` no login e no cadastro).

### L1.6 Texto do push (G-20)

Notificações só com texto genérico, sem número nem dado de saúde: "Hora de registrar seu almoço", "Hora de beber água", "Hora de registrar seu peso".

Teste: `test_payload_push_sem_dado_de_saude`.

**Pronto quando:** L1.1 a L1.6 estiverem na `main`, com a suíte passando e uma única cabeça do Alembic. A mensagem final traz os contratos (rotas e formatos) que a L3 usa.

---

## L2: documentos LGPD (sem código de aplicação)

**Posse:** `docs/lgpd/**` (menos este arquivo e a auditoria) e `frontend/src/legal/*.md`.

Use as skills do plugin, uma por documento.

1. `frontend/src/legal/politica-de-privacidade.md` (v1, `2026-11-v1`), com os 7 elementos do Art. 9º, seguindo a seção 11 da auditoria:
   - finalidades iguais às de `Purpose`;
   - operadores e países: Google/Gemini, Render, Vercel, Supabase, Brevo, Mercado Pago, Open Food Facts e os serviços de push (FCM, Mozilla, Apple);
   - direitos e como exercer: tela Privacidade, exportar, excluir, e o e-mail do encarregado;
   - retenção conforme a L1.4;
   - "18+";
   - aviso de que o app não substitui orientação médica ou nutricional (G-19).
2. `frontend/src/legal/termos-de-uso.md` (v1).
3. `docs/lgpd/ropa.md` (Art. 37), `docs/lgpd/ripd-diario-e-foto.md` (Art. 38), `docs/lgpd/incidentes.md` (Res. 15/2024: prazo de 3 dias úteis, os 12 itens para a ANPD e os 7 para o titular, registro por 5 anos), `docs/lgpd/retencao.md`, `docs/lgpd/operadores.md` (matriz com país, mecanismo de transferência e status do DPA "a confirmar") e `docs/lgpd/encarregado.md` (minuta de designação).
4. `docs/lgpd/pendencias-do-franco.md`: checklist curto do que só ele pode fazer (G-04, G-14, G-18, controlador, encarregado, revisão jurídica, Art. 11 §4º na venda).

Todos os textos ficam em português claro, com os marcadores `[[...]]` onde faltar dado, e o cabeçalho "Rascunho para revisão jurídica".

**Pronto quando:** os arquivos estiverem na `main`.

---

## L3: frontend LGPD

**Posse:**
- Criar: `src/pages/legal/Politica.tsx` e `Termos.tsx` (renderizam os `.md` da L2 com `?raw` e um conversor de Markdown leve, ou à mão; não usar `dangerouslySetInnerHTML` sem sanitizar), `src/pages/perfil/Privacidade.tsx`, `src/components/consent/ConsentGate.tsx` e `src/lib/consents.ts`.
- Alterar, com mudança mínima dita no commit: `src/routes.ts` e `App.tsx` (as rotas `/privacidade`, `/termos` e `/perfil/privacidade`); `pages/Register.tsx` (as caixas de aceite); o menu do avatar ou o `Profile` (link para Privacidade); `frontend/index.html` (fontes locais); `frontend/vercel.json` (CSP); `frontend/public/fonts/*`.

**Entrega:**
- **Cadastro:**
  - caixa obrigatória "Li e aceito a Política de Privacidade e os Termos de Uso";
  - caixa obrigatória e destacada "Autorizo o tratamento dos meus dados de saúde (peso, medidas, diário) para calcular metas e registrar refeições";
  - texto "Para maiores de 18 anos";
  - envia `accepted_policy_version` e `consent_saude`.
- **`ConsentGate purpose="ia" | "push"`:** no primeiro uso do Agente, do Gerar cardápio, do Chef e da foto, ou ao ligar lembretes, abre um `Sheet` que explica o que vai para onde (por exemplo, "o texto e a foto vão para o Google Gemini, nos EUA"), com os botões "Permitir" e "Agora não". Também trata o `403 consent_required` da API, abrindo o mesmo `Sheet`.
- **Privacidade (`/perfil/privacidade`):**
  - um `Switch` por finalidade, com o mesmo esforço para ligar e desligar;
  - "Baixar meus dados", que chama `GET /privacy/export`;
  - "Excluir minha conta": `Dialog` com a senha e o texto do que é apagado e do que é anonimizado.
- **Rodapé da Landing e do login** com os links para a Política e os Termos.
- **G-09:** DM Sans e Nunito servidas de `public/fonts` (woff2), sem `fonts.googleapis.com`.
- **G-11:** CSP no `vercel.json`, com `default-src 'self'`, `connect-src` para a API, Mercado Pago e Open Food Facts, `img-src 'self' data: https:` e `frame-ancestors 'none'`. Confira no navegador interno que nada quebra.

**Testes:**
- cadastro sem as caixas não envia;
- `ConsentGate` abre com o `403`;
- o switch chama `POST /consents/me`;
- a exclusão pede senha.

**Pronto quando:** tudo isso estiver na `main` e conferido no navegador interno a 375 px e a 1280 px. Se a L1 ainda não tiver subido os contratos, simule a API nos testes e confira o fluxo real quando ela chegar.
