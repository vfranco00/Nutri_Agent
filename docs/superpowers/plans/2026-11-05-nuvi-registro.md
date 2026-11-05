# Frente R (registro): plano de implementação

> **Para agentes:** sub-skill obrigatória: superpowers:executing-plans (ou subagent-driven-development). Passos com `- [ ]`.

**Objetivo:** dar ao diário os caminhos rápidos de registro da Fase 1: alimento pessoal (`mine:`), receita (`recipe:`), recentes, frequentes, copiar/repetir dia, carrinho em lote e refeição pronta. Depois, a folha Registrar e Meus alimentos no frontend.

**Arquitetura:** o backend estende o diário do ADR-0001 sem mudar o que existe. O `food_ref` ganha dois namespaces, resolvidos no mesmo `_resolver_food_ref` (um SELECT, escopo no `WHERE`, sem rede). As entradas continuam sendo snapshot. A lógica nova fica em `app/services/diary_registro.py`. Os schemas novos ficam em `app/schemas/diary_registro.py`. As rotas de alimento ficam em `routers/diary_foods.py` e as de dia em `routers/diary.py`. O frontend vem depois da F6 da Fundação.

**Stack:** FastAPI, SQLAlchemy 2, Alembic e pytest (SQLite em memória e Postgres no `test_migrations`). Frontend: React 19, Tailwind v4 e Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-redesign-nuvi-fase1-design.md` §7. Plano-mãe: `docs/superpowers/plans/2026-11-05-redesign-nuvi-fase1.md`, Frente R. Contrato base: `docs/adr/0001-diario-alimentar.md` §4.4 e §6.

## Restrições globais

- `POST /diary` e todo caminho novo de escrita **não chamam LLM nem rede** (D-5).
- Recurso alheio responde **404 com corpo idêntico** ao de inexistente. Nunca 403 por posse (RS-03). Sem exceção para superusuário (RS-04).
- `user_id` sai só de `current_user.id`. Todo schema de escrita usa `extra="forbid"` (RS-02).
- Toda mutação do diário devolve o `DiaryDay` recalculado (D-6).
- Teto de 60 entradas por dia (RS-11) vale para cópia, lote e refeição pronta: estourar dá `403 PLAN_LIMIT_REACHED` e **não grava nada**.
- Log só com identificadores. Nunca nome de alimento, código de barras ou quantidade (RS-26).
- `null` de macro é "desconhecido", nunca zero (§9.4).
- Migrações em linha: `down_revision` = cabeça atual da `main`. `tests/test_migrations.py` passa em Postgres.
- Subir a cada tarefa: `git fetch origin && git rebase origin/main`, a suíte e depois `git push origin HEAD:main`, sem `--force`.

## Decisões desta frente (o plano-mãe deixou abertas)

1. **`mine:` é por porção.** `FoodOption.base_unit = "un"`, `kcal_per_base_unit = kcal` da porção. `allowed_units = ["un","fatia","porcao"]` e `quantity` = número de porções. `FoodOption` ganha o campo opcional `portion_label` (aditivo).
2. **`recipe:` é por porção.** A receita não tem rendimento. `Recipe.calories` é a kcal de uma porção (é o que o gerador de IA grava). Se for nulo, usa a soma de `Ingredient.calories`. Sem kcal > 0, a receita não resolve (`404 FOOD_NOT_RESOLVED`). Macros `null`. Resolve receita **própria ou pública**; receita privada de outra pessoa dá 404.
3. **Novas `source`:** `"user"` (mine) e `"recipe"`. `is_estimate` continua `source in ("llm","openfoodfacts")`.
4. **Idempotência do copy:** coluna `diary_entries.copied_from_entry_id` (sem FK, referência fraca como `food_ref`) e índice **único** `(user_id, entry_date, copied_from_entry_id)`. NULL não colide nos dois bancos. Antes de inserir, pula as origens já copiadas. Na corrida entre duas abas, o `IntegrityError` dá rollback e a cópia roda de novo uma vez (aí tudo já existe e nada se duplica).
5. **Refeição pronta guarda snapshot por item** (os mesmos campos `*_per_base_unit` da entrada). Registrar não depende de o `food_ref` ainda resolver.
6. **Lote:** `POST /diary/batch` (carrinho e Agente). É atômico: um item inválido recusa o lote inteiro.

## Foco de revisão

- **Duas abas fazendo "Repetir dia" ao mesmo tempo:** sem duplicar (Tarefa 4, teste de corrida simulada com `IntegrityError`).
- **Alimento pessoal apagado depois de registrado:** a entrada antiga continua com o mesmo total. Recentes e frequentes param de oferecer o alimento, sem 500 (Tarefa 3).
- **Código de barras repetido no mesmo usuário:** `409 BARCODE_ALREADY_USED`. O mesmo código em outro usuário é permitido (Tarefa 1).
- **Copiar de um dia vazio ou para o próprio dia:** dia vazio dá 200 com o destino intacto. `from_date == to_date` dá 422 (Tarefa 4).
- **Refeição pronta de outra pessoa:** `log`, `GET` e `DELETE` dão 404 idêntico (Tarefa 5).

---

### Tarefa 1: `user_foods` e `/diary/foods/mine` (contrato da Frente B)

**Arquivos:**
- Criar: `app/models/user_food.py`, `app/schemas/diary_registro.py`, `app/services/diary_registro.py`, a migração `migrations/versions/<rev>_user_foods.py` e `tests/test_diary_user_foods.py`.
- Alterar: `app/db/base.py` (registrar `UserFood`), `app/routers/diary_foods.py` (rotas novas), `app/routers/diary.py` (`_resolver_food_ref`), `app/schemas/diary.py` (regex do `food_ref`, `FoodSourceType` com `user` e `recipe`, `FoodOption.portion_label`) e `tests/diary_helpers.py` (`alimento_meu`).

**Interfaces (produz):**
- Modelo `UserFood` (`user_foods`):
  - `id`;
  - `user_id` (FK com CASCADE, NOT NULL);
  - `name` `String(120)`;
  - `portion_label` `String(60)`;
  - `portion_grams` `Float` (pode ser nulo);
  - `kcal` `Float` NOT NULL;
  - `protein_g`, `carbs_g` e `fat_g` `Float` (podem ser nulos);
  - `barcode` `String(14)` (pode ser nulo);
  - `created_at`.
  - Índice `ix_user_foods_user_id`. Unique `uq_user_foods_user_barcode (user_id, barcode)`.
- `UserFoodCreate`:
  - `name` (1–120, validador de nome do diário);
  - `portion_label` (1–60, padrão `"1 porção"`);
  - `portion_grams` (`gt=0, le=5000`, opcional);
  - `kcal` (`ge=0, le=5000`);
  - macros (`ge=0, le=1000`, opcionais);
  - `barcode` (opcional, `^[0-9]{8,14}$`).
- `UserFoodUpdate`: os mesmos campos, todos opcionais, com ao menos um. `barcode: null` desliga o código.
- `UserFoodResponse`: os campos do modelo, mais `food_ref: str` (`mine:<id>`).
- `UserFoodList { items: list[UserFoodResponse] }`.
- `diary_registro.opcao_do_mine(linha: UserFood) -> FoodOption` (a Frente B usa).
- `diary_registro.buscar_mine(db, user_id, food_id) -> UserFood | None`.
- `diary_registro.buscar_mine_por_barcode(db, user_id, barcode) -> UserFood | None`.
- Rotas em `/diary/foods/mine`:
  - `GET ?barcode=` lista do usuário, por nome; com `barcode`, 0 ou 1 item;
  - `POST` dá `201 UserFoodResponse`;
  - `GET /{id}`, `PATCH /{id}` e `DELETE /{id}` (este devolve `{ok:true}`).
  - Alheio ou inexistente: `404 {"code":"USER_FOOD_NOT_FOUND","message":"Alimento não encontrado."}`.
  - Código repetido: `409 {"code":"BARCODE_ALREADY_USED", ...}`.
  - Teto de 500 alimentos: `403 PLAN_LIMIT_REACHED` com `event_type: "user_foods"`.
  - Rate limit: 60/min na escrita e 120/min na leitura.

- [ ] Testes em `test_diary_user_foods.py`:
  - `test_cria_lista_edita_apaga_mine`;
  - `test_barcode_busca_e_unico_por_usuario` (409 no mesmo usuário, 201 no outro);
  - `test_barcode_invalido_422`;
  - `test_mine_alheio_404_identico` (GET, PATCH e DELETE);
  - `test_post_diary_com_mine` (150 kcal × 2 porções = 300; `source == "user"`; `is_estimate` falso);
  - `test_post_diary_com_mine_alheio_404_food_not_resolved`;
  - `test_entrada_sobrevive_a_apagar_mine`.
- [ ] Ver falhar, implementar e ver passar. Gerar a migração à mão; `test_migrations.py` passa em Postgres.
- [ ] Commit `feat(diario): alimento pessoal (mine:) com código de barras` e subir. Deixar uma nota para a Frente B na pasta compartilhada.

### Tarefa 2: receita no diário (`recipe:<id>`)

**Arquivos:**
- Alterar: `app/services/diary_registro.py` (`opcao_da_receita`) e `app/routers/diary.py` (`_resolver_food_ref`).
- Teste: `tests/test_diary_recipe_ref.py`.

**Interfaces:**
- `opcao_da_receita(db, user_id, recipe_id) -> FoodOption | None` (decisão 2), com `name` = título e `portion_label="porção"`.

- [ ] Testes:
  - `test_registra_porcoes_da_receita` (`calories` 450 × 1,5 porção = 675);
  - `test_receita_sem_calories_soma_ingredientes`;
  - `test_receita_sem_kcal_nao_resolve`;
  - `test_receita_privada_alheia_404`;
  - `test_receita_publica_alheia_resolve`;
  - `test_receita_unidade_g_422`.
- [ ] Ver falhar, implementar e ver passar. Commit e subir.

### Tarefa 3: recentes e frequentes

**Arquivos:** `routers/diary_foods.py`, `services/diary_registro.py`, `schemas/diary_registro.py` e o teste `tests/test_diary_recent_frequent.py`.

**Interfaces:**
- `QuickFood { food: FoodOption; quantity: float; unit: DiaryUnitType; meal_slot: MealSlotType; count: int }`. Quantidade, unidade e refeição são as da entrada mais recente daquele `food_ref`.
- `QuickFoodList { items: list[QuickFood] }`.
- `GET /diary/foods/recent?limit=20` (1–50): distintos por `food_ref`, ordenados pela entrada mais recente.
- `GET /diary/foods/frequent?limit=20`: últimos 30 dias, ordenados por contagem decrescente e, no empate, pelo mais recente.
- `resolver_refs(db, user_id, refs: list[str]) -> dict[str, FoodOption]`: **uma query por namespace**, nunca por item. O ref que não resolve sai da lista.

- [ ] Testes:
  - `test_recentes_distintos_mais_recente_primeiro`;
  - `test_frequentes_janela_30_dias`;
  - `test_recentes_ignora_ref_que_nao_resolve`;
  - `test_recentes_isolados_por_usuario`;
  - `test_limit_fora_da_faixa_422`.
- [ ] Ver falhar, implementar e ver passar. Commit e subir.

### Tarefa 4: copiar, repetir dia e lote

**Arquivos:**
- Alterar: `app/models/diary.py` (`copied_from_entry_id` e o índice único; mudança mínima fora da posse, dita no commit), `routers/diary.py`, `services/diary_registro.py` e `schemas/diary_registro.py`.
- Criar: a migração e os testes `tests/test_diary_copy.py` e `tests/test_diary_batch.py`.

**Interfaces:**
- `DiaryCopyRequest { from_date; to_date; meal_slot?: MealSlotType }`:
  - `to_date` na janela do RS-09;
  - `from_date != to_date`, senão 422.
- `POST /diary/copy` dá `200 DiaryDay` de `to_date`. Rate limit 30/min.
- `DiaryBatchRequest { entry_date; meal_slot; items: list[{food_ref, quantity, unit}] }`, com 1 a 30 itens.
- `POST /diary/batch` dá `201 DiaryDay`. Rate limit 30/min. É atômico.
- Refatorar o corpo de `criar_entrada` em `_montar_entrada(db, user_id, entry_date, meal_slot, food_ref, quantity, unit) -> DiaryEntry`, sem commit e levantando os mesmos erros. `POST /diary` e o lote usam essa função.
- **Correção junto:** `editar_entrada` referencia `opcao` inexistente (NameError no caminho da porção sem energia). Trocar por `entrada.kcal_per_base_unit` e cobrir com `test_patch_porcao_sem_energia_422`.

- [ ] Testes de copy:
  - `test_copia_dia_inteiro`;
  - `test_copia_so_um_slot`;
  - `test_copia_duas_vezes_nao_duplica`;
  - `test_corrida_integrity_error_nao_duplica` (cria a cópia por fora entre a checagem e o insert, via monkeypatch);
  - `test_copia_estoura_teto_403_nada_gravado`;
  - `test_copia_mesmo_dia_422`;
  - `test_copia_dia_vazio_200`;
  - `test_copia_isolada_por_usuario`.
- [ ] Testes de lote:
  - `test_lote_cria_todos`;
  - `test_lote_item_invalido_nada_gravado`;
  - `test_lote_teto_403`.
- [ ] Ver falhar, implementar e ver passar. Migração e `test_migrations`. Commit e subir.

### Tarefa 5: refeições prontas

**Arquivos:**
- Criar: `app/models/saved_meal.py` (`SavedMeal` e `SavedMealItem`), a migração e `tests/test_diary_saved_meals.py`.
- Alterar: `db/base.py`, `routers/diary.py`, `services/diary_registro.py` e `schemas/diary_registro.py`.

**Interfaces:**
- `saved_meals`: `id`, `user_id` (CASCADE), `name` `String(80)` e `created_at`.
- `saved_meal_items`: `id`, `saved_meal_id` (CASCADE), `position`, mais os campos de snapshot da entrada (`food_ref`, `food_name`, `source`, `base_unit`, `quantity`, `unit` e os `*_per_base_unit`).
- `SavedMealCreate { name; entry_date; meal_slot }`: copia as entradas daquele slot. Slot vazio dá `422 SAVED_MEAL_EMPTY`.
- `SavedMealResponse { id; name; calories; items: [{food_ref, food_name, quantity, unit, calories}]; created_at }`.
- `SavedMealLog { entry_date; meal_slot }`.
- Rotas:
  - `GET /diary/saved-meals`;
  - `POST /diary/saved-meals` (201);
  - `DELETE /diary/saved-meals/{id}`;
  - `POST /diary/saved-meals/{id}/log` dá `201 DiaryDay`, recalculando os totais a partir do snapshot.
  - Alheio: `404 SAVED_MEAL_NOT_FOUND`. Teto de 100 por usuário: `403 PLAN_LIMIT_REACHED`.

- [ ] Testes:
  - `test_salva_e_lista`;
  - `test_registra_refeicao_inteira`;
  - `test_salvar_slot_vazio_422`;
  - `test_refeicao_alheia_404_identico`;
  - `test_log_respeita_teto`.
- [ ] Ver falhar, implementar e ver passar. Commit e subir. **Fim do backend.**

### Tarefa 6: frontend (só com a F6 em `git log origin/main`)

**Arquivos:** `src/pages/registrar/*`, `src/pages/alimentos/*`, `src/lib/useFoodSearch.ts` e os tipos anexados em `src/types.ts`. Mudança mínima, dita no commit.

- [ ] `api` e tipos: `UserFood`, `QuickFood`, `SavedMeal`, `DiaryCopyRequest` e `DiaryBatchRequest`, espelhando `schemas/diary_registro.py`.
- [ ] `Registrar` no `RegistrarOutlet`:
  - abas Buscar · Recentes · Frequentes · Meus · Receitas;
  - carrinho com "Salvar" (`/diary/batch`) e aviso com "Desfazer" (apaga os ids novos);
  - folha de porção com botão de código de barras para `ROUTES.codigoDeBarras`.
- [ ] `/alimentos`, `/alimentos/novo?barcode=` e `/alimentos/:id`.
- [ ] Arrastar para apagar com desfazer (recria pelo `food_ref` e quantidade). Menus de refeição e de dia (spec §7). `HojeSlots.Repetir`: "Repetir café de ontem".
- [ ] Testes Vitest de cada peça, e o fluxo no navegador interno a 375 e 1280 px, claro e escuro.
