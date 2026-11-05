# Nuvi, Frente A (água e lembretes): plano de implementação

> **Para agentes:** sub-skill obrigatória: superpowers:executing-plans (execução nesta sessão, pela própria Frente A). Os passos usam caixas de seleção (`- [ ]`).

**Objetivo:** meta e registro de água, lembretes por usuário com fuso e push Web disparado por um cron externo que chama o backend a cada 5 minutos.

**Arquitetura:** três tabelas novas (`water_entries`, `reminders`, `push_subscriptions`), três routers de usuário (`/water`, `/reminders`, `/push`) e um router interno (`/internal/reminders/dispatch`) protegido por `X-Cron-Secret`. O envio passa por um único serviço (`app/services/webpush.py`), que os testes trocam por um falso. O GitHub Actions chama o dispatch a cada 5 minutos; a chamada também acorda o Render.

**Stack:** FastAPI, SQLAlchemy 2, Alembic, pytest, `pywebpush` (nova dependência). Frontend (depois da F6): React 19, Vite, Vitest, service worker de push.

**Spec:** `docs/superpowers/specs/2026-11-05-redesign-nuvi-fase1-design.md` (§7 itens 5 e 6, §9) e a Frente A de `docs/superpowers/plans/2026-11-05-redesign-nuvi-fase1.md`.

## Restrições globais

