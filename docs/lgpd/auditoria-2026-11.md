# Auditoria LGPD do Nuvi (antigo NutriAgent) — novembro de 2026

- **Data:** 2026-11-05
- **Escopo:** `backend/` (FastAPI, SQLAlchemy, Postgres no Supabase, Gemini) e `frontend/` (React PWA), no estado da `main` no commit `46fdf56`.
- **Método:** skill `lgpd-skills:lgpd-audit` (cenário B, sistema em produção a ser auditado e retrofitado), só leitura. Nenhum código foi alterado. Lido: modelos, rotas, serviços, migrations, ADR-0001 e ADR-0002, planos de 2026-11-05 e o frontend. **Não foram lidos:** contratos e painéis de Render, Vercel, Supabase, Brevo, Mercado Pago e Google; não há como saber daqui região, plano contratado ou DPA assinado. Esses pontos aparecem como "a confirmar".
- **Aviso:** análise técnica com base na LGPD e nas resoluções da ANPD. Não é parecer jurídico. Antes de vender, revisar a base legal, a política e os contratos com advogado de proteção de dados.

> **Lembretes e push (Frente A):** ainda são só plano (`docs/superpowers/plans/2026-11-05-nuvi-agua-lembretes.md`). O código existente tem apenas `water_entries`. A seção 9 audita o **desenho** e deve ser reauditada quando o código entrar na `main`.

---

## 1. Resumo executivo

O código tem uma base de segurança melhor que a média: logs sem conteúdo do diário (RS-26), mensagens de erro e 422 sem eco do valor enviado, `ondelete=CASCADE` no diário, prompt mínimo no Gemini para alimento desconhecido, foto sem persistência, cache de terceiros isolado por usuário. O ADR-0002 já classifica o diário como dado sensível.

O problema é o que **não existe**: o Nuvi **coleta dado de saúde sem nenhum consentimento, sem política de privacidade, sem encarregado, sem rota para o usuário exportar ou apagar a própria conta, e sem contrato de transferência internacional**. Para vender, esses itens bloqueiam. A prioridade é jurídica e de produto, não de refatoração.

**As cinco lacunas mais graves:**

1. **Sem consentimento e sem base legal para dado de saúde (G-01).** Cadastro e perfil gravam peso, altura, idade, sexo, objetivo, alergias e diário sem aceite registrado. O Art. 11 da LGPD exige consentimento específico e destacado (ou outra hipótese do inciso II).
2. **Sem política de privacidade nem termos (G-02).** Nada no frontend. O ADR-0001 §8.4 lista o que a política precisa dizer, mas ninguém escreveu.
3. **Sem exportação nem exclusão pelo titular (G-03).** Só o admin apaga (`DELETE /users/{id}`), e esse caminho provavelmente falha no Postgres com pagamentos, eventos de uso ou chamados (FK sem cascade). Arts. 18, II, V e VI.
4. **Foto do prato e perfil de saúde enviados ao Gemini sem transferência internacional regularizada (G-04).** Google, Render, Vercel, Supabase, Brevo e Open Food Facts podem estar fora do Brasil, sem cláusulas-padrão da Res. 19/2024 e sem o usuário saber. A chave do Gemini é de AI Studio e o plano (gratuito ou pago) muda se o Google reutiliza o conteúdo.
5. **Sem encarregado, ROPA, RIPD, plano de incidente e registro de operadores (G-05).** Arts. 37, 38, 41 e 48 e Res. 15/2024. Dado de saúde em escala é alto risco; o RIPD é praticamente certo.

---

## 2. Mapa dos dados pessoais

Legenda de sensibilidade: **S** = dado sensível (Art. 5º, II, saúde). **P** = pessoal comum. **I** = inferência sensível (o dado, junto, revela saúde ou religião; ADR-0002 §6).

