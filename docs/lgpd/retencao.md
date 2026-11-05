# Política de retenção e descarte (Arts. 15, 16 e 18, VI da LGPD)

> **Rascunho para revisão jurídica.** Prazos marcados "a confirmar" dependem de advogado, contador ou do provedor.

- **Controlador:** [[CONTROLADOR]], CNPJ [[CNPJ]]
- **Encarregado:** [[ENCARREGADO_NOME]], [[ENCARREGADO_EMAIL]]
- **Versão:** 1.0, 2026-11-05
- **Implementação:** `backend/app/services/retention.py` (job diário, 3h UTC, e `POST /internal/retention/run`) e `services/account_erasure.py` (plano L1)

## 1. Regra geral

Retenção legal obrigatória vale mais que retenção contratual, que vale mais que o pedido de eliminação (Art. 16). Onde a lei obriga a guardar, o dado fica **bloqueado e anonimizado**, sem uso para a finalidade original, até o fim do prazo.

## 2. Tabela de retenção

| Dado | Tabela / local | Prazo | Gatilho | Ação final | Base | Implementado (L1.4) |
|---|---|---|---|---|---|---|
| Conta, perfil, diário, peso, água, alimentos, refeições prontas, receitas, cardápios, listas | `users` e filhas | enquanto a conta existir | exclusão pelo titular | apagar (cascata) | fim da finalidade (Art. 15, I e III) | exclusão pelo titular (L1.2) |
| Conta não verificada | `users` | **30 dias** | criação sem verificar o e-mail | apagar | Art. 15, I | sim |
| Conta inativa | `users` | **a definir** (sugestão: avisar com 12 meses sem login e apagar com 24) | `last_login_at` | apagar | Art. 15, I | não consta da L1.4 |
| Cache de alimento de IA ou Open Food Facts | `food_cache` (`llm`, `openfoodfacts`) | **90 dias** sem uso, ou órfão | sem uso / dono apagado | apagar | Art. 15 | sim |
| Cache `taco` e `curated` | `food_cache` | permanente | — | — | dado público, sem titular | n/a |
| Uso de plano | `usage_events` | **12 meses** | data do evento | apagar | Art. 15 | sim |
| Chamados fechados | `feedback_tickets` | **24 meses** depois de fechado | data de fechamento | apagar | Art. 7º, V e IX | sim |
| Assinaturas de push | `push_subscriptions` | **90 dias** sem envio bem-sucedido; ao revogar `push`, na hora | último sucesso / revogação | apagar | Art. 7º, I | sim |
| Consentimentos | `consents` | enquanto a conta existir; **após a exclusão, a confirmar** (prova de consentimento pode ser guardada pelo prazo de prescrição) | exclusão | apagar ou guardar anonimizado | Art. 16, IV: a confirmar com advogado | cascata (L1.1); a confirmar |
| Pagamentos | `payments` | **5 anos** (a confirmar com contador) | data do pagamento | anonimizar (`user_id=NULL`; fica `mp_payment_id`, valor e data) | Art. 16, I; obrigação fiscal | na exclusão (L1.2); expurgo ao fim do prazo: **a implementar** |
| Assinatura | `subscriptions` | até a exclusão; depois só o que o pagamento exigir | exclusão | apagar ou anonimizar | Art. 16, I | a confirmar |
| Registros de incidentes | local do registro | **5 anos** | data do incidente | apagar | Res. 15/2024, Art. 10 | n/a |
| Logs de acesso (Render, Vercel) | provedores | [[A_CONFIRMAR_PRAZO_DE_LOGS]] | — | — | Art. 7º, IX | fora do código |
| Backups (Supabase) | provedor | [[A_CONFIRMAR_RETENCAO_DE_BACKUP]] | — | expiram sozinhos | Art. 46 | fora do código |

**Marco Civil.** Aplicação de internet com fins econômicos pode ter de guardar registros de acesso por 6 meses (Lei 12.965/2014, Art. 15). Se o Nuvi se enquadra e como cumprir: **a confirmar com advogado**.

## 3. Exclusão pelo titular (Art. 18, VI)

Prazo de resposta: 15 dias (a exclusão pelo app é imediata). Passos, em uma transação:
1. cancelar a assinatura recorrente no Mercado Pago; se falhar, não apagar nada;
2. anonimizar `payments`;
3. apagar `usage_events`, `feedback_tickets` e inscrições de push;
4. apagar o usuário e as tabelas dependentes em cascata;
5. apagar do cache as linhas de IA ou Open Food Facts que só ele usava.

Ao titular informamos o que foi apagado e o que ficou anonimizado e por quê. Dados em backup somem quando o backup expira ([[A_CONFIRMAR_RETENCAO_DE_BACKUP]]); se o backup for restaurado, reexecutar as exclusões do período.

## 4. Pontos abertos

- Definir prazo de conta inativa e implementar o aviso.
- Confirmar prazo fiscal dos pagamentos com contador e criar o expurgo ao fim dele.
- Decidir o que fazer com `consents` depois da exclusão.
- Documentar retenção de logs e backups (G-18).
- Testar a exclusão no Postgres (a suíte usa SQLite).

## Changelog

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-11-05 | primeira versão |