- Meta de água = peso × 35 ml, arredondada para o múltiplo de 50 ml mais próximo (meio sobe); sem peso (sem perfil), 2.000 ml.
- Tipos de lembrete: `cafe`, `almoco`, `lanche`, `jantar`, `agua`, `peso`. Fuso padrão `America/Sao_Paulo`.
- Variáveis: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`. Todas com default `""` (a API sobe sem elas). **Nenhum segredo é cadastrado por esta frente.**
- Dispatch: só o que caiu nos últimos 5 minutos, nunca duas vezes no mesmo dia local, `401` sem o segredo certo, inscrição removida quando o push responde `404` ou `410`.
- Cron: `.github/workflows/lembretes.yml`, `*/5 * * * *`, segredo `CRON_SECRET` do repositório.
- Regras do diário que valem aqui: `user_id` só de `current_user`; recurso alheio responde `404` idêntico ao inexistente; FK `users.id` com `ondelete="CASCADE"` e `NOT NULL`; datas de escrita na janela do RS-09 (`_validar_janela_data` de `app/schemas/diary.py`).
- Migrações em linha (uma cabeça); `tests/test_migrations.py` precisa passar.
- A cada tarefa verificada: `git fetch origin && git rebase origin/main`, `cd backend && .venv/bin/python -m pytest -q`, `git push origin HEAD:main`. Nunca `--force`.

## Foco de revisão

1. **Endpoint de push apontando para qualquer URL (SSRF):** o backend faz POST para o `endpoint` da inscrição. Só aceita `https://` em hosts de serviços de push conhecidos (`fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.push.apple.com`, `*.notify.windows.com`). Teste `test_inscricao_recusa_endpoint_fora_da_lista` (Tarefa 3).
2. **Lembrete perto da meia-noite** (23h58, cron às 00h01): a janela atravessa o dia e o "já enviado" vale para o dia do horário, não o do cron. Teste `test_dispatch_janela_atravessa_meia_noite` (Tarefa 4).
3. **Duas chamadas do cron ao mesmo tempo** (atraso do GitHub + execução manual): a marcação é um `UPDATE ... WHERE last_sent_on IS NULL OR last_sent_on <> :dia` atômico; só quem muda a linha envia. Teste `test_dispatch_nao_envia_duas_vezes_no_dia` (Tarefa 4).
4. **`CRON_SECRET` vazio no servidor:** o endpoint nunca fica aberto. Sem segredo configurado, responde `503`. Teste `test_dispatch_sem_segredo_configurado_responde_503` (Tarefa 4).
5. **Mesma inscrição (mesmo navegador) trocando de conta:** o `endpoint` é único; a inscrição passa para o usuário atual em vez de notificar a conta antiga. Teste `test_inscricao_troca_de_dono` (Tarefa 3).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/app/models/water.py` | `WaterEntry` |
| `backend/app/models/reminder.py` | `Reminder`, `REMINDER_KINDS` |
| `backend/app/models/push_subscription.py` | `PushSubscription` |
| `backend/app/services/water_goal.py` | `water_goal_ml(weight_kg)` |
| `backend/app/services/webpush.py` | `send_push(sub, payload) -> PushResult`, `endpoint_permitido(url)` |
| `backend/app/services/reminder_dispatch.py` | `dispatch_due_reminders(db, now_utc) -> DispatchResult` |
| `backend/app/schemas/water.py`, `reminder.py`, `push.py` | contratos |
| `backend/app/routers/water.py`, `reminders.py`, `push.py`, `internal.py` | rotas |
| `backend/migrations/versions/<rev>_agua.py`, `<rev>_lembretes_e_push.py` | migrações |
| `.github/workflows/lembretes.yml` | cron |
| Alterar: `backend/app/db/base.py`, `backend/app/main.py`, `backend/app/core/config.py`, `backend/requirements.txt`, `.env.example` | registro mínimo |

---

### Tarefa 1: água (meta, registro e leitura)

**Arquivos:** `models/water.py`, `services/water_goal.py`, `schemas/water.py`, `routers/water.py`, migração `agua`; teste `backend/tests/test_water.py`.

**Interfaces (produz):**
- `water_goal_ml(weight_kg: float | None) -> int`.
- `WaterEntry`: `id`, `user_id` (FK CASCADE, NOT NULL), `entry_date: date`, `ml: int`, `created_at: datetime` (UTC). Índice `ix_water_entries_user_date (user_id, entry_date)`.
- `POST /water` corpo `{ date: date, ml: int (1..5000) }` → `201` `WaterDay`.
- `GET /water?date=YYYY-MM-DD` → `200` `WaterDay`.
- `DELETE /water/{id}` → `200` `WaterDay` do dia da entrada (desfazer); alheio ou inexistente → `404 {"code":"WATER_NOT_FOUND"}`.
- `WaterDay = { date, goal_ml: int, total_ml: int, entries: [{ id, ml, created_at }] }`.
- Teto por dia: 50 entradas (`403 PLAN_LIMIT_REACHED`, `event_type: "water_entries_per_day"`), mesmo formato do teto do diário.

- [ ] Testes:
  - `test_meta_agua_arredonda_para_50`: `water_goal_ml(70) == 2450`, `water_goal_ml(71) == 2500` (2485 → 2500), `water_goal_ml(70.7) == 2450` (2474,5 → 2450), `water_goal_ml(None) == 2000`, `water_goal_ml(0) == 2000`.
  - `test_get_agua_sem_perfil_meta_2000`, `test_get_agua_com_perfil_usa_peso` (perfil 80 kg → 2800).
  - `test_post_agua_soma_no_dia`: dois POST de 250 → `total_ml == 500`, 2 entradas.
  - `test_agua_isolada_por_usuario`: B não vê o total de A; `DELETE` de A por B → `404`.
  - `test_post_agua_ml_invalido` (0, -250, 5001 → `422`) e `test_post_agua_fora_da_janela` (data daqui a 30 dias → `422`).
  - `test_delete_agua_devolve_dia`.
- [ ] Ver falhar, implementar, ver passar; migração `agua` com `down_revision` = cabeça atual; `alembic heads` com uma cabeça.
- [ ] Commit `feat(agua): meta pelo peso e rotas /water` e subir.

### Tarefa 2: lembretes por usuário

**Arquivos:** `models/reminder.py`, `schemas/reminder.py`, `routers/reminders.py`; teste `backend/tests/test_reminders.py`. (A migração entra junto com a da Tarefa 3, `lembretes_e_push`.)

**Interfaces (produz):**
- `REMINDER_KINDS = ("cafe", "almoco", "lanche", "jantar", "agua", "peso")`; `DEFAULT_TIMES = {"cafe": 08:00, "almoco": 12:30, "lanche": 16:00, "jantar": 19:30, "agua": 10:00, "peso": 07:30}`.
- `Reminder`: `id`, `user_id` (FK CASCADE), `kind: str(16)`, `local_time: time`, `timezone: str(64)`, `enabled: bool`, `last_sent_on: date | None`; `UniqueConstraint(user_id, kind, name="uq_reminders_user_kind")`.
- `GET /reminders` → `{ timezone: str, reminders: [{ kind, time: "HH:MM", enabled }] }` com os 6 tipos sempre presentes (os que não existem no banco aparecem com o horário padrão e `enabled: false`).
- `PUT /reminders` corpo `{ timezone: str, reminders: [{ kind, time, enabled }] }` → mesma forma do GET. Upsert por `(user, kind)`; o `timezone` vale para todas as linhas do usuário. Fuso inválido (fora de `zoneinfo.available_timezones()`) → `422`. Tipo repetido ou desconhecido → `422`. Mudar o horário ou o fuso de um lembrete zera `last_sent_on` (o novo horário vale já no mesmo dia).

- [ ] Testes: `test_get_lembretes_padrao` (6 tipos, `America/Sao_Paulo`, todos desligados), `test_put_lembretes_salva_e_devolve`, `test_put_lembretes_fuso_invalido_422`, `test_put_lembretes_tipo_desconhecido_422`, `test_lembretes_isolados_por_usuario`.
- [ ] Ver falhar, implementar, ver passar. Commit junto com a Tarefa 3.

### Tarefa 3: inscrição de push Web (VAPID)

**Arquivos:** `models/push_subscription.py`, `schemas/push.py`, `routers/push.py`, `services/webpush.py`, `core/config.py` (+4 variáveis), `requirements.txt` (`pywebpush>=2.0`), migração `lembretes_e_push` (tabelas `reminders` e `push_subscriptions`); teste `backend/tests/test_push.py`.

**Interfaces (produz):**
- `PushSubscription`: `id`, `user_id` (FK CASCADE), `endpoint: str(1024)` único (`uq_push_subscriptions_endpoint`), `p256dh: str(255)`, `auth: str(255)`, `created_at`.
- `GET /push/vapid-public-key` → `{ public_key: str }`; sem chave configurada → `503 {"code":"PUSH_NOT_CONFIGURED"}`. Exige login.
- `POST /push/subscriptions` corpo `{ endpoint, keys: { p256dh, auth } }` (formato de `PushSubscription.toJSON()`) → `201 { id }`. Upsert por `endpoint`, trocando o dono se preciso. Máximo 10 inscrições por usuário (a mais antiga sai).
- `DELETE /push/subscriptions` corpo `{ endpoint }` → `204`; endpoint alheio ou inexistente também `204` sem apagar nada alheio.
- `endpoint_permitido(url: str) -> bool` (https + lista de hosts do Foco 1).
- `PushResult = Literal["ok", "gone", "error"]`; `send_push(sub: PushSubscription, payload: dict) -> PushResult` usa `pywebpush.webpush(..., vapid_private_key=settings.VAPID_PRIVATE_KEY, vapid_claims={"sub": settings.VAPID_SUBJECT}, ttl=3600, timeout=5)`; `404`/`410` → `"gone"`, outra falha → `"error"` (log sem o endpoint completo).

- [ ] Testes: `test_vapid_public_key_503_sem_config`, `test_vapid_public_key_devolve_chave` (monkeypatch em `settings`), `test_inscricao_cria`, `test_inscricao_idempotente` (mesmo endpoint duas vezes → 1 linha), `test_inscricao_troca_de_dono`, `test_inscricao_recusa_endpoint_fora_da_lista` (`http://fcm.googleapis.com/x`, `https://169.254.169.254/x`, `https://evil.com/x` → `422`), `test_remover_inscricao_alheia_nao_apaga`, `test_send_push_410_vira_gone` (monkeypatch em `pywebpush.webpush` levantando `WebPushException` com `response.status_code == 410`).
- [ ] Ver falhar, implementar, ver passar. Migração `lembretes_e_push`, uma cabeça.
- [ ] Commit `feat(lembretes): lembretes por usuário e inscrição de push` e subir.