| # | Dado | Onde fica | Quem escreve | Sens. | Origem |
|---|---|---|---|---|---|
| D1 | e-mail, nome completo, hash Argon2 da senha | `users` | cadastro público (`POST /users/`) | P | titular |
| D2 | `is_verified`, `last_login_at`, `created_at`, `score`, `has_seen_onboarding` | `users` | sistema | P | sistema |
| D3 | idade, peso, altura, sexo, nível de atividade, objetivo, meta calórica, TMB, dieta, preferência por fruta | `profiles` | `PUT /profiles/me` | **S** | titular |
| D4 | alergias, gosta/não gosta (texto livre) | `profiles` | `PUT /profiles/me` | **S** / **I** | titular |
| D5 | histórico de peso (data, kg) | `weight_history` | `POST /profiles/weight` | **S** | titular |
| D6 | diário alimentar (alimento, quantidade, refeição, data, kcal e macros) | `diary_entries` | `POST /diary` | **S** / **I** (religião, transtorno, gravidez) | titular |
| D7 | vínculo cardápio↔calendário | `diary_plan_bindings` | titular | **S** | titular |
| D8 | alimentos pessoais com código de barras | `user_foods` | titular | **S** / **I** | titular |
| D9 | água bebida (ml, dia) | `water_entries` | `POST /water` | **S** | titular |
| D10 | cardápios, receitas, lista de compras (com marcação pública opcional) | `meal_plans`, `recipes`, `shopping_*` | titular / IA | **S** / **I** | titular + Gemini |
| D11 | **texto livre e foto do prato** enviados ao Agente | só em memória + Gemini; **não persiste** | `POST /agent/parse` | **S** | titular |
| D12 | nome do alimento enviado ao Gemini quando não está no catálogo (RS-28) | Gemini; resultado em `food_cache` (`llm`, escopo do usuário) | sistema | **I** | titular |
| D13 | código de barras consultado na Open Food Facts | `food_cache.off_product_id` (por usuário) | titular | **I** | titular |
| D14 | plano, status, `mp_subscription_id`, fim do período | `subscriptions` | sistema / Mercado Pago | P (financeiro) | titular + MP |
| D15 | cobranças (valor, status, `mp_payment_id`) | `payments` | webhook MP | P (financeiro) | MP |
| D16 | uso por evento (`chef_ai`, geração de cardápio) com data | `usage_events` | sistema | P | sistema |
| D17 | chamados: nome, e-mail, categoria, mensagem livre, status | `feedback_tickets` | `POST /feedback/` (rota **pública**) | P / pode conter **S** | titular ou visitante |
| D18 | token de sessão (JWT 30 min) | `localStorage` (`nutri_token`) | frontend | P | sistema |
| D19 | cardápio atual do Chef IA | `localStorage` (`nutri_current_plan`) | frontend | **S** / **I** | sistema |
| D20 | tema, sidebar | `localStorage` | frontend | — | sistema |
| D21 | IP, `User-Agent`, URL | log do Render e do Vercel; rate limit em memória | infra | P | infra |
| D22 | e-mail em log de falha de envio (`Falha ao enviar … pra <email>`) | stdout → coletor do Render | sistema | P | sistema |
| D23 | e-mail do pagador enviado ao Mercado Pago | MP | `create_subscription_checkout` | P | titular |
| D24 | futuro: assinatura push (endpoint + chaves), lembretes (tipo, hora, fuso) | `push_subscriptions`, `reminders` | Frente A | P (hábito de saúde) | titular |

**Não há:** CPF, data de nascimento (só idade em anos, que fica **congelada** e envelhece sem atualização), geolocalização, biometria, analytics, cookies de terceiros, rastreadores de publicidade.

**Pontos de vazamento lateral observados:**
- `GET /users/leaderboard` expõe **primeiro nome e pontuação** de outros usuários a qualquer logado. Baixo risco, mas é dado pessoal visível a terceiros, sem consentimento.
- `GET /admin/*` entrega e-mail de usuário em atividade, pagamentos, top usuários e chamados. Acesso por `is_superuser`, sem log de quem consultou (ver G-12).

---

## 3. Fluxo de dados e terceiros

| Terceiro | Papel LGPD | O que recebe | Onde fica | Base de transferência hoje |
|---|---|---|---|---|
| **Google (Gemini API)** | Operador | Perfil (objetivo, dieta, alergias, gostos, meta calórica) em cardápios; ingredientes do Chef IA; nome do alimento (resolve); **texto e foto do Agente** | EUA / global (a confirmar) | Nenhuma documentada |
| **Open Food Facts** | Terceiro independente (API pública, sem contrato) | Código de barras consultado. IP do servidor do Render, não do usuário | França / UE (a confirmar) | Nenhuma. O código identifica o que a pessoa come, mas a OFF não vê o usuário |
| **Render** | Operador | Todo o tráfego da API, logs e variáveis de ambiente | Região do serviço (a confirmar; costuma ser EUA) | Nenhuma documentada |
| **Vercel** | Operador | Frontend estático, IP e `User-Agent` dos visitantes, logs de borda | Rede global | Nenhuma documentada |
| **Supabase** | Operador | **Todo o banco** (D1 a D17) | Região do projeto (a confirmar; se não for `sa-east-1`, é transferência internacional) | Nenhuma documentada |
| **Brevo / Resend / SMTP Gmail** | Operador | E-mail do titular, nome (chamado), mensagem (chamado), link de verificação ou reset | UE / EUA | Nenhuma documentada |
| **Mercado Pago** | Controlador próprio dos dados financeiros (e operador da cobrança) | E-mail do pagador, plano, valor | Brasil | Dispensa Art. 33; ainda exige informação na política |
| **Google Fonts** | Terceiro | **IP e `User-Agent` de cada visitante** (`index.html` carrega `fonts.googleapis.com`) | EUA | Nenhuma. Self-hostear elimina |
| **GitHub (Actions)** | Operador técnico | Código, segredos de CI; no plano da Frente A, dispara o cron | EUA | Fora do escopo de dados do titular |

