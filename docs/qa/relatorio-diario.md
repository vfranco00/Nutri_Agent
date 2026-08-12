# Relatório de QA — Diário Alimentar

Auditoria da feature entregue, contra o contrato `docs/adr/0001-diario-alimentar.md`
(ADR-0001) e os requisitos de `docs/adr/0002-requisitos-seguranca-diario.md`.

- Baseline da suíte backend antes da auditoria: **411 passed, 2 skipped** (`cd backend && ./.venv/bin/python -m pytest -q`).
- Nada de código de aplicação foi alterado. Só foram acrescentados testes com prefixo `test_achado_` / `achado_`.
- **Fora de escopo por instrução do dono**: navegação de dia por setas no `DiaryLog`;
  macros `UNVERIFIED` de `app/data/taco_foods.py`; `UniqueConstraint` duplicada em `payments.mp_payment_id`.

## Índice dos achados

| # | Severidade | Título | Teste que prova |
|---|---|---|---|
| A-01 | Alta | Formulário de porção abre com quantidade `100` mesmo para alimento de unidade — 100 ovos, 7.000 kcal, aceitos em silêncio | `backend/tests/test_achado_diario.py::test_achado_a01_*` |
| A-02 | Alta | Resposta de mutação fora de ordem ressuscita entrada apagada (duas exclusões rápidas) | `frontend/src/lib/achado_useDiaryDay.concorrencia.test.ts` |
| A-03 | Média | `POST /diary` devolve **500** quando o `food_ref` aponta para linha de `food_cache` com `unit_type` fora de `g\|ml\|un` | `backend/tests/test_achado_diario.py::test_achado_a03_*` |
| A-04 | Média | `GET /diary/summary` faz 1 query de binding **por dia** (32 queries num intervalo de 31 dias), contrariando a própria docstring | `backend/tests/test_achado_diario.py::test_achado_a04_*` |
| A-05 | Média | Resolve com IA acima do teto de escrita de cache devolve `cache:0`, que o `POST /diary` recusa com 404 — cota consumida, alimento inutilizável | `backend/tests/test_achado_diario.py::test_achado_a05_*` |
| A-06 | Baixa | Quantidade muito pequena grava entrada com `calories_total = 0.0` | `backend/tests/test_achado_diario.py::test_achado_a06_*` |
| A-07 | Baixa | `PATCH` com campo explicitamente `null` passa pelo "ao menos um campo" e vira 200 sem efeito | `backend/tests/test_achado_diario.py::test_achado_a07_*` |
| A-08 | Baixa | Soma dos blocos exibidos ≠ total exibido: `formatKcal` arredonda cada valor a inteiro na tela | `frontend/src/lib/achado_formatKcal.test.ts` |
| A-09 | Baixa | Entrada com `meal_slot` fora das 6 chaves entra em `totals` mas em nenhum slot | (não reproduzível pela API — só por escrita direta no banco) |
| A-10 | Baixa | Mutação que devolve outra data provoca um `GET /diary` extra e um piscar de esqueleto — D-6 exige "zero refetch" | `frontend/src/lib/achado_useDiaryDay.dataNova.test.ts` |

### Como rodar os testes desta auditoria

```bash
cd backend  && ./.venv/bin/python -m pytest tests/test_achado_diario.py -q   # 5 failed, 1 passed
cd frontend && npm test -- achado_                                           # 4 failed
```

Suítes existentes seguem intactas: backend 411 passed / 2 skipped antes e depois;
frontend 94 passed antes e depois.

---

## A-01 — Formulário de porção abre com `100` mesmo quando a unidade é "unidade"

**Severidade: Alta** (corrompe dado, silenciosamente, no caminho mais comum da tela)

**Arquivo:** `frontend/src/pages/DiaryLog.tsx:477` — `const [quantity, setQuantity] = useState("100");`

**Passo a passo**

1. Entrar em `/diario`.
2. Buscar `ovo`.
3. Clicar no resultado **"Ovo"** (o item de `base_unit: "un"`, 70 kcal por unidade — `catalog:ovo-un`).
4. O `PortionForm` abre com **Quantidade = 100** e Unidade = **unidade** (primeira de `allowed_units`).
5. Clicar em "Adicionar ao diário" sem mexer na quantidade.

**O que acontece**

`POST /diary` com `{quantity: 100, unit: "un"}` retorna **201** e o dia passa a ter
`totals = {calories: 7000.0, protein_g: 630.0, carbs_g: 40.0, fat_g: 480.0}`.
Nada na tela avisa: o teto de plausibilidade do RS-10 só corta acima de 20.000 kcal
(`backend/app/services/diary_math.py:64`) e o `le=10_000` de `quantity`
(`backend/app/schemas/diary.py:149`) trata 100 unidades como quantidade normal.