### Tarefa 4: dispatch interno e cron

**Arquivos:** `services/reminder_dispatch.py`, `routers/internal.py`, `.github/workflows/lembretes.yml`, `.env.example`; teste `backend/tests/test_reminder_dispatch.py`.

**Interfaces:**
- Consome: `send_push` e `PushResult` (Tarefa 3), `Reminder` (Tarefa 2).
- `WINDOW = timedelta(minutes=5)`.
- `DispatchResult = { reminders: int, sent: int, removed: int, failed: int }`.
- `dispatch_due_reminders(db: Session, now_utc: datetime) -> DispatchResult`: para cada lembrete ligado, o "momento devido" é `local_time` no dia local de hoje ou de ontem (no fuso da linha); vale o que cair em `(now - WINDOW, now]`. A marcação usa o `UPDATE` atômico do Foco 3 com o dia desse momento. Só depois de marcar, envia para todas as inscrições do usuário; `"gone"` apaga a inscrição.
- `POST /internal/reminders/dispatch` com `X-Cron-Secret`; comparação com `secrets.compare_digest`; sem cabeçalho ou errado → `401`; `CRON_SECRET` vazio → `503`. Fora do schema OpenAPI (`include_in_schema=False`). Sem rate limit de usuário.
- Textos do push (`title`/`body`/`url`): café "Hora do café da manhã" / "Registre o que você comeu." / `/hoje`; almoço "Hora do almoço"; lanche "Hora do lanche"; jantar "Hora do jantar"; água "Hora de beber água" / "Um copo agora ajuda a bater a meta." / `/hoje`; peso "Hora de se pesar" / "Anote seu peso de hoje." / `/progresso`. `tag` = `nuvi-<kind>`.