---

## 4. Base legal de cada tratamento

A coluna "Proposta" é a recomendação desta auditoria. **Hoje não há base documentada para nenhuma.**

| Tratamento | Dado | Proposta | Observação |
|---|---|---|---|
| Criar e manter a conta, login, verificação de e-mail, recuperação de senha | D1, D2 | **Art. 7º, V (contrato)** | OK sem consentimento |
| Perfil e cálculo de meta calórica | D3, D4 | **Art. 11, I (consentimento específico e destacado)** | Dado de saúde. Contrato (Art. 7º, V) não cobre dado sensível. O Art. 11, II, "d"/"f" (tutela da saúde) vale para profissional de saúde, não para app de bem-estar. Consentimento é o caminho seguro |
| Diário alimentar, água, peso | D5 a D9 | **Art. 11, I** | Idem. Consentimento revogável, com efeito prático (parar de coletar e permitir apagar) |
| Cardápio por IA (envio ao Gemini) | D3, D4, D10 | **Art. 11, I**, com consentimento **separado** para o envio a terceiro no exterior (Art. 33, VIII) | A IA é o diferencial pago; precisa ser opcional |
| **Agente com foto ou texto** | D11 | **Art. 11, I** + Art. 33, VIII | Foto de prato pode mostrar rosto, mãos, ambiente. Reforçar aviso de enquadramento |
| Resolve de alimento desconhecido (nome ao Gemini) | D12 | Art. 11, I | O ADR-0001 §8.4 já prevê o aviso |
| Código de barras (Open Food Facts) | D13 | Art. 11, I | Chamada com IP do Render, não do usuário |
| Cobrança e recorrência | D14, D15, D23 | **Art. 7º, V** (execução do contrato) e **Art. 7º, II** (obrigação fiscal, para guardar `payments`) | Informar o MP como controlador |
| Cota de uso por plano | D16 | Art. 7º, V | Minimização OK |
| Atendimento (chamados) | D17 | Art. 7º, V (usuário) / **Art. 7º, IX (legítimo interesse)** para visitante | Campo livre pode receber dado de saúde. Aviso no formulário |
| Ranking da comunidade | D2 (nome, score) | Art. 7º, IX com LIA, ou consentimento | Dar opção de sair do ranking |
| Receitas públicas | D10 | **Art. 7º, I** (consentimento ao marcar "pública") | Hoje a marcação existe; confirmar que mostra só o que o usuário quis |
| Segurança (rate limit, log, antifraude) | D21 | Art. 7º, IX com LIA, Art. 46 | Log sem conteúdo (RS-26) ajuda a sustentar |
| Aviso de vencimento por e-mail | D1, D14 | Art. 7º, V | Transacional, OK |
| Lembretes e push (Frente A) | D24 | **Art. 7º, I** (opt-in, ação do navegador) | Ver seção 9 |
| Comunicação de marketing | — | **Não existe.** Se vier: Art. 7º, I e opt-out | — |

**Atenção ao Art. 11, §4º:** é vedada a comunicação ou o uso compartilhado de dado de saúde para obter vantagem econômica, salvo exceções. Ao vender o Nuvi (venda de ativo / M&A), a transferência da base de dados de saúde precisa de revisão jurídica específica.

---

## 5. Dados de saúde (dados sensíveis)

**O que o código já faz bem:**
- Diário, água e alimento pessoal: `user_id NOT NULL` + `ondelete=CASCADE`; sem linha órfã; toda leitura filtra por `user_id` (ADR-0002 RS-06; `test_diary_isolation.py`).
- Nenhum `logger.*` do diário/agente/OFF recebe nome de alimento, quantidade, texto, imagem ou código de barras (RS-26, confirmado em `routers/diary*.py`, `agent.py`, `agent_parse.py`, `openfoodfacts.py`).
- Handler global de 422 retira `input`, `ctx` e `url` do corpo (alimento não vai para APM nem log de proxy).
- Foto: validada, limite de 4 MB, **decodificada em memória e não gravada** (`agent_parse.py`).
- Prompt do `resolve` carrega só `food_name` e `unit` (RS-28), sem e-mail, `user_id`, peso ou idade.
- Cache de origem não confiável (`openfoodfacts`, `llm`) é isolado por `created_by_user_id` (RS-17).