**O que deveria acontecer**

O valor inicial tem que depender de `food.base_unit` / da unidade escolhida: `100` só faz
sentido para `g`/`ml`. Para unidade de contagem (`un`, `fatia`, `porcao`) o padrão razoável
é `1`. O ADR-0001 § 4.0 existe justamente para impedir que "por 100 g" e "por unidade" se
confundam — a interface reintroduziu a confusão no lugar em que o usuário não a vê.

**Nota de escopo**: o backend está correto aqui — 70 × 100 = 7000 é a conta certa para o
que foi pedido. O defeito é do valor inicial do formulário. Correção é de `ui-senior`.

**Teste que falha**: `frontend/src/pages/achado_DiaryLog.porcao.test.tsx` — busca "ovo",
seleciona o item de `base_unit: "un"` e assere que o campo Quantidade **não** abre em
`100`. Falha hoje.

**Teste de apoio (passa)**: `backend/tests/test_achado_diario.py::test_achado_a01_unidade_de_contagem_com_quantidade_de_gramas`
fixa o número que o servidor aceita — 100 un de ovo = `totals.calories = 7000.0`, `201`.
Está lá para provar que nenhuma rede do backend pega o caso.

---

## A-02 — Duas exclusões rápidas: resposta fora de ordem ressuscita a entrada apagada

**Severidade: Alta** (o usuário vê dado errado e o total da barra fica errado até recarregar)

**Arquivo:** `frontend/src/lib/useDiaryDay.ts:91-99` (`aplicarResposta`), com os chamadores
em `:101-145`. E `frontend/src/pages/DiaryLog.tsx:679-686`: o botão de apagar **não** tem
`disabled={mutating}` (o de "dia anterior/próximo" tem; o de apagar e o de editar não).

**Passo a passo**

1. Um dia com duas entradas, A e B.
2. Clicar na lixeira de **A**, confirmar.
3. Antes de a resposta de A chegar, clicar na lixeira de **B** e confirmar.
4. A resposta de **B** chega primeiro (rede móvel, retry de proxy, qualquer reordenação).

**O que acontece**

`aplicarResposta` aplica incondicionalmente o corpo de cada mutação. Ela até incrementa
`requisicaoAtual.current` (para invalidar um `GET` em voo), mas **nenhuma mutação verifica
esse contador** — o guard existe só no `useEffect` do `GET`. Resultado: a resposta de B
(dia sem A e sem B) é sobrescrita pela resposta de A (dia sem A, **com B**). A entrada B
volta a aparecer na lista e volta a ser contada em `totals.calories`, embora esteja apagada
no banco. Recarregar a página conserta — mas o usuário não sabe que precisa.

**O que deveria acontecer**

Duas defesas, e as duas faltam: (a) o botão de apagar/editar desabilitado enquanto
`mutating` for `true`; (b) o mesmo guard de sequência que o `GET` já usa aplicado às
mutações — só a resposta da última mutação disparada pode virar estado.

**Teste que falha**: `frontend/src/lib/achado_useDiaryDay.concorrencia.test.ts`
(`cd frontend && npm test -- achado_useDiaryDay`). Ele resolve as duas promessas de
`DELETE` fora de ordem e assere que a entrada apagada não reaparece — falha hoje.

---

## A-03 — `POST /diary` devolve 500 com `food_ref` de cache cujo `unit_type` não é `g`/`ml`/`un`

**Severidade: Média** (500 não tratado, alcançável por usuário autenticado; linha envolvida é *compartilhada*)

**Arquivos:**
- `backend/app/services/diary_foods.py:155-168` — `opcao_do_cache` monta
  `FoodOption(base_unit=linha.unit_type, ...)` sem validar o domínio.
- `backend/app/schemas/diary.py:24` — `FoodBaseUnitType = Literal["g","ml","un"]`.
- `backend/app/routers/diary.py:130-143` — `_resolver_food_ref`, branch `cache:`.
- Origem do dado ruim: `backend/app/routers/ai.py:51` — `unit: str = Field(min_length=1, max_length=40)`,
  texto livre, gravado direto em `food_cache.unit_type` por `backend/app/services/ai.py:219-224`.

**Passo a passo**

1. `POST /ai/calculate-calories` com `{"name": "rap10 zz", "quantity": 1, "unit": "unidade"}` → `200`.
   Isso grava em `food_cache` a linha `(unit_type="unidade", source="taco", created_by_user_id=NULL)`.
   `source="taco"` + dono `NULL` = linha **compartilhada**, visível a todos os usuários.
