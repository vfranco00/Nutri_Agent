# ROPA: Registro das Operações de Tratamento (Art. 37 da LGPD)

> **Rascunho para revisão jurídica.** Não foi revisado por advogado nem pelo encarregado.

- **Versão:** 1.0 (rascunho), 2026-11-05
- **Base:** `docs/lgpd/auditoria-2026-11.md` (seções 2 a 4 e 10)
- **Revisão:** semestral, ou a cada nova atividade, finalidade ou operador

## 1. Contatos

| Papel | Dados |
|---|---|
| Controlador | [[CONTROLADOR]], CNPJ [[CNPJ]] |
| Encarregado | [[ENCARREGADO_NOME]], [[ENCARREGADO_EMAIL]] |
| Operadores | ver `docs/lgpd/operadores.md` |
| Enquadramento | agente de pequeno porte (Res. CD/ANPD 2/2022): **a confirmar**. Dado sensível em escala e decisão automatizada podem retirar a dispensa; tratar o RIPD como obrigatório |

## 2. Categorias de titulares

Usuários do Nuvi (maiores de 18 anos); visitantes que abrem chamado; pagadores (os mesmos usuários).

## 3. Atividades como controlador

Finalidades de consentimento usam o vocabulário do app: `saude`, `ia`, `push`, `ranking`, `marketing`. Dados: D1 a D24 da auditoria. **S** = sensível.

| # | Atividade | Finalidade | Dados | Base legal | Fonte | Compartilhamento | Retenção | Decisão automatizada |
|---|---|---|---|---|---|---|---|---|
| A1 | Conta, login, verificação de e-mail, recuperação de senha | conta | e-mail, nome, hash Argon2, datas, `is_verified` | Art. 7º, V | titular | Supabase, Render, Vercel, Brevo | enquanto a conta existir; não verificada: 30 dias | não |
| A2 | Perfil e meta calórica | `saude` | idade, peso, altura, sexo, atividade, objetivo, dieta, alergias, gostos (**S**) | Art. 11, I | titular | Supabase, Render | enquanto a conta existir | **sim**: meta calculada por regra; ajuste manual possível |
| A3 | Diário alimentar, água, peso, alimentos pessoais, refeições prontas | `saude` | D5 a D9 (**S**) | Art. 11, I | titular | Supabase, Render | enquanto a conta existir | não |
| A4 | Cardápios, receitas e listas de compras | `saude` e `ia` | D10 (**S**) | Art. 11, I | titular e Gemini | Supabase, Render, Google | enquanto a conta existir | **sim** (IA) |
| A5 | Cardápio e receitas por IA: envio do perfil ao Gemini | `ia` | objetivo, dieta, alergias, gostos, meta, ingredientes (**S**) | Art. 11, I; Art. 33, VIII | titular | Google (exterior) | não guardado pelo Nuvi além do resultado; guarda no Google: a confirmar | **sim** |
| A6 | Agente: texto ou foto do prato | `ia` | D11 (**S**) | Art. 11, I; Art. 33, VIII | titular | Google (exterior) | foto e texto não persistem no Nuvi | **sim** |
| A7 | Resolução de alimento desconhecido | `ia` | nome do alimento e unidade (D12) | Art. 11, I | titular | Google; cache em Supabase | cache: 90 dias sem uso, ou órfão | não |
| A8 | Consulta de código de barras | `saude` | código (D13) | Art. 11, I | titular | Open Food Facts (terceiro); cache em Supabase | cache: 90 dias sem uso, ou órfão | não |
| A9 | Cobrança e assinatura | contrato | plano, status, `mp_subscription_id`, cobranças (D14, D15, D23) | Art. 7º, V e II | titular e Mercado Pago | Mercado Pago, Supabase | 5 anos (a confirmar com contador); anonimizado na exclusão | não |
| A10 | Cota de uso do plano | contrato | `usage_events` (D16) | Art. 7º, V | sistema | Supabase | 12 meses | não |
| A11 | Atendimento | contrato / **legítimo interesse** (visitante) | nome, e-mail, mensagem (D17; pode conter **S**) | Art. 7º, V e IX | titular ou visitante | Supabase, Brevo | fechados: 24 meses | não |
| A12 | Ranking da comunidade | `ranking` | primeiro nome, pontuação | Art. 7º, I | sistema | outros usuários logados | enquanto a conta existir e a permissão estiver ligada | não |
| A13 | Receitas públicas | `saude` | receita marcada como pública | Art. 7º, I | titular | outros usuários | enquanto a conta existir | não |
| A14 | Lembretes e push | `push` | assinatura de push, tipo e hora do lembrete, fuso (D24) | Art. 7º, I | titular | FCM (Google), Mozilla ou Apple | sem envio com sucesso há 90 dias; apagado ao revogar e ao excluir | não |
| A15 | Segurança, limite de taxa, registros | segurança | IP, User-Agent, URL, user_id em log (D21) | Art. 7º, IX (**legítimo interesse**; LIA pendente) | infraestrutura | Render, Vercel | prazo dos provedores: a confirmar | não |
| A16 | Armazenamento local no aparelho | conta | token JWT (30 min), tema, cardápio atual (D18 a D20) | Art. 7º, V | sistema | nenhum | até sair da conta | não |
| A17 | Marketing | `marketing` | e-mail, nome | Art. 7º, I | titular | nenhum hoje | **não existe hoje** | não |
| A18 | Exportação e exclusão de conta | direitos do titular | todos | Art. 18; Art. 7º, II | titular | Mercado Pago (cancelamento) | pagamento anonimizado: 5 anos | não |

## 4. Atividades como operador

Nenhuma identificada. O Nuvi trata dados como controlador.

## 5. Medidas de segurança (resumo)

Senha em Argon2; HTTPS; tokens com tipo e expiração; sessão revogada na troca de senha; limite de tentativas; registros sem conteúdo do diário (RS-26); resposta 422 sem eco do valor; foto só em memória, limite de 4 MB; cache de origem não confiável isolado por usuário (RS-17); `ondelete=CASCADE` no diário; testes de isolamento por usuário; Dependabot e CI com testes.

**Lacunas conhecidas** (auditoria, seções 13 e 14): sem CSP no frontend; JWT em `localStorage`; sem 2FA nem log de leitura no admin; sem criptografia de coluna; retenção de backup não documentada.

## 6. Transferência internacional

Google (Gemini), Vercel, Render, Brevo e Supabase: ver `docs/lgpd/operadores.md`. Mecanismo e DPA: **a confirmar**.

## 7. Avaliação de risco

RIPD: `docs/lgpd/ripd-diario-e-foto.md`. Incidentes: `docs/lgpd/incidentes.md`. Retenção: `docs/lgpd/retencao.md`.

## 8. Observações

- LIAs pendentes: segurança (A15), ranking caso a base mude para legítimo interesse, atendimento a visitante (A11).
- Antes de qualquer venda do Nuvi, rever o Art. 11, §4º e o dever de informar os titulares.

## Changelog

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-11-05 | primeira versão, a partir da auditoria |