**O que falta ou é frágil:**
- **Não há consentimento** (G-01). O ADR-0002 RS-30 [P2] pedia política "antes do primeiro uso da feature". Está aberto e subiu de prioridade com a venda.
- **Perfil completo vai ao Gemini em cardápios** (`ai.py:98-103`, `:311-320`): objetivo, dieta, **alergias**, gostos, meta calórica. Alergia é dado de saúde e a requisição não carrega `user_id`, mas o Google recebe o conjunto. É o uso legítimo do produto, **e é exatamente o que precisa de consentimento separado e aviso**.
- **Foto ao Gemini** (`agent_parse.py:177`, base64 em `inline_data`). Não persiste do lado do Nuvi; do lado do Google, depende do plano da chave (ver G-04).
- **`localStorage`** guarda o cardápio do Chef IA (`nutri_current_plan`) e o JWT. Em aparelho compartilhado sobrevive ao logout parcial; `logout` remove os dois, mas o plano some só se o usuário sair pelo fluxo normal. JWT em `localStorage` é legível por qualquer XSS (CSP do frontend não foi encontrada em `vercel.json`).
- **Idade em anos, não data de nascimento.** Nada verifica menoridade. O app aceita `age` de 1 a 120 (`schemas/profile.py`). Ver G-07.
- **Sem criptografia de coluna.** A proteção é a do Supabase (criptografia em repouso do volume). Para dado sensível, avaliar criptografia de aplicação para `allergies`, `food_likes`, `food_dislikes` e `diary_entries.food_name`. Não é obrigatório pela LGPD; é medida do Art. 46 a justificar no RIPD.

---

## 6. Transferência internacional (Arts. 33 a 36, Res. CD/ANPD 19/2024)

Estado: **nenhum contrato, nenhuma cláusula-padrão, nenhum aviso ao titular**. O prazo de 12 meses da Res. 19/2024 para adoção das cláusulas-padrão já terminou (agosto de 2025).

| Operador | Fora do Brasil? | O que verificar | Mecanismo recomendado |
|---|---|---|---|
| **Google Gemini** | Sim (provável) | Conta da chave: AI Studio gratuito ou Cloud faturado? No gratuito o Google pode usar o conteúdo para melhorar produtos. Só o faturado tem termos de dados mais restritivos | Migrar para plano pago (Cloud / Vertex, região desejada) e aceitar os termos de tratamento de dados do Google, que costumam incorporar cláusulas-padrão. Art. 33, II, "b"/"c" |
| **Supabase** | Depende da região | Painel: região do projeto e do pooler | Se `sa-east-1`, não há transferência. Se não, cláusulas-padrão do DPA do Supabase |
| **Render** | Provável (EUA, Oregon/Ohio/Virgínia/Frankfurt/Singapura) | Região do serviço `nutri-agent-api` | Mudar para região o mais próxima possível não resolve a transferência; é preciso DPA do Render |
| **Vercel** | Sim (rede global) | Logs de borda com IP | DPA da Vercel (inclui cláusulas-padrão) |
| **Brevo** | UE (França) | A UE tem reconhecimento de adequação pela Res. 19/2024? **Confirmar com advogado**; sem decisão de adequação da ANPD para a UE, precisa de cláusulas-padrão | DPA do Brevo + cláusulas |
| **Resend / SMTP Gmail** | EUA | Resend só é usado como terceiro fallback; SMTP Gmail "nunca funciona" no Render (comentário em `config.py`) | **Remover do código** o que não é usado: menos operador, menos contrato |
| **Open Food Facts** | UE | Não recebe dado do titular (só IP do servidor e o código) | Não precisa de cláusulas; precisa de menção na política |
| **Google Fonts** | EUA | IP do visitante vai ao Google a cada carga | Hospedar DM Sans e Nunito no próprio frontend |

**Plano:** (1) levantar região e plano de cada serviço; (2) arquivar o DPA de cada um em `docs/lgpd/operadores/`; (3) publicar a lista de operadores e países na política; (4) consentimento específico para o envio de dados de saúde ao Gemini (Art. 33, VIII), enquanto a cláusula-padrão não estiver assinada.

---

## 7. Consentimento

**Estado atual: inexistente.** `Register.tsx` e `POST /users/` não coletam aceite de nada. Não há campo `consent_*`, tabela de consentimento, versão de política, nem registro de data e IP do aceite. A tela de onboarding (`OnboardingGate`) é tour de produto, não de privacidade.

**O que construir (antes da venda):**
1. **Tabela `consents`** (`user_id`, `purpose`, `granted`, `policy_version`, `granted_at`, `revoked_at`, `source`). Registro imutável por evento, não flag em `users`.
2. **Finalidades separadas** (não agrupar num único aceite): (a) tratar dados de saúde para o diário e as metas; (b) enviar dados ao Gemini para cardápio e Agente, inclusive foto; (c) lembretes por push; (d) aparecer no ranking; (e) marketing, se um dia houver.
3. **Aceite no cadastro** (a, no mínimo) e **no primeiro uso** de cada recurso opcional (b, c). Sem aceite de (b), o app funciona sem IA.
4. **Revogação** com o mesmo esforço do aceite (Art. 8º, §5º): tela em Perfil que mostra e permite desligar cada finalidade, com efeito real (para de enviar ao Gemini, desliga push).
5. **Prova:** guardar versão do texto exibido. Mudança de finalidade pede novo consentimento (Art. 8º, §6º).