2. `POST /diary` com `{"entry_date": hoje, "meal_slot": "almoco", "food_ref": "cache:<id daquela linha>", "quantity": 1, "unit": "un"}`.

**O que acontece**

`500 {"detail": "Erro interno."}` — o `FoodOption` estoura `ValidationError` de Pydantic
dentro do router e ninguém captura. Vai para o coletor de log como erro de servidor.

**O que deveria acontecer**

Linha de cache com `unit_type` fora do domínio é dado que não dá para servir: o correto é
tratá-la como não resolvida (`404 FOOD_NOT_RESOLVED`, o mesmo corpo do id inexistente),
nunca 500. `diary_math.allowed_units()` já devolve `[]` para base desconhecida — o
resolvedor é que não checa antes de montar o schema.

**Teste que falha**: `backend/tests/test_achado_diario.py::test_achado_a03_cache_com_unit_type_invalido_nao_pode_dar_500`.

---

## A-04 — `GET /diary/summary` resolve o binding com uma query por dia

**Severidade: Média** (custo de pool; a docstring afirma o oposto)

**Arquivos:**
- `backend/app/routers/diary.py:264-268` — a docstring afirma: *"a resolução de binding
  reaproveitada por dia sobre o mesmo plano já carregado — **nunca uma query por dia**"*.
- `backend/app/routers/diary.py:309-315` — o laço chama `diary_plan.resolver_dia_do_plano`
  a cada iteração.
- `backend/app/services/diary_plan.py:64-77` — cada chamada emite um `SELECT` novo em
  `diary_plan_bindings`.

**Passo a passo**

1. Usuário com um `diary_plan_binding` vigente.
2. `GET /diary/summary?start=<hoje-31>&end=<hoje>`.

**O que acontece**

38 queries no total, das quais **32 são o mesmo `SELECT` em `diary_plan_bindings`** — uma
por dia do intervalo (medido com listener `before_cursor_execute` no engine da suíte).

**O que deveria acontecer**

O binding não muda dentro do intervalo na maioria dos casos; o § 6.8 do ADR-0001 desenha a
rota como "uma query agregada + a resolução sobre **o mesmo plano já carregado**", e o § 11
justifica o desenho inteiro pelo pool de 5+5 conexões por processo compartilhado com o
APScheduler. 32 round-trips por chamada da fita da semana é exatamente o custo que D-4
existe para evitar. Ou a implementação resolve os bindings de uma vez, ou a docstring
mente sobre o que o código faz.

**Teste que falha**: `backend/tests/test_achado_diario.py::test_achado_a04_summary_nao_pode_ter_uma_query_de_binding_por_dia`.

---

## A-05 — Alimento estimado acima do teto de escrita de cache não pode ser registrado

**Severidade: Média** (cota paga consumida, e o caminho termina em beco sem saída)

**Arquivos:**
- `backend/app/services/diary_foods.py:44` — `TETO_LINHAS_CACHE_POR_DIA = 50`.
- `backend/app/services/diary_foods.py:462-480` — `_opcao_efemera` devolve `food_ref="cache:0"`.
- `backend/app/routers/diary.py:127-129` — `cache:0` não resolve → `404 FOOD_NOT_RESOLVED`.
- `backend/app/core/plan_limits.py:58` — `pro.diary_food_resolve.limit = 200`, ou seja, a
  cota do plano é 4× maior que o teto de escrita de cache.

**Passo a passo**

1. Conta `pro`. Resolver com IA 50 alimentos novos no dia (dentro da cota de 200).
2. Resolver o 51º: `POST /diary/foods/resolve` devolve **200** com um `FoodOption` completo,
   `food_ref: "cache:0"`, e **debita a cota** (`log_usage` em `routers/diary_foods.py:123`).
3. A tela mostra o alimento, com calorias e badge "Estimativa", e abre o formulário de porção.
4. Clicar em "Adicionar ao diário".

**O que acontece**

`404 FOOD_NOT_RESOLVED` → a tela mostra *"Não encontramos esse alimento. Tente outro nome."*
(`frontend/src/lib/diary.ts:392-394`). A mensagem é falsa: o alimento foi encontrado, o
usuário pagou por isso, e não há nada que ele possa fazer para registrá-lo. Repetir a busca
repete o ciclo e consome mais cota.

**O que deveria acontecer**

O comportamento é deliberado no código (o docstring de `_opcao_efemera` o explica), mas o
resultado observável não é aceitável: ou o resolve sinaliza que o item não é registrável
(e a interface não abre o formulário de porção), ou o teto de escrita não pode ser menor
que a cota do plano. Do jeito que está, o RS-22 é violado no espírito — uma falha se
disfarça de resultado, e depois vira "esse alimento não existe".