- [ ] Testes (todos com `now_utc` fixo e `send_push` falso):
  - `test_dispatch_401_sem_segredo` e `test_dispatch_401_segredo_errado`;
  - `test_dispatch_sem_segredo_configurado_responde_503`;
  - `test_dispatch_envia_na_janela` (lembrete 12h30 SP; now = 15h32 UTC → envia);
  - `test_dispatch_fora_da_janela` (now = 15h36 UTC → não envia; now = 15h29 → não envia);
  - `test_dispatch_respeita_fuso` (mesmo 12h30 com `Europe/Lisbon` não sai às 15h32 UTC; sai às 12h32 UTC);
  - `test_dispatch_nao_envia_duas_vezes_no_dia` (duas chamadas seguidas na janela → 1 envio; no dia seguinte, envia de novo);
  - `test_dispatch_janela_atravessa_meia_noite`;
  - `test_dispatch_remove_inscricao_410` (uma inscrição `gone`, outra `ok` → `removed == 1`, `sent == 1`);
  - `test_dispatch_ignora_desligado`.
- [ ] Ver falhar, implementar, ver passar.
- [ ] `lembretes.yml`: `schedule: */5 * * * *` e `workflow_dispatch`; `permissions: {}`; `concurrency` sem cancelar; um passo `curl -fsS --retry 3 --retry-delay 20 --max-time 90 -X POST -H "X-Cron-Secret: $CRON_SECRET" "$API_URL/internal/reminders/dispatch"`, com `CRON_SECRET` de `secrets.CRON_SECRET` e `API_URL` de `vars.NUVI_API_URL` com padrão `https://nutri-agent-api.onrender.com`; sem o segredo, o passo sai com aviso e sucesso (não falha a cada 5 minutos antes do cadastro).
- [ ] `.env.example`: bloco "Lembretes (push Web)" com as 4 variáveis e o comando de geração das chaves.
- [ ] Commit `feat(lembretes): dispatch protegido e cron de 5 minutos` e subir.

### Tarefa 5 (só depois da F6 na `main`): frontend

**Arquivos:** `frontend/src/components/agua/WaterCard.tsx` (+ `WaterSheet.tsx`, `useWater.ts`, testes), `frontend/src/pages/perfil/Lembretes.tsx` (+ teste), `frontend/src/lib/push.ts`, `frontend/public/sw.js` (ou `src/sw.ts`, conforme a Fundação), registro no `HojeSlots.Agua` e na rota `ROUTES.lembretes`.

**Interfaces (consome):** `WaterDay`, `/reminders`, `/push/*` das Tarefas 1 a 3; `Button`, `Sheet`, `Switch`, `toast` da F6; `HojeSlots.Agua` da Frente T.

- [ ] `WaterCard`: total/meta, barra sem gradiente (verde `pos`), "+250 ml" registra na hora e mostra `toast` com "Desfazer" (chama `DELETE /water/{id}`); "Outra quantidade" abre a `Sheet` com 150, 200, 300, 500 ml e um campo livre.
- [ ] `Lembretes`: um `Switch` e um campo de horário por tipo; ao ligar o primeiro, pede permissão, assina com a chave de `/push/vapid-public-key` e envia a inscrição; permissão negada mostra a explicação e deixa os switches desligados.
- [ ] Service worker: `push` mostra a notificação com `title`/`body`/`tag` e ícone do kit; `notificationclick` foca ou abre `data.url`.
- [ ] Testes de componente: `WaterCard` soma 250 e chama o POST; desfazer chama o DELETE; `Lembretes` sem suporte a push mostra o aviso.
- [ ] Verificar no navegador interno (375 px e 1280 px, claro e escuro). Commit e subir.