---

## 8. Direitos do titular (Art. 18, prazo do Art. 19, II: 15 dias)

| Direito | Existe hoje? | Evidência | Lacuna |
|---|---|---|---|
| Confirmação e acesso (I, II) | **Parcial.** Cada tela mostra os dados, mas não há exportação | `GET /users/me`, `/profiles/me`, `/diary`, `/profiles/weight/history` | Não há "baixar meus dados" |
| Portabilidade (V) | **Não** | — | Exportar JSON/CSV de D1 a D10 |
| Correção (III) | Sim | `PUT /profiles/me`, edição de diário | Nome e e-mail: não há rota para alterar e-mail |
| Anonimização, bloqueio ou eliminação (IV) | **Não** pelo titular | — | — |
| **Eliminação (VI)** | **Não existe para o titular.** Só o admin: `DELETE /users/{id}` | `routers/users.py` | Sem rota `DELETE /users/me`. O ADR-0002 RS-29 já admite "hoje não existe rota de auto-exclusão" |
| Informação sobre compartilhamento (VII) | **Não** | — | Política e lista de operadores |
| Informação sobre não consentir (VIII) | **Não** | — | Política e telas |
| Revogação do consentimento (IX) | **Não**, porque não há consentimento | — | Seção 7 |
| Oposição ao legítimo interesse | **Não** | — | Ranking e segurança |
| Revisão de decisão automatizada (Art. 20) | **Não** | Metas calóricas e cardápios gerados por regra e IA | Explicar o critério; oferecer ajuste manual (já existe edição) |

**Problemas concretos da exclusão pelo admin (também vale para a futura exclusão pelo titular):**
- `payments`, `usage_events`, `feedback_tickets` têm `ForeignKey("users.id")` **sem `ondelete`**, e a relação em `User` não declara cascade para eles. No Postgres, `db.delete(user)` provavelmente falha com `IntegrityError` assim que existir um pagamento, evento de uso ou chamado do usuário. **Verificar com teste**: a suíte roda em SQLite, que não aplica FK por padrão.
- `food_cache.created_by_user_id` é `SET NULL`, com a ressalva do próprio modelo: **sem o job de expurgo do §8.4 do ADR-0001, a linha anonimizada vira linha compartilhada**. O job de retenção **não existe** em `core/scheduler.py` (só roda o ciclo de assinatura).
- Pagamentos têm base legal para ficar (Art. 16, I; obrigação fiscal), mas **anonimizados**: trocar o vínculo ao usuário por um identificador interno, mantendo `mp_payment_id` e valor.
- A cobrança recorrente no MP **não é cancelada** na exclusão. Precisa cancelar o `preapproval` antes de apagar.
- Backups do Supabase: definir e documentar por quanto tempo uma conta apagada ainda existe em backup.

---

## 9. Push e lembretes (Frente A, ainda só plano)

Desenho em `docs/superpowers/plans/2026-11-05-nuvi-agua-lembretes.md`: tabelas `reminders` e `push_subscriptions`, `pywebpush`, cron externo (GitHub Actions a cada 5 min) chamando o backend, chaves VAPID e `CRON_SECRET`.

**Pontos positivos já no plano:** `CRON_SECRET` obrigatório (401 sem ele); inscrição removida quando o provedor devolve 404/410; proteção contra SSRF no `endpoint`; "nunca duas vezes no mesmo dia local".

**Pontos a incluir no desenho:**
- **Opt-in explícito e granular.** O prompt de permissão do navegador não basta como registro; gravar consentimento (seção 7, finalidade (c)). O lembrete de **peso** e o de **refeição** revelam hábito de saúde; mostrar o que cada um faz antes de pedir permissão.
- **Texto da notificação sem dado de saúde.** A tela de bloqueio aparece para terceiros. "Hora de registrar sua refeição" é aceitável; "Você está 400 kcal abaixo da meta" não é.
- **Remover assinatura push no logout, na revogação e na exclusão de conta.** A assinatura é identificador persistente do aparelho.
- **Endpoint de push é um terceiro.** Chega a FCM (Google), Mozilla ou Apple, conforme o navegador. Esses provedores veem metadados da entrega. Citar na política.
- **Payload criptografado** (padrão Web Push com VAPID) e **retenção** de `push_subscriptions` inativas (sugestão: 90 dias sem sucesso).
- **O cron externo no GitHub Actions** passa por infraestrutura nos EUA; ele só carrega o `CRON_SECRET`, sem dado pessoal. OK, desde que o log do workflow não imprima payload.

---

## 10. Retenção