**Teste que falha**: `backend/tests/test_achado_diario.py::test_achado_a05_alimento_estimado_acima_do_teto_de_cache_nao_registra`.

---

## A-06 — Quantidade muito pequena grava entrada com `calories_total = 0.0`

**Severidade: Baixa**

**Arquivo:** `backend/app/services/diary_math.py:96-99` (`round(kcal_por_base * fator, 1)`),
sem piso; `backend/app/schemas/diary.py:149` (`quantity: gt=0`).

**Passos**: `POST /diary` com `catalog:arroz-branco-cozido-g`, `quantity: 0.01`, `unit: "g"`.

**O que acontece**: `201`. A linha é persistida com `calories_total = 0.0`
(1.28 × 0.01 = 0.0128 → arredonda para 0.0), aparece na lista como "0 kcal" e ocupa uma das
60 vagas do teto do RS-11.

**O que deveria acontecer**: o § 9.4 do ADR-0001 é enfático sobre `0` ser uma afirmação
nutricional que ninguém fez. Uma quantidade que arredonda para zero deveria ser recusada
(`422`, na mesma família do `gt=0`) em vez de virar linha de `0.0` no diário.

---

## A-07 — `PATCH` com campo explicitamente `null` vira 200 sem efeito

**Severidade: Baixa**

**Arquivo:** `backend/app/schemas/diary.py:185-189` — `pelo_menos_um_campo` testa
`self.model_fields_set == set()`.

**Passos**: `PATCH /diary/{id}` com corpo `{"quantity": null}`.

**O que acontece**: `200` com o `DiaryDay` inalterado. `model_fields_set` contém `"quantity"`
(foi enviado), então a validação de "ao menos um campo" passa; depois o router faz
`payload.quantity if payload.quantity is not None else entrada.quantity` e não muda nada.
O `gt=0` também não é aplicado a `None`.

**O que deveria acontecer**: `422`, pelo mesmo motivo que o corpo `{}` dá `422`. Um `PATCH`
que não pede mudança nenhuma não é uma edição bem-sucedida; hoje a interface mostraria
"Registro atualizado." para uma operação que não atualizou nada.

---

## A-08 — Soma dos números exibidos ≠ total exibido

**Severidade: Baixa** (cosmético, mas é exatamente a divergência que o § 9.3 existe para evitar)

**Arquivo:** `frontend/src/lib/diary.ts:59-61` —
`formatKcal` usa `maximumFractionDigits: 0`.

**Passos**: um dia com duas entradas em slots diferentes, de `100.5` e `200.5` kcal
(valores que o backend produz e persiste com 1 casa; `totals.calories` = `301.0`).

**O que acontece**: a linha do tempo mostra `101` e `201` (o `Intl` arredonda meio para
cima); o total no topo mostra `301`. O usuário que somar o que está escrito acha `302`.

**O que deveria acontecer**: o § 9.3 do ADR-0001 escolhe deliberadamente "o total que fecha
com o que está escrito" e proíbe o cliente de arredondar valor nutricional
(`§ 9.3, regra 4`). Arredondar para inteiro **na exibição** reintroduz a divergência num
nível abaixo. Ou a tela mostra a casa decimal que a API entregou, ou o backend passa a
arredondar para inteiro e as duas pontas concordam.

---

## A-09 — Entrada com `meal_slot` fora das 6 chaves entra em `totals` e em nenhum slot

**Severidade: Baixa** — **não reproduzível pela API**, registrado como observação de código.

**Arquivo:** `backend/app/services/diary_plan.py:146` —
`por_slot.setdefault(entrada.meal_slot, []).append(entrada)`.

Uma entrada com slot desconhecido cria uma chave nova em `por_slot`, mas `slots` só itera
`MEAL_SLOT_ORDER` — a entrada fica fora da tela. Já `totals.calories` (linha 171) soma
**todas** as entradas do dia, e `entries_count` (linha 186) conta todas. Resultado: um total
que não bate com nenhuma linha visível.

Não consegui reproduzir pela API: o `Literal` de `MealSlotType` barra na escrita, e o
`PATCH` também. Só acontece com escrita direta no banco ou com dado anterior a este código.
O comentário no próprio arquivo (linhas 143-145) prevê o caso e diz que a entrada "fica fora
da tela" — mas não menciona que ela continua no total. Fica como risco documentado, não como
bug confirmado.

---

## A-10 — Mutação que devolve outra data provoca um `GET` extra e um piscar de esqueleto