Já definido no ADR-0001 §8.4. **O que existe no código e o que não existe:**

| Dado | Regra proposta | Implementada? |
|---|---|---|
| `diary_entries` | Enquanto a conta existir; apaga na exclusão | **Cascade existe; exclusão pelo titular não existe** |
| `food_cache` `taco`/`curated` | Permanente | Sim |
| `food_cache` `openfoodfacts`/`llm` | 90 dias; órfã (`created_by_user_id IS NULL`) apagada no próximo job | **Não.** O scheduler só tem o ciclo de assinatura. Há o índice `ix_food_cache_retention`, mas não o job |
| `water_entries` | Enquanto a conta existir | Cascade existe |
| `weight_history`, `profiles` | Enquanto a conta existir | Cascade pelo ORM (`all, delete-orphan`) |
| `payments` | **5 anos** (sugestão; confirmar com contador) e depois anonimizar | Sem regra |
| `usage_events` | 12 meses (sugestão: serve só para cota) | Sem regra; cresce sem limite |
| `feedback_tickets` | 24 meses depois de resolvido | Sem regra; guarda e-mail e mensagem livre |
| Conta inativa | Definir prazo (sugestão: avisar aos 12 meses sem login e apagar aos 24) | Sem regra; só existe `last_login_at` |
| Conta não verificada | Apagar após 7 dias (nunca confirmou o e-mail, e o e-mail é de terceiro) | Sem regra |
| Log (Render, Vercel) | Prazo do provedor; documentar | A documentar |
| Backup Supabase | Documentar | A documentar |
| Incidentes | **5 anos** (Res. 15/2024, Art. 10) | Sem registro |

---

## 11. Política de privacidade e transparência (Art. 9º)

**Não existe.** Não há rota, página, link no rodapé, link no cadastro, nem texto em `docs/`. A Landing responde "Sim. Seu perfil, receitas e histórico são seus — visíveis só pra você" no FAQ, o que **precisa ser conferido contra a realidade** (ranking com primeiro nome; receitas públicas; operadores e administradores com acesso).

**Itens que o texto precisa ter** (Art. 9º, Art. 18 e ADR-0001 §8.4):
1. quem é o controlador (razão social, CNPJ, e-mail) e quem é o encarregado;
2. cada dado coletado e a finalidade, na linguagem do usuário;
3. a base legal de cada finalidade;
4. que o diário, o peso e as alergias são **dado sensível de saúde**;
5. **o que vai ao Google/Gemini** (perfil, ingredientes, nome do alimento, texto e foto do Agente) e que isso sai do Brasil;
6. a lista de operadores e países (seção 3);
7. por quanto tempo cada dado fica (seção 10);
8. os direitos do titular e como exercê-los (canal, prazo de 15 dias);
9. consequências de não consentir (IA desligada; app segue funcionando);
10. menores de 18 anos (decisão da seção 12);
11. cookies e armazenamento local (token, tema, cardápio atual);
12. versão e data, com histórico (`docs/lgpd/politica-vN.md`);
13. aviso de que o Nuvi **não é aconselhamento médico**, ligado ao risco de dieta restritiva em quem tem transtorno alimentar.

**Também faltam:** Termos de Uso (limites de responsabilidade, plano, cancelamento) e link para ambos em `Register`, `Landing`, rodapé e `manifest`.

---

## 12. Crianças e adolescentes

O app aceita `age` de 1 a 120, sem verificação. Metas calóricas e cardápios para adolescente têm risco clínico específico e, pela LGPD (Art. 14), o tratamento de dado de criança exige consentimento do responsável. A Lei 15.211/2025 (ECA Digital, em vigor desde 17/03/2026) alcança serviço digital de **acesso provável por menores** e **veda autodeclaração** de idade quando houver verificação exigida.

**Decisão a tomar antes de vender:** o produto é para maiores de 18? Se sim: termos com essa regra, verificação razoável e **recusa de perfil com idade abaixo de 18** (hoje aceita 1). Se não: vincular a responsável e rever tudo. A recomendação mais barata é "18+", com bloqueio técnico e texto claro.

---

## 13. Registros em log e retenção operacional

**Positivo:** formato com id, nunca conteúdo (RS-26); `ENVIRONMENT=production` sobe o nível para INFO (sem payload do SQLAlchemy/httpx); `httpx`/`httpcore` em WARNING; exceção não tratada devolve "Erro interno." e o traceback fica só no log do servidor; headers de segurança presentes.

**Achados:**
- **E-mail em log** em `services/email.py` (linhas 45, 68, 95): `Falha ao enviar … pra %s`. Logs ficam no coletor do Render sem controle de acesso por titular e sobrevivem à exclusão. Trocar por `user_id` ou hash.
- **`response.text` do Brevo e do Resend** em log de aviso: pode ecoar o e-mail ou o assunto. Truncar e filtrar.
- **`logger.error("Gemini respondeu %s: %s", status, response.text[:500])`** (`ai.py:44`): o corpo de erro do Gemini pode refletir pedaço do prompt. Vale para `str(data)[:500]` na linha 58. Cortar para o código de erro.
- **Chave do Gemini na query string** (`ai.py:15`, A-7 do ADR-0002): qualquer traceback que renderize a URL vaza a chave. Usar header `x-goog-api-key`.
- **`mercado_pago.py:50`** registra `response.text` completo e o `user.id`. Em erro 4xx, o MP devolve campos do payload (incluindo `payer_email`). Reduzir.
- **`DEBUG` por padrão** se `ENVIRONMENT` não estiver definido (default `development`). Garantir `ENVIRONMENT=production` no Render e tornar o default seguro.
- Sem **log de acesso do admin** (quem leu o quê) e sem **trilha de auditoria** de ação sobre dado pessoal (exclusão por admin, alteração de plano).
- O rate limit usa `TRUSTED_PROXY_COUNT`; o ADR-0002 RS-25 exige `TRUSTED_PROXY_COUNT=1` no Render. Confirmar. Sem isso, o limite de 5 logins/min vale para o mundo inteiro.
- Retenção de log dos provedores (Render, Vercel): documentar.

---

## 14. Segurança (Art. 46) — observações que afetam a LGPD

- Senha em Argon2, login com tempo constante, tokens com tipo, reset de uso único e sessão revogada na troca de senha: boas práticas.
- **JWT em `localStorage`** (D18): XSS vira roubo de sessão. Sem CSP no frontend (a API tem CSP; o `vercel.json` do frontend só faz rewrite). Adicionar CSP e headers no Vercel.
- Link de verificação e de reset trafegam em query string e entram em histórico, `Referer` e log de borda (comentário já existente em `deps.py`). Mitigado pelo tipo de token e expiração, mas é dado de autenticação em URL.
- Admin com `is_superuser` único; sem 2FA, sem registro de leitura. Dado de saúde de todos os usuários (por e-mail) é acessível a quem tiver essa conta.
- **Backups e restauração**: sem evidência no repositório.
- **Enumeração** de contas: tratada (respostas genéricas), exceto `POST /users/` que devolve "Email already registered".
- **Dependabot ativo** (`.github/dependabot.yml`) e CI com testes: positivo. Sem SAST/SCA nem varredura de segredos no CI.

---

## 15. Lacunas, com prioridade

Prioridade: **P0** bloqueia a venda; **P1** necessário antes de escala ou de assinar contrato com cliente corporativo; **P2** melhoria.

| ID | Pri. | Lacuna | Base | O que fazer | Quem |
|---|---|---|---|---|---|
| G-01 | **P0** | Sem consentimento para dado de saúde, para envio à IA e para push | LGPD Arts. 7º, 8º, 11 | Tabela `consents`, finalidades separadas, aceite no cadastro e no primeiro uso, tela de revogação | Produto + eng |
| G-02 | **P0** | Sem política de privacidade nem termos de uso | Art. 9º | Redigir v1 (itens da seção 11), publicar, linkar no cadastro e no rodapé | Advogado + produto |
| G-03 | **P0** | Sem exportação e sem exclusão pelo titular; exclusão pelo admin provavelmente quebra com FK sem cascade | Arts. 18, II, V, VI; 19 | `GET /users/me/export` e `DELETE /users/me` (cancelar MP, anonimizar pagamentos, apagar tudo o mais); teste em Postgres | Eng |
| G-04 | **P0** | Transferência internacional sem mecanismo, e plano do Gemini incerto | Arts. 33 a 36; Res. 19/2024 | Inventariar região e plano; migrar Gemini para plano pago com termos de dados; arquivar DPAs; consentimento específico (Art. 33, VIII) | Franco + advogado |
| G-05 | **P0** | Sem encarregado, ROPA, RIPD e registro de operadores | Arts. 37, 38, 41; Res. 18/2024 | Designar encarregado e publicar canal; ROPA a partir da seção 2; RIPD do diário e da foto | Franco + advogado |
| G-06 | **P0** | Sem plano de resposta a incidente nem registro | Art. 48; Res. 15/2024 | Runbook (3 dias úteis para ANPD e titular, 5 anos de registro); simulação | Franco |
| G-07 | **P0** | Sem decisão sobre menores; app aceita `age` = 1 | Art. 14; Lei 15.211/2025 | Definir "18+", validar no cadastro e no perfil, texto nos termos | Produto + eng |
| G-08 | P1 | Job de retenção do cache e demais prazos não existem | Arts. 15, 16 | Job diário no APScheduler (cache 90 dias e órfãs), expurgo de `usage_events`, contas não verificadas, conta inativa | Eng |
| G-09 | P1 | Fontes do Google carregadas do CDN (IP do visitante vai ao Google) | Arts. 6º, III; 33 | Self-host de DM Sans e Nunito | Eng |
| G-10 | P1 | E-mail e corpo de erro de terceiros em log | Art. 46; RS-26 | Trocar e-mail por `user_id`; truncar `response.text`; chave Gemini por header | Eng |
| G-11 | P1 | Cardápios e plano atual em `localStorage`; JWT em `localStorage`; sem CSP no frontend | Art. 46 | CSP no Vercel; evitar guardar cardápio sensível; avaliar cookie `HttpOnly` | Eng |
| G-12 | P1 | Admin lê e-mail, pagamentos e chamados sem trilha; sem 2FA | Art. 46, 37 | Log de acesso, 2FA, mínimo privilégio | Eng |
| G-13 | P1 | Remover operadores que não são usados (Resend, SMTP Gmail) | Art. 6º, III | Tirar do código e do DPA | Eng |
| G-14 | P1 | Contratos (DPA) de Render, Vercel, Supabase, Brevo, Mercado Pago não arquivados | Art. 39 | Guardar em `docs/lgpd/operadores/` | Franco |
| G-15 | P2 | Ranking expõe primeiro nome sem opção de sair | Arts. 6º, 7º, IX | Campo "aparecer no ranking" (padrão desligado) | Produto + eng |
| G-16 | P2 | Idade como número que envelhece; `allergies` e `food_*` em texto livre | Art. 6º, V, VII | Data de nascimento (se 18+ for exigido) ou recalcular; criptografia de coluna avaliada no RIPD | Eng |
| G-17 | P2 | Chamados com texto livre (pode receber dado de saúde) | Art. 6º, III | Aviso no formulário; expurgo em 24 meses | Eng |
| G-18 | P2 | Backups sem prazo documentado | Arts. 15, 16 | Registrar retenção do Supabase na política | Franco |
| G-19 | P2 | Avisos de "não é aconselhamento médico" e proteção a quem tem transtorno alimentar | Art. 6º, VIII | Texto e travas de meta mínima (ADR já limita) | Produto |
| G-20 | P2 | Push e lembretes: reauditar quando entrar na `main` | Arts. 7º, I; 46 | Itens da seção 9 | Eng |