**Severidade: Baixa**

**Arquivo:** `frontend/src/lib/useDiaryDay.ts:91-99` (`aplicarResposta` faz
`setDate(novo.date)`) combinado com `:54-78` (o `useEffect` do `GET` depende de `date`).

**Passo a passo**

1. Editar uma entrada mudando `entry_date` (ou qualquer mutação cuja resposta traga uma
   data diferente da que está na tela — o § 6.6 prevê exatamente isso).
2. O `PATCH` devolve `200` com o `DiaryDay` da data **nova**.

**O que acontece**

O hook aplica a resposta (correto) **e** muda `date`, o que dispara o `useEffect` e refaz
`GET /diary?date=<data nova>` — a mesma data que o corpo do `PATCH` acabou de entregar.
Além da chamada extra, o efeito chama `setStatus("loading")`, e a lista pisca em esqueleto
logo depois de uma edição bem-sucedida.

**O que deveria acontecer**

D-6 é literal: *"Toda mutação devolve o `DiaryDay` recalculado — um dono da aritmética,
**zero refetch**"*. A navegação para a data nova tem que acontecer sem reabrir o `GET`
(por exemplo, marcando que aquela data já está satisfeita pelo corpo da mutação).

**Teste que falha**: `frontend/src/lib/achado_useDiaryDay.dataNova.test.ts` — assere que
só houve um `GET /diary` (o do carregamento inicial). Hoje há dois.

---

## Verificações que passaram (não são achados)

Registrado para que ninguém refaça o trabalho:

- **Aritmética do backend** (§ 9.3): os cinco exemplos verificáveis do ADR conferem;
  `100 g de arroz = 128.0`. Fator intermediário não é arredondado. `somar` soma valores já
  arredondados e re-arredonda, como o contrato manda.
- **Macro `None`**: ignorado na soma, nunca tratado como zero; `macros_incomplete` sobe
  corretamente; a tela renderiza `—` (`formatGrams`, `frontend/src/lib/diary.ts:65-68`).
- **Unidades**: `un` com `xicara` e `g` com `un` devolvem `422 UNIT_NOT_SUPPORTED_FOR_FOOD`,
  nos dois sentidos. `allowed_units` sai sempre do servidor e o `<select>` do
  `PortionForm` é montado a partir dele (`DiaryLog.tsx:561`), como o § 9.2 exige.
- **Teto de plausibilidade**: 10.000 ml de azeite e 41 xícaras de azeite devolvem `422` com
  `detail` em **lista** (formato de validação), como `_quantidade_implausivel` documenta.
- **Busca**: termo vazio, só espaços, 1 caractere, `%` e `_` isolados e termo de 61
  caracteres devolvem `422`; acento funciona nos dois sentidos (`maçã`, `MAÇÃ` e `maca`
  devolvem os mesmos 4 resultados) porque `buscar_no_catalogo` normaliza o termo antes do
  `ILIKE`. O escape de `LIKE` está aplicado (`escapar_like`).
- **Debounce e cancelamento** (`frontend/src/lib/useFoodSearch.ts:44-83`): o contador de
  requisição é incrementado no *disparo* do timer, então a resposta de uma busca antiga é
  descartada mesmo chegando depois; apagar o campo abaixo de 2 caracteres invalida a busca em
  voo. O debounce é 350 ms, acima dos 300 ms exigidos. Não encontrei defeito aqui.
- **Fuso horário**: `toIsoDate` monta a data em fuso **local** (não usa `toISOString`) e
  `fromIsoDate` usa `parseISO` de data pura, que também não desloca. Virada de mês e de ano
  em `shiftIsoDate` usam `setDate`, que trata o rollover. A janela do RS-09 é medida em UTC
  no servidor com folga de +1 dia, o que cobre o usuário em UTC-3 em qualquer hora do dia.
  **Não encontrei bug de fuso.**
- **Escopo por usuário**: `_buscar_entrada` e `_resolver_food_ref` carregam o filtro de
  `user_id` dentro do `WHERE`; recurso alheio devolve `404` com corpo idêntico ao de id
  inexistente.
- **Ordem de `include_router`** (§ 6.0): `diary_foods` antes de `diary` em
  `backend/app/main.py:195-196`. Correto.
- **Registro no metadata** (§ 4.6): `FoodCatalog`, `DiaryEntry` e `DiaryPlanBinding` estão
  em `backend/app/db/base.py:35-36`. Correto.
- **Dia vazio**: `GET /diary` de um dia sem nada devolve `200` com os 6 slots presentes e
  zerados; a tela mostra o vazio convidativo (`EmptyDayCard` / `LoggedList`).