---

## 16. O que falta para vender

Ordem sugerida, do que um comprador (ou o jurídico dele) vai pedir em diligência:

**Documentos (não precisam de código):**
1. Política de privacidade v1 e termos de uso (G-02).
2. Designação do encarregado, com nome e canal público (G-05).
3. ROPA (a seção 2 é o insumo) e RIPD do diário e da foto (G-05).
4. DPAs arquivados e matriz de operadores com países (G-04, G-14).
5. Plano de resposta a incidente e modelo de comunicação à ANPD e aos titulares (G-06).
6. Política de retenção e descarte (seção 10).
7. Registro de decisões: base legal por tratamento (seção 4), LIA do ranking e da segurança.

**Produto e código:**
8. Consentimento granular com prova e revogação (G-01).
9. Exportação e exclusão de conta pelo titular, com teste em Postgres (G-03).
10. Bloqueio de menores (G-07).
11. Job de retenção (G-08).
12. Ajustes de log, fontes e CSP (G-09, G-10, G-11).
13. Frente A (push) só sai com consentimento próprio (G-20).

**Para a transação em si:**
14. A venda de uma base de dados de saúde exige revisão jurídica específica (Art. 11, §4º, e Art. 9º sobre mudança de controlador). O comprador vira controlador e precisa **informar os titulares**. Preparar o texto agora.
15. Verificar se a Nevus Digital, o Franco ou outra entidade é o controlador. A política e o encarregado precisam apontar para a pessoa jurídica certa.
16. **Enquadramento como agente de pequeno porte** (Res. 2/2022): vale enquanto a receita for baixa; a regra de "alto risco" (dado sensível em larga escala, decisão automatizada) pode retirar a dispensa. Tratar o RIPD como obrigatório.

**Prazos de referência (normative-reference.md):** resposta ao titular em 15 dias (30 para ATPP); incidente em 3 dias úteis (6 para ATPP); registro de incidente por 5 anos; multa de até 2% do faturamento no Brasil, limite de R$ 50 milhões por infração.

---

## 17. Reauditoria

Reauditar quando: (1) a Frente A (lembretes e push) entrar na `main`; (2) a Frente T (telas) mudar fluxos de cadastro, perfil ou configurações; (3) qualquer operador mudar; (4) a política v1 for publicada (conferir se descreve o que o código faz).

Itens de código a **verificar com teste** antes de fechar G-03: exclusão de usuário com `payments`, `usage_events` e `feedback_tickets` no Postgres (a suíte usa SQLite); `meal_plans`, `recipes` e `shopping_*` em cascata; `food_cache` órfão depois do `SET NULL`.
