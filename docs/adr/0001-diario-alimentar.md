# ADR-0001 — Diário Alimentar: modelo de dados e contrato de API

- **Status**: proposto (pronto para implementação em paralelo por backend e frontend)
- **Data**: 2026-08-11
- **Branch**: `feature/diario-alimentar`
- **Documento irmão**: [`0002-requisitos-seguranca-diario.md`](0002-requisitos-seguranca-diario.md) (RS-01..RS-30). Este ADR **não repete** os requisitos de lá; ele materializa em tabela, migration e rota o que aquele documento exige.

> **Este documento é contrato.** Dois agentes (backend e frontend) o implementam **em paralelo**, sem se falar. Nome de coluna, nome de campo JSON, código de erro e tipo de retorno aqui são literais, não sugestões.

## Sumário

1. [Contexto](#1-contexto)
2. [Opções consideradas](#2-opções-consideradas)
3. [Decisão](#3-decisão)
4. [Modelo de entidades](#4-modelo-de-entidades)
5. [Migration Alembic](#5-migration-alembic)
6. [Contrato REST](#6-contrato-rest)
7. [Tipos TypeScript](#7-tipos-typescript)
8. [Limites de plano](#8-limites-de-plano)
9. [Unidades e arredondamento](#9-unidades-e-arredondamento)
10. [Consequências](#10-consequências)
11. [Limites da plataforma verificados](#11-limites-da-plataforma-verificados)
12. [Handoffs](#12-handoffs)
13. [Checklist de sincronia entre os dois agentes](#13-checklist-de-sincronia-entre-os-dois-agentes)

---

## 1. Contexto

O produto vai ganhar um diário alimentar: buscar alimento, escolher quantidade e unidade, jogar num slot de refeição e ver o total do dia contra a meta calórica. O dono do produto já fechou o escopo (busca TACO + porção + slot + totais; sem código de barras, sem alimento personalizado, sem receita própria como item) e a origem dos macros (TACO estendida; fora da tabela cai em IA, cacheado e **marcado como estimativa na interface**). Este ADR não reabre nada disso — ele decide o que sobrou, que é tudo que tem nome de coluna e nome de rota.

### Restrições reais

| Restrição | Consequência de desenho |
|---|---|
| Runtime **Node não existe aqui**: FastAPI (Python 3.12) atrás do proxy do Render, que corta request em ~100 s | Nada de caminho interativo longo; RS-23 já fixa 10 s pro resolvedor |
| Postgres via **pooler do Supabase em session mode**, `pool_size=5` + `max_overflow=5` por processo (`app/db/session.py:26-28`) | A tela do dia não pode custar N queries por slot. Ver decisão D-4 |
| **APScheduler roda no mesmo processo** e disputa o mesmo pool (`core/scheduler.py`) | Job de retenção tem que ser barato e raro (§ 8.4) |
| Testes rodam em **SQLite in-memory** (`tests/conftest.py:15`), produção em **Postgres** | Migration só pode usar o que existe nos dois: `batch_alter_table`, índice parcial, nada de `JSONB` |
| Suíte verde hoje: **231 passed** | `TACO_PER_100G` e `TACO_PER_UNIT` não podem sumir — `services/ai.py:126-136` depende deles |
| Head do Alembic: `c4f8b1d90a27` | `down_revision` obrigatório (§ 5) |
| Já existe o [ADR-0002](0002-requisitos-seguranca-diario.md) com 30 requisitos | Este ADR é **subordinado** a ele. Onde os dois divergem, § 3.3 lista a divergência e o motivo |

### O que estava indefinido antes deste documento

1. **`food_cache` é global e envenenável** (RS-17 + achado A-3, severidade Alta). A tabela não tem procedência: uma linha escrita a partir da Open Food Facts — base wiki, editável por qualquer pessoa do mundo — é indistinguível de uma linha vinda da TACO, e é servida a todos os usuários. Resolver isso muda o modelo de dados e exige migration.
2. **A TACO só tem kcal.** `TACO_PER_100G: dict[str, float]` não comporta proteína/carboidrato/gordura.
3. **O "planejado" não tem data.** `MealPlanDay` tem `day_label` (`"Segunda-feira"`) e `day_index` (int) — **nenhuma coluna de calendário**. Hoje é impossível responder "o que estava planejado para 2026-08-11". Sem resolver isso, a barra segmentada do dashboard não existe.
4. **Retenção** (RS-30) estava explicitamente delegada a este documento.

---

## 2. Opções consideradas

### 2.1 Partição do `food_cache` (RS-17)

| Opção | Trade-off |
|---|---|
| **A — Manter global, só validar melhor** (faixa de plausibilidade do RS-18 + verificação de nome do RS-21, sem particionar) | Barato: zero migration, zero mudança de leitura. Mas a defesa passa a ser *só* a faixa de plausibilidade — e um valor **dentro** da faixa e **errado** (coxinha a 90 kcal/100 g em vez de 290) passa por ela e vale para todo mundo, para sempre. Reduz a magnitude do envenenamento, não o envenenamento. |
| **B — Tudo por usuário** (`created_by_user_id NOT NULL`, nenhuma linha compartilhada) | Isolamento total e regra trivial de auditar. Mas joga fora o cache das linhas TACO, que são a maioria dos acertos e são confiáveis por construção — cada usuário recomeça do zero, e a tabela cresce ~N vezes sem ganho de segurança nenhum (dado determinístico versionado no repositório não vaza nada sobre ninguém). |
| **C — Partição por procedência** (`source` decide se compartilha) | Exige migration, uma coluna a mais na chave de leitura e dois índices únicos parciais. Em troca, compartilha exatamente o que é seguro compartilhar (`taco`, `curated`) e isola exatamente o que não é (`openfoodfacts`, `llm`). |

### 2.2 Ancoragem do planejado no calendário

| Opção | Trade-off |
|---|---|
| **A — `meal_plan_days.plan_date: Date`** | Uma coluna, migration mínima. Mas mata o cardápio como *template*: um plano semanal passa a valer para uma semana específica e reusá-lo exige clonar 7 dias e 28 refeições. Além disso, dois planos podem reivindicar a mesma data e nada no schema impede. |
| **B — Sem tabela: o frontend manda `meal_plan_id` na query da tela do dia** | Zero backend novo. Mas a associação vira estado de `localStorage`: dois dispositivos discordam, o histórico não é reproduzível, e a tela precisa primeiro listar os planos pra saber qual mandar — que é exatamente a chamada extra que o enunciado proíbe. |
| **C — Tabela de vínculo `diary_plan_bindings`** (`meal_plan_id` + `start_date`, o plano cicla) | Uma tabela de 6 colunas. O plano continua template, o vínculo é durável e por usuário, e a resolução "qual dia do plano cai em D" é aritmética de inteiros sem query extra. Custo: um conceito novo pro usuário entender ("ativar cardápio a partir de tal dia"). |

### 2.3 Identificação do alimento no `POST /diary`

| Opção | Trade-off |
|---|---|
| **A — `food_name` em texto livre** (o que o ADR-0002 assumiu) | Espelha o `/ai/calculate-calories` de hoje. Mas o servidor tem que **re-resolver** o nome na escrita — e se o alimento só existe via IA, `POST /diary` vira um caminho pago disfarçado de escrita barata, furando a separação que o RS-16 construiu. Ainda: o nome do alimento (dado de saúde) volta a entrar por texto livre em toda criação, ampliando a superfície do RS-08/RS-27. |
| **B — `food_ref` opaco** (`catalog:<slug>` ou `cache:<id>`), obtido da busca ou do resolve | O cliente precisa de dois passos (achar → registrar), e o contrato ganha um formato de string que precisa ser respeitado literalmente. Em troca: `POST /diary` é **um SELECT por id**, nunca chama LLM nem rede externa, e o escopo do RS-17 é aplicado no próprio `WHERE` da resolução. |

### 2.4 Onde o total do dia é somado

| Opção | Trade-off |
|---|---|
| **A — Backend devolve as entradas; o frontend soma** | Menos payload. Mas os dois lados arredondam por conta própria e a barra passa a discordar da soma visível das linhas — divergência silenciosa, sem teste que pegue, exatamente o modo de falha que este documento existe pra evitar. |
| **B — Backend devolve os totais já somados e arredondados; o frontend nunca soma** | O payload da mutação cresce (≤ 60 entradas, teto do RS-11). Em troca há **um** dono da aritmética, e a regra fica verificável num teste só. |

---

## 3. Decisão

### 3.1 As sete decisões

| # | Decisão | Porquê, em uma linha |
|---|---|---|
| **D-1** | `food_cache` particionado por procedência — **opção 2.1-C** | Compartilha o que é determinístico e versionado; isola o que veio de wiki público e de modelo não determinístico |
| **D-2** | Linhas atuais de `food_cache` são **apagadas** na migration | Não têm procedência: reclassificá-las é adivinhação, e o achado A-3 diz que parte delas pode já estar envenenada |
| **D-3** | Vínculo cardápio↔calendário em `diary_plan_bindings` — **opção 2.2-C** | Mantém o cardápio reusável e torna "o planejado do dia D" uma pergunta com resposta única |
| **D-4** | **`GET /diary?date=` devolve o dia inteiro composto** — entradas, totais, meta e planejado, em ≤ 5 queries e **1 chamada HTTP** | O pool tem 5+5 conexões por processo; a tela do dia não pode custar uma chamada por slot |
| **D-5** | O alimento é identificado por **`food_ref`** — **opção 2.3-B** | `POST /diary` deixa de ser um caminho pago disfarçado; o escopo do RS-17 entra no `WHERE` |
| **D-6** | **Toda mutação devolve o `DiaryDay` recalculado** — **opção 2.4-B** | Um dono da aritmética, zero refetch, zero soma no cliente |
| **D-7** | Retenção **por tabela**, não global: diário vive enquanto a conta viver; `food_cache` não confiável expira em **90 dias** | O histórico *é* o produto; o que precisa expirar é o dado não confiável, não o dado do usuário |

### 3.2 Como as duas entidades coexistem

São **entidades distintas que nunca se referenciam**, e essa é a decisão, não um detalhe:

```
meal_plans / meal_plan_days / meal_plan_meals   →  o PLANEJADO   (template, sem data)
                    ▲
                    │ diary_plan_bindings (user_id, meal_plan_id, start_date)
                    │        "este cardápio vale a partir de tal dia, e cicla"
                    ▼
                 calendário  ──────────────────────────────────────┐
                                                                   │
diary_entries (user_id, entry_date, ...)        →  o REGISTRADO   ─┘
```

- **Não há FK de `diary_entries` para `meal_plan_meals`.** Comer o que estava planejado e comer outra coisa produzem a mesma linha de diário. O diário é o fato; o plano é a intenção. Ligá-los obrigaria a decidir "esta entrada cumpre aquela refeição?", que é uma pergunta de produto que ninguém fez.
- **O cruzamento acontece na leitura, por data e por slot** — nunca no banco. `GET /diary?date=` resolve o binding, calcula `day_index`, carrega as refeições daquele dia do plano e as coloca lado a lado com as entradas, slot a slot.
- **Consequência aceita**: mudar o cardápio vinculado muda retroativamente a metade hachurada da barra de dias passados. É o comportamento correto — a barra hachurada mostra "o que o seu cardápio atual prevê para uma segunda-feira", não "o que você tinha planejado naquele dia". Congelar o planejado exigiria copiar o plano inteiro por dia, e o dono do produto pediu escopo enxuto.

### 3.3 Divergências deliberadas em relação ao ADR-0002

Quatro pontos deste ADR divergem da superfície que o ADR-0002 assumiu. O próprio ADR-0002 previu isso ("Se o desenho mudar, os requisitos continuam valendo — o que muda é onde eles se aplicam"). Estão listados aqui para que ninguém trate a diferença como erro de digitação.

| # | ADR-0002 assumiu | Este ADR decide | Motivo |
|---|---|---|---|
| **Δ1** | `POST /diary` recebe `food_name` (RS-07, RS-08) | Recebe `food_ref`; **não existe `food_name` no corpo** | § 2.3. RS-07/RS-08 continuam valendo, aplicados a `POST /diary/foods/resolve.name` e a `GET /diary/foods/search.q`. Um `food_name` no corpo vira `422` pelo `extra="forbid"` do RS-02 — o teste do RS-12 continua passando. |
| **Δ2** | Unique de `food_cache` = `(name_normalized, unit_type, source)` (RS-19) | Dois índices **únicos parciais** (§ 4.3) | Com RS-17, dois usuários resolvendo o mesmo nome via LLM colidiriam. O parcial mantém a deduplicação global das linhas confiáveis e permite uma linha por usuário nas não confiáveis. |
| **Δ3** | Disjuntor aberto degrada para `404 FOOD_NOT_FOUND` (RS-23) | `503 FOOD_RESOLVER_UNAVAILABLE` | RS-22 existe para que falha nunca se disfarce de resultado. Um `404` durante indisponibilidade é a mesma mentira que o `0.0` do achado A-5, um nível acima: o usuário conclui "esse alimento não existe" e desiste. O `503` não revela nada (o disjuntor é global, não por usuário). |
| **Δ4** | `GET /diary?date=` devolve entradas + totais (RS-05) | Devolve o **dia composto**: entradas, totais, meta e planejado | D-4. RS-05 continua valendo integralmente: o filtro `user_id` está na mesma query que o filtro de data, e o total sai daquele conjunto. |

---

## 4. Modelo de entidades

### 4.0 Vocabulário único: "por unidade base"

Três tabelas guardam valor nutricional. Todas guardam **por unidade base**, nunca por 100 g:

> `kcal_per_base_unit` = quilocalorias de **1 g**, **1 ml** ou **1 unidade** do alimento, conforme `base_unit`.

A TACO publica por 100 g e o arquivo `taco_foods.py` continua assim (é como o dado é revisável). A divisão por 100 acontece **uma vez**, no seeder (§ 4.2), e nunca mais. `FoodCache.calories_per_unit` já é por unidade base hoje (`models/food_cache.py:22`) — o vocabulário só está sendo nomeado, não mudado.

Motivo de existir esta seção: "por 100 g" e "por unidade" convivendo em tabelas diferentes é a origem clássica do erro de fator 100 em app de nutrição, e ele não aparece em teste feliz — aparece como 128 kcal virando 12800.

### 4.1 Nova forma da TACO com macros — `backend/app/data/taco_foods.py`

Arquivo de dados, não tabela. Substitui os dois dicts de `float` por uma tupla de registros, **mantendo os dois dicts como visões derivadas** para não quebrar `services/ai.py:126-136` nem os 231 testes atuais.

```python
from dataclasses import dataclass
from typing import Literal

TACO_DATASET_VERSION = "taco-2026-08-1"   # bump obrigatório a cada alteração de dado

@dataclass(frozen=True, slots=True)
class TacoFood:
    slug: str                              # "arroz-branco-cozido-g"  (estável, é chave externa)
    name: str                              # "Arroz branco cozido"    (com acento, é rótulo de tela)
    name_normalized: str                   # "arroz branco cozido"    (== _normalize(name))
    base_unit: Literal["g", "ml", "un"]
    kcal_per_100: float                    # kcal/100 g | kcal/100 ml | kcal/1 un  (ver nota)
    protein_g_per_100: float
    carbs_g_per_100: float
    fat_g_per_100: float

TACO_FOODS: tuple[TacoFood, ...] = ( ... )
```

- Para `base_unit == "un"`, os quatro campos `*_per_100` são **por 1 unidade**, não por 100 — o sufixo é mantido só para não ter duas famílias de nome. O seeder trata a diferença (§ 4.2). Está feio de propósito: um nome mentiroso e documentado é menos perigoso que dois esquemas de nome parecidos.
- `slug` termina com o sufixo da unidade base porque **`maca` existe nas duas famílias hoje** (56 kcal/100 g e 78 kcal/un): `maca-g` e `maca-un`.

**Compatibilidade obrigatória** — estas duas linhas ficam no fim do arquivo e não podem ser removidas:

```python
TACO_PER_100G: dict[str, float] = {
    f.name_normalized: f.kcal_per_100 for f in TACO_FOODS if f.base_unit in ("g", "ml")
}
TACO_PER_UNIT: dict[str, float] = {
    f.name_normalized: f.kcal_per_100 for f in TACO_FOODS if f.base_unit == "un"
}
```

Reproduzem exatamente o conteúdo de hoje — **verificado**: 83 itens em `TACO_PER_100G` (incluindo os líquidos, que `_lookup_taco` já manda para lá) e 13 em `TACO_PER_UNIT`, **96 registros em `TACO_FOODS`**. `services/ai.py` fica **intocado**.

> `maca` é o único nome presente nas duas famílias hoje (56 kcal/100 g e 78 kcal/un). Com o `slug` sufixado (`maca-g`, `maca-un`) e o unique em `(name_normalized, base_unit)`, os dois convivem — e é por isso que o unique **não** é só `name_normalized`. Um teste deve fixar esse caso.

> Os macros dos 96 registros têm que sair da TACO/UNICAMP real, não de estimativa. Item que não tiver macro publicado fica **fora** de `TACO_FOODS` até ter. → handoff `eng-senior`.

### 4.2 Tabela nova — `food_catalog`

Catálogo curado que o `GET /diary/foods/search` lê. É a materialização do RS-13 ("a busca lê catálogo curado, **nunca** `food_cache`").

**Por que tabela e não o dict em memória.** O RS-14 escreve a busca como `FoodCatalog.name.ilike(..., escape="\\")`; os macros quadruplicam a largura do dado, que fica melhor em linha que em tupla; e `curated` precisa poder crescer sem deploy. Custo aceito: risco de divergência entre o arquivo e a tabela, fechado pelo seeder idempotente abaixo.

`backend/app/models/food_catalog.py`

| Coluna | Tipo SQLAlchemy | Null | Default | Nota |
|---|---|---|---|---|
| `id` | `Integer`, PK | não | autoinc | |
| `slug` | `String(160)` | não | — | `TacoFood.slug`. Metade do `food_ref` (`catalog:<slug>`) |
| `name` | `String(120)` | não | — | Rótulo de tela, com acento |
| `name_normalized` | `String(120)` | não | — | `_normalize(name)`; alvo do `ILIKE` e do match exato |
| `base_unit` | `String(4)` | não | — | `"g"` \| `"ml"` \| `"un"` |
| `kcal_per_base_unit` | `Float` | não | — | § 4.0 |
| `protein_per_base_unit` | `Float` | não | — | g de proteína por 1 unidade base |
| `carbs_per_base_unit` | `Float` | não | — | |
| `fat_per_base_unit` | `Float` | não | — | |
| `dataset_version` | `String(32)` | não | — | `TACO_DATASET_VERSION` na hora do seed |

Macros **NOT NULL** aqui: a curadoria é nossa, e admitir nulo transformaria "não sei" e "zero" na mesma coisa dentro da fonte confiável. Quem pode não saber é o `food_cache` (§ 4.3), e lá é nulo.

**Índices**

| Índice | Definição | Consulta que o justifica |
|---|---|---|
| `uq_food_catalog_slug` | `UNIQUE (slug)` | `POST /diary` com `food_ref="catalog:<slug>"` → `WHERE slug = :slug`. É a leitura mais quente da escrita, e é igualdade em coluna única |
| `uq_food_catalog_name_unit` | `UNIQUE (name_normalized, base_unit)` | Chave de negócio (RS-19 aplicado ao catálogo) e alvo do match exato do resolve: `WHERE name_normalized = :q AND base_unit = :u` |

**Índice que NÃO existe, de propósito:** um btree em `name_normalized` sozinho. Seria redundante (`uq_food_catalog_name_unit` já atende igualdade pela coluna líder) e **não serviria à busca de qualquer jeito** — `ILIKE '%termo%'` tem curinga à esquerda e nenhum btree é usável. Com 96 linhas, o seq scan é livre. Se o catálogo passar de alguns milhares de linhas, a resposta é `pg_trgm` + índice GIN, não um btree inútil. → registrar como gatilho de revisão.

**Seeder — `backend/app/data/seed_food_catalog.py`**

```python
def sync_food_catalog(db: Session) -> int:
    """Idempotente. Chamado no lifespan do main.py e por fixture de teste."""
    ja_ok = db.query(FoodCatalog).filter(
        FoodCatalog.dataset_version == TACO_DATASET_VERSION
    ).count()
    if ja_ok == len(TACO_FOODS):
        return 0                       # caminho normal: 1 COUNT e volta
    ...                                # upsert por slug + delete dos slugs que sumiram
```

Transformação, e é aqui que a divisão por 100 acontece **uma única vez**:

```
base_unit in ("g", "ml")  →  *_per_base_unit = round(f.<campo>_per_100 / 100, 6)
base_unit == "un"         →  *_per_base_unit = f.<campo>_per_100          (já é por 1 unidade)
```

Arredondar em 6 casas na origem, e não na saída: `128/100 = 1.28` exato, mas `93/100` em float binário carrega ruído que, multiplicado por 9.000 g, aparece na primeira casa decimal.

O `COUNT` no boot custa um round-trip por processo. Não semear dentro da migration é deliberado: migration que importa código de aplicação quebra retroativamente quando o código muda, e este dado muda por curadoria, não por schema.

### 4.3 Alteração — `food_cache` (RS-17, RS-19, RS-21, A-3)

`backend/app/models/food_cache.py`

**Colunas novas**

| Coluna | Tipo | Null | Default | Nota |
|---|---|---|---|---|
| `name_normalized` | `String(120)` | não | — | RS-19. Chave real de leitura; `name` vira só rótulo |
| `source` | `String(16)` | não | — | `"taco"` \| `"curated"` \| `"openfoodfacts"` \| `"llm"` — validado no Pydantic, não no banco (o projeto não usa `Enum` nativo em lugar nenhum, e `CHECK` não é alterável em SQLite) |
| `created_by_user_id` | `Integer` FK `users.id` **`ondelete="SET NULL"`** | **sim** | `NULL` | RS-29: a linha é anonimizada, não apagada. `NULL` = compartilhada |
| `created_at` | `DateTime` | não | `datetime.utcnow` | Base do expurgo de 90 dias (§ 8.4) |
| `protein_per_base_unit` | `Float` | **sim** | `NULL` | `NULL` = a fonte não informou. Ver § 9.4 |
| `carbs_per_base_unit` | `Float` | sim | `NULL` | |
| `fat_per_base_unit` | `Float` | sim | `NULL` | |
| `off_product_id` | `String(64)` | sim | `NULL` | RS-21: torna um valor ruim rastreável e removível em lote |

Colunas mantidas: `id`, `name`, `calories_per_unit`, `unit_type`. **`calories_per_unit` não é renomeada** — já significa exatamente `kcal_per_base_unit` (comentário em `models/food_cache.py:22`), e renomear coluna em SQLite via `batch_alter_table` custa recriação de tabela por ganho puramente cosmético. A API expõe o nome novo; o banco mantém o antigo. Registrado aqui para que ninguém "conserte".

**`ondelete="SET NULL"` e não `CASCADE`**: apagar a conta não pode apagar linhas de cache que sobrevivem no histórico de outra pessoa? Não — linhas `llm`/`openfoodfacts` são de um usuário só. O motivo é outro: com `created_by_user_id = NULL` a linha passa a casar o índice parcial *compartilhado*, o que a tornaria visível a todos. Portanto o `SET NULL` **tem que vir acompanhado do expurgo**: o job de retenção (§ 8.4) apaga `source IN ('openfoodfacts','llm')` com `created_by_user_id IS NULL`, sempre, independente de idade. Sem esse par, o RS-29 vira um vazamento.

**Índices**

| Índice | Definição | Consulta que o justifica |
|---|---|---|
| `uq_food_cache_shared` | `UNIQUE (name_normalized, unit_type, source)` **`WHERE created_by_user_id IS NULL`** | Deduplicação global das linhas confiáveis. Parcial porque, em `UNIQUE` comum, `NULL != NULL` no Postgres e a dedupe não aconteceria |
| `uq_food_cache_private` | `UNIQUE (name_normalized, unit_type, source, created_by_user_id)` **`WHERE created_by_user_id IS NOT NULL`** | Uma linha por (alimento, unidade, fonte, dono). É o que impede que o RS-19 e o RS-17 se atropelem (Δ2) |
| `ix_food_cache_lookup` | `(name_normalized, unit_type)` | A leitura do RS-17: `WHERE name_normalized = ? AND unit_type = ? AND (source IN ('taco','curated') OR created_by_user_id = ?)`. As duas colunas líderes cortam quase tudo; o `OR` avalia sobre um punhado de linhas |
| `ix_food_cache_retention` | `(source, created_at)` | Job noturno do § 8.4: `WHERE source IN ('openfoodfacts','llm') AND created_at < :corte`. Sem ele o expurgo é seq scan na tabela que mais cresce |

`ix_food_cache_name` (existente) é **mantido**: `name` continua indexado e o índice já existe. `uq_food_cache_name_unit_type` (constraint de `c4f8b1d90a27`) é **removida** — foi substituída pelos dois parciais.

Ambos os dialetos suportam índice único parcial (Postgres sempre; SQLite ≥ 3.8.0). No Alembic exige os dois kwargs de dialeto — ver § 5.

### 4.4 Tabela nova — `diary_entries`

`backend/app/models/diary.py`

| Coluna | Tipo | Null | Default | Nota |
|---|---|---|---|---|
| `id` | `Integer`, PK | não | autoinc | |
| `user_id` | `Integer` FK `users.id` **`ondelete="CASCADE"`** | não | — | RS-06. `NOT NULL` é requisito de segurança, não de higiene: linha órfã escapa de todo filtro de escopo |
| `entry_date` | `Date` | não | — | Data local do usuário, não timestamp. RS-09 |
| `meal_slot` | `String(16)` | não | — | Uma das 6 chaves de § 6.0 |
| `food_ref` | `String(180)` | não | — | `catalog:<slug>` ou `cache:<id>`. **Referência fraca, sem FK** — ver nota abaixo |
| `food_name` | `String(120)` | não | — | Snapshot do rótulo no momento do registro |
| `source` | `String(16)` | não | — | Mesmo domínio de `food_cache.source`. Origem de `is_estimate` |
| `base_unit` | `String(4)` | não | — | `"g"` \| `"ml"` \| `"un"` |
| `quantity` | `Float` | não | — | O que o usuário digitou. RS-07: `gt=0, le=10_000` |
| `unit` | `String(16)` | não | — | Uma das 8 unidades de § 9.1 |
| `kcal_per_base_unit` | `Float` | não | — | **Snapshot.** Permite o `PATCH` recalcular sem tocar na fonte |
| `protein_per_base_unit` | `Float` | sim | `NULL` | `NULL` = desconhecido |
| `carbs_per_base_unit` | `Float` | sim | `NULL` | |
| `fat_per_base_unit` | `Float` | sim | `NULL` | |
| `calories_total` | `Float` | não | — | Derivado e persistido. RS-10: calculado no servidor, nunca recebido |
| `protein_g_total` | `Float` | sim | `NULL` | |
| `carbs_g_total` | `Float` | sim | `NULL` | |
| `fat_g_total` | `Float` | sim | `NULL` | |
| `created_at` | `DateTime` | não | `datetime.utcnow` | Ordenação dentro do slot |
| `updated_at` | `DateTime` | não | `datetime.utcnow`, `onupdate=datetime.utcnow` | |

**Por que a entrada é um snapshot e não uma FK.** Três razões, todas de correção:

1. **Histórico não pode mudar sozinho.** Corrigir o azeite no catálogo amanhã não pode reescrever o total de terça passada — o usuário fechou aquele dia com aquele número.
2. **A fonte pode sumir.** Linhas `llm`/`openfoodfacts` expiram em 90 dias (§ 8.4). Uma FK com `CASCADE` apagaria o registro do usuário junto; com `RESTRICT`, travaria o expurgo.
3. **O `PATCH` fica fechado.** Editar quantidade recalcula a partir da própria linha: sem query, sem rede, sem chance de o valor mudar entre criar e editar.

`food_ref` sobrevive só como rastro de auditoria ("de onde veio este número"), e a API o devolve para o frontend poder oferecer "registrar de novo". Nenhuma leitura de tela depende de ele resolver.

**Índices**

| Índice | Definição | Consulta que o justifica |
|---|---|---|
| `ix_diary_entries_user_date` | `(user_id, entry_date)` | (a) `GET /diary?date=` → `WHERE user_id = ? AND entry_date = ?`; (b) `GET /diary/summary` → `WHERE user_id = ? AND entry_date BETWEEN ? AND ?` (range scan pela segunda coluna); (c) contagem do RS-11 antes de inserir; (d) coluna líder serve o `CASCADE` da exclusão de conta. Exigido nominalmente pelo RS-06 |

**Índices que NÃO existem, de propósito:**
- `(user_id, entry_date, meal_slot)` — `meal_slot` tem 6 valores e o dia inteiro cabe em 60 linhas (RS-11). A tela **sempre** carrega o dia todo e agrupa por slot em memória; um terceiro nível só engordaria a escrita.
- `(food_ref)` — nenhuma rota do § 6 busca entrada por alimento. Índice sem consulta é custo de `INSERT` disfarçado de zelo.

### 4.5 Tabela nova — `diary_plan_bindings`

`backend/app/models/diary.py` (mesmo módulo)

| Coluna | Tipo | Null | Default | Nota |
|---|---|---|---|---|
| `id` | `Integer`, PK | não | autoinc | |
| `user_id` | `Integer` FK `users.id` `ondelete="CASCADE"` | não | — | |
| `meal_plan_id` | `Integer` FK `meal_plans.id` `ondelete="CASCADE"` | não | — | Apagar o cardápio desfaz o vínculo, sem linha pendurada |
| `start_date` | `Date` | não | — | Data de calendário que corresponde a `day_index = 0` |
| `end_date` | `Date` | sim | `NULL` | `NULL` = sem fim; o plano cicla indefinidamente |
| `created_at` | `DateTime` | não | `datetime.utcnow` | Desempate |

**Resolução de "qual dia do plano cai na data D"** — `services/diary_plan.py`:

```python
binding = (
    db.query(DiaryPlanBinding)
    .filter(
        DiaryPlanBinding.user_id == current_user.id,
        DiaryPlanBinding.start_date <= alvo,
        or_(DiaryPlanBinding.end_date.is_(None), DiaryPlanBinding.end_date >= alvo),
    )
    .order_by(DiaryPlanBinding.start_date.desc(), DiaryPlanBinding.id.desc())
    .first()
)
if binding is None:
    return None
dias = binding.meal_plan.days          # já ordenado por day_index no relationship
if not dias:
    return None
day_index_alvo = (alvo - binding.start_date).days % len(dias)
dia = dias[day_index_alvo]
```

**Sem constraint de não sobreposição.** Dois vínculos podem cobrir a mesma data; o desempate é `start_date DESC, id DESC` — "o vínculo mais recente que já começou ganha". Escolha consciente: exclusão de intervalo em Postgres exige `btree_gist` + `EXCLUDE`, que **não existe em SQLite** e quebraria a suíte. Um desempate determinístico e testável resolve o mesmo problema no lugar certo (§ 6.7 define o comportamento observável).

**Índice**

| Índice | Definição | Consulta que o justifica |
|---|---|---|
| `ix_diary_plan_bindings_user_start` | `(user_id, start_date)` | Exatamente a query acima: igualdade na líder, desigualdade + `ORDER BY DESC` na segunda. O planejador varre o índice de trás para frente e para no primeiro |

### 4.6 Registro obrigatório no metadata

`backend/app/db/base.py` é o **único** ponto de registro (o próprio arquivo documenta por quê: models fora dele viram `DROP TABLE` no próximo `--autogenerate`). Adicionar:

```python
from app.models.food_catalog import FoodCatalog  # noqa: F401
from app.models.diary import DiaryEntry, DiaryPlanBinding  # noqa: F401
```

Esquecer esta etapa não quebra nenhum teste hoje e apaga três tabelas amanhã.

---

## 5. Migration Alembic

**Uma única migration.** Arquivo: `backend/migrations/versions/d5a3e7c1b204_diario_alimentar_e_particao_do_cache.py`

```python
revision: str = 'd5a3e7c1b204'
down_revision: Union[str, Sequence[str], None] = 'c4f8b1d90a27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None
```

`down_revision = 'c4f8b1d90a27'` é obrigatório e não negociável: é a head atual (`c4f8b1d90a27_food_cache_unique_name_unit_type.py`). Qualquer outro valor produz **duas heads** e o próximo `alembic upgrade head` falha com `Multiple head revisions are present`.

Escrever à mão, **sem `--autogenerate`**: o autogenerate não emite o `DELETE` do passo 4, não gera índice parcial corretamente e ordena as operações pelo que lhe convém.

### 5.1 `upgrade()` — ordem obrigatória

**Passo 1 — `food_catalog`** (`op.create_table`, colunas de § 4.2, todas `nullable=False`), seguido de:
```python
op.create_index('uq_food_catalog_slug', 'food_catalog', ['slug'], unique=True)
op.create_index('uq_food_catalog_name_unit', 'food_catalog',
                ['name_normalized', 'base_unit'], unique=True)
```
Tabela criada **vazia**. Quem popula é `sync_food_catalog()` no `lifespan` (§ 4.2).

**Passo 2 — `diary_entries`** (colunas de § 4.4):
```python
sa.Column('user_id', sa.Integer(),
          sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
...
op.create_index('ix_diary_entries_user_date', 'diary_entries', ['user_id', 'entry_date'])
```

**Passo 3 — `diary_plan_bindings`** (colunas de § 4.5):
```python
sa.Column('meal_plan_id', sa.Integer(),
          sa.ForeignKey('meal_plans.id', ondelete='CASCADE'), nullable=False),
...
op.create_index('ix_diary_plan_bindings_user_start', 'diary_plan_bindings',
                ['user_id', 'start_date'])
```

**Passo 4 — esvaziar `food_cache` ANTES de alterá-la** (D-2):
```python
op.execute("DELETE FROM food_cache")
```
Tem que vir antes do passo 5: quatro das colunas novas são `NOT NULL` sem valor derivável para as linhas existentes.

**Passo 5 — alterar `food_cache`, em `batch_alter_table`:**
```python
with op.batch_alter_table('food_cache') as batch:
    batch.drop_constraint('uq_food_cache_name_unit_type', type_='unique')
    batch.add_column(sa.Column('name_normalized', sa.String(length=120), nullable=False))
    batch.add_column(sa.Column('source', sa.String(length=16), nullable=False))
    batch.add_column(sa.Column('created_by_user_id', sa.Integer(), nullable=True))
    batch.add_column(sa.Column('created_at', sa.DateTime(), nullable=False,
                               server_default=sa.func.now()))
    batch.add_column(sa.Column('protein_per_base_unit', sa.Float(), nullable=True))
    batch.add_column(sa.Column('carbs_per_base_unit', sa.Float(), nullable=True))
    batch.add_column(sa.Column('fat_per_base_unit', sa.Float(), nullable=True))
    batch.add_column(sa.Column('off_product_id', sa.String(length=64), nullable=True))
    batch.create_foreign_key('fk_food_cache_created_by_user', 'users',
                             ['created_by_user_id'], ['id'], ondelete='SET NULL')
```
`batch_alter_table` é obrigatório e não é preciosismo: SQLite (a suíte inteira roda nele) não implementa `ALTER TABLE ... DROP CONSTRAINT` nem `ADD COLUMN NOT NULL` sem default — o batch recria a tabela e contorna os dois. Em Postgres o Alembic emite o `ALTER` nativo. `server_default=now()` só em `created_at`, para não deixar default de banco em coluna que a aplicação sempre preenche.

**Passo 6 — os índices de `food_cache`** (fora do batch, depois dele):
```python
op.create_index('ix_food_cache_lookup', 'food_cache', ['name_normalized', 'unit_type'])
op.create_index('ix_food_cache_retention', 'food_cache', ['source', 'created_at'])
op.create_index(
    'uq_food_cache_shared', 'food_cache',
    ['name_normalized', 'unit_type', 'source'], unique=True,
    postgresql_where=sa.text('created_by_user_id IS NULL'),
    sqlite_where=sa.text('created_by_user_id IS NULL'),
)
op.create_index(
    'uq_food_cache_private', 'food_cache',
    ['name_normalized', 'unit_type', 'source', 'created_by_user_id'], unique=True,
    postgresql_where=sa.text('created_by_user_id IS NOT NULL'),
    sqlite_where=sa.text('created_by_user_id IS NOT NULL'),
)
```
Os **dois** kwargs de dialeto são obrigatórios. Passar só `postgresql_where` faz o SQLite criar um índice único **total** — e o teste do RS-17 (dois usuários, mesmo nome, mesma unidade, `source="llm"`) passa a estourar `IntegrityError` só na suíte, com o Postgres se comportando corretamente. Divergência de dialeto silenciosa é a pior classe de bug de migration.

### 5.2 O que acontece com as linhas existentes de `food_cache`

**Todas são apagadas.** É a decisão D-2, e é o ponto de maior consequência desta migration.

**Por que não dá para migrar.** As linhas de hoje foram escritas por `services/ai.py:170-198`, que grava `name`, `unit_type` e `calories_per_unit` e **nada mais**. Depois do fato, não existe informação no banco que distinga:

| Origem real da linha | Confiável? | Rastro deixado |
|---|---|---|
| TACO (`_lookup_taco`) | Sim | nenhum |
| Open Food Facts (`_lookup_open_food_facts`) | **Não** — base wiki, editável por qualquer pessoa | nenhum |
| Gemini (`get_food_calories`, passo 4) | **Não** — não determinístico, parsing frouxo de `services/ai.py:215` | nenhum |

Preencher `source='taco'` para todas seria **inventar procedência**, e inventar procedência é precisamente o que o RS-17 existe para impedir. O achado **A-3 (Alto)** afirma que o envenenamento via Open Food Facts é explorável **hoje**: qualquer linha atual pode já ser o produto forjado do cenário descrito lá. Promover esse conjunto a `taco`/`curated` — as duas origens que o RS-17 define como **compartilhadas globalmente** — importaria o ataque para dentro da estrutura construída para contê-lo.

**Por que o custo é aceitável.** O cache é regenerável por definição, e cada classe se recupera de um jeito diferente:

| Classe | Recuperação | Custo |
|---|---|---|
| Linhas que vieram da TACO | Próxima consulta reescreve a partir de `food_catalog` | **Zero** — sem rede, sem LLM |
| Linhas de OFF/LLM | Uma re-resolução por usuário, sob cota e faixa de plausibilidade | Uma chamada, **agora auditável** |

Nenhum dado do usuário é perdido: `food_cache` não guarda nada de ninguém — é memória de cálculo. `diary_entries` ainda não existe, então não há entrada apontando para essas linhas.

**Alternativa descartada:** copiar as linhas para `food_cache_quarantine` antes de apagar. Mantém dado sem procedência vivo no schema, cria uma tabela que ninguém lê e adia a decisão. Se auditoria forense for necessária, o `pg_dump` anterior ao deploy resolve — e é responsabilidade de deploy, não de schema. → handoff `devops-senior`: **dump de `food_cache` antes de aplicar**.

### 5.3 `downgrade()`

Ordem inversa exata:

1. `op.drop_index` dos quatro índices de `food_cache` (`uq_food_cache_private`, `uq_food_cache_shared`, `ix_food_cache_retention`, `ix_food_cache_lookup`).
2. `batch_alter_table('food_cache')`: `drop_constraint('fk_food_cache_created_by_user', type_='foreignkey')`, `drop_column` das 8 colunas novas, `create_unique_constraint('uq_food_cache_name_unit_type', ['name', 'unit_type'])`.
3. `op.drop_index` + `op.drop_table` de `diary_plan_bindings`, `diary_entries` e `food_catalog`.

> **`downgrade()` não restaura as linhas apagadas no passo 4.** Descer deixa `food_cache` vazia. É perda de dado irreversível pela migration — e é aceitável exatamente pelo motivo do § 5.2: o conteúdo é regenerável e não era confiável. **O `downgrade` apaga o diário do usuário junto com a tabela**, e isso *não* é regenerável: descer em produção depois de a feature estar no ar exige `pg_dump` antes. Escrever isso no topo do arquivo da migration, em maiúscula.

### 5.4 Verificação

```bash
cd backend && ./.venv/bin/alembic upgrade head && ./.venv/bin/alembic downgrade -1 && ./.venv/bin/alembic upgrade head
cd backend && ./.venv/bin/alembic heads          # tem que imprimir UMA head: d5a3e7c1b204
cd backend && ./.venv/bin/python -m pytest -q    # baseline 231 passed, nenhum regride
```

Não usar outro interpretador: `.venv` é symlink para `.venv.nosync` (contorno do iCloud) e qualquer outro trava por minutos.

---

## 6. Contrato REST

### 6.0 Convenções que valem para todas as rotas

**Registro no `main.py` — a ordem importa e quebra silenciosamente:**

```python
from app.routers import diary, diary_foods
app.include_router(diary_foods.router, prefix="/diary/foods", tags=["diary"])   # PRIMEIRO
app.include_router(diary.router,       prefix="/diary",       tags=["diary"])   # DEPOIS
```
Invertido, `GET /diary/foods/search` casa `GET /diary/{entry_id}`, o FastAPI tenta converter `"foods"` para `int` e devolve `422` em vez de resultado de busca. Dois arquivos separados também são exigência dos greps do RS-13 e RS-16.

**Autenticação**: todas as rotas exigem `Depends(get_current_user)`. `user_id` **nunca** aparece em path, query ou corpo (RS-02).

**Slots** — as 6 chaves canônicas, nesta ordem, em todo lugar:

| Chave (API, banco, TS) | Rótulo (só tela) |
|---|---|
| `cafe_da_manha` | Café da Manhã |
| `lanche_manha` | Lanche da Manhã |
| `almoco` | Almoço |
| `lanche_tarde` | Lanche da Tarde |
| `jantar` | Jantar |
| `ceia` | Ceia |

> **Garantia de contrato**: `DiaryDay.slots` tem **sempre exatamente 6 itens, sempre nesta ordem**, mesmo vazios. O frontend nunca cria slot, nunca ordena, nunca preenche buraco.

**Formato de erro** — dois formatos, e a diferença é de propósito:

```jsonc
// Erro de negócio: `detail` é OBJETO, sempre com `code` e `message`
{ "detail": { "code": "FOOD_NOT_FOUND", "message": "Alimento não encontrado." } }

// Erro de validação (422): `detail` é LISTA, no formato do handler do RS-12
{ "detail": [ { "type": "greater_than", "loc": ["body", "quantity"], "msg": "..." } ] }
```
O `422` **não** traz `input`, `ctx` nem `url` — o handler global do RS-12 os remove. O frontend não pode ler `detail[].input`. Discriminar no cliente por `Array.isArray(detail)`.

**Nenhuma mensagem de erro repete o alimento enviado** (RS-27). `"Alimento não encontrado."`, nunca `"Alimento 'Ensure Plus' não encontrado."`.

**Números**: todo valor nutricional é `number` JSON com no máximo **1 casa decimal** (§ 9.3). Nunca string, nunca objeto. `null` significa **desconhecido**, nunca zero.

---

### 6.1 `GET /diary/foods/search` — buscar alimento

Catálogo curado apenas. **Não lê `food_cache`** (RS-13). **Não chama o LLM** (RS-16). Rate limit `30/minute` (RS-24) — exige debounce ≥ 300 ms no cliente.

| Query | Tipo | Regra |
|---|---|---|
| `q` | `str` | `min_length=2`, `max_length=60`, após `.strip()`. RS-15 |

`LIMIT 20` fixo, **não configurável pelo cliente** (RS-15). Termo escapado antes do `ILIKE` (RS-14).

**200**
```json
{
  "results": [
    {
      "food_ref": "catalog:arroz-branco-cozido-g",
      "name": "Arroz branco cozido",
      "base_unit": "g",
      "kcal_per_base_unit": 1.28,
      "protein_per_base_unit": 0.025,
      "carbs_per_base_unit": 0.281,
      "fat_per_base_unit": 0.002,
      "allowed_units": ["g", "colher_sopa", "colher_cha", "xicara"],
      "source": "taco",
      "is_estimate": false
    }
  ],
  "suggest_resolve": false
}
```

- `suggest_resolve` é `true` **se e somente se** `results` está vazio (RS-16). É o gatilho do botão "Estimar com IA".
- `allowed_units` vem do servidor (§ 9.2). O dropdown de unidade é preenchido com ele — o frontend **não** tem tabela de unidades por família.
- `is_estimate = source in ("llm", "openfoodfacts")`, calculado no servidor. Aqui é sempre `false`; o campo existe porque `FoodOption` é o **mesmo tipo** devolvido pelo resolve.

**Erros**: `422` (`q` fora dos limites) · `429`.

---

### 6.2 `POST /diary/foods/resolve` — resolver alimento desconhecido

**Único caminho pago.** Rate limit `5/minute` (RS-24) **e** cota por plano (§ 8.2). Timeout de 10 s (RS-23).

```json
{ "name": "rap10 integral", "unit": "un" }
```

| Campo | Tipo | Regra |
|---|---|---|
| `name` | `str` | `min_length=1`, `max_length=120` + validador do RS-08 (precisa conter letra; sem caractere de controle) |
| `unit` | `Literal` | as 8 unidades de § 9.1 |

`model_config = ConfigDict(extra="forbid")`.

Cadeia, na ordem, parando no primeiro acerto: **(1)** `food_catalog` por `name_normalized` exato → **(2)** `food_cache` com escopo do RS-17 → **(3)** Open Food Facts (RS-21) → **(4)** Gemini (RS-18, RS-20, RS-28). Acerto em (3) ou (4) grava em `food_cache` com `created_by_user_id = current_user.id` e a `source` correspondente; valor fora da faixa de plausibilidade **não é gravado e não é devolvido** (RS-18).

**200** — mesmo formato de `FoodOption` do § 6.1:
```json
{
  "food_ref": "cache:412",
  "name": "Rap10 integral",
  "base_unit": "un",
  "kcal_per_base_unit": 120.0,
  "protein_per_base_unit": null,
  "carbs_per_base_unit": null,
  "fat_per_base_unit": null,
  "allowed_units": ["un", "fatia", "porcao"],
  "source": "llm",
  "is_estimate": true
}
```

`is_estimate: true` é o que a interface usa para marcar "estimativa" (decisão 2 do dono do produto). Macros `null` porque a fonte não informou — § 9.4.

**Erros**

| Código | `detail.code` | Quando |
|---|---|---|
| `422` | — | `name`/`unit` inválidos, ou campo extra |
| `403` | `PLAN_LIMIT_REACHED` | Cota do plano estourada. Corpo no formato de `quotas.py::_limit_reached_error` |
| `404` | `FOOD_NOT_FOUND` | Nenhuma fonte resolveu, **ou** o valor obtido reprovou na faixa de plausibilidade (RS-18, RS-22). Nunca `0` |
| `503` | `FOOD_RESOLVER_UNAVAILABLE` | Disjuntor global aberto (RS-23) ou timeout de 10 s. Divergência Δ3 |
| `429` | — | Rate limit |

---

### 6.3 `POST /diary` — criar entrada

Rate limit `60/minute`. **Não chama LLM nem rede externa** — é a contrapartida do `food_ref` (D-5). Se o alimento não estiver resolvido, o cliente chama § 6.2 primeiro.

```json
{
  "entry_date": "2026-08-11",
  "meal_slot": "almoco",
  "food_ref": "catalog:arroz-branco-cozido-g",
  "quantity": 150,
  "unit": "g"
}
```

| Campo | Tipo | Regra |
|---|---|---|
| `entry_date` | `date` | Janela do RS-09: `hoje+1` a `hoje-730` |
| `meal_slot` | `Literal` | as 6 chaves de § 6.0 |
| `food_ref` | `str` | `max_length=180`, casa `^(catalog:[a-z0-9-]{1,160}\|cache:[0-9]{1,12})$` |
| `quantity` | `float` | `gt=0`, `le=10_000` (RS-07) |
| `unit` | `Literal` | as 8 unidades de § 9.1, e tem que estar em `allowed_units` do alimento (§ 9.2) |

`model_config = ConfigDict(extra="forbid")` — `calories_total`, `food_name`, `user_id` ou qualquer outro campo produzem `422` (RS-02, RS-10, Δ1).

Ordem de execução no servidor (a ordem é contrato, porque muda qual erro o cliente vê):
1. Validação Pydantic → `422`
2. Resolver `food_ref` → `404 FOOD_NOT_RESOLVED` se não achar (na branch `cache:`, o `WHERE` já carrega o escopo do RS-17 — id de outro usuário é indistinguível de id inexistente, RS-03)
3. Compatibilidade `unit` × `base_unit` → `422 UNIT_NOT_SUPPORTED_FOR_FOOD`
4. Teto do RS-11 (60 entradas naquela data) → `403 PLAN_LIMIT_REACHED`
5. Cálculo (§ 9.3) e teto de plausibilidade do RS-10 (`> 20_000` kcal) → `422`
6. `INSERT` e recomposição do dia

**201** → corpo é o **`DiaryDay` completo** da data (D-6), idêntico ao § 6.4. O frontend substitui o estado do dia pela resposta; não soma, não refaz `GET`.

**Erros**: `422` · `403 PLAN_LIMIT_REACHED` · `404 FOOD_NOT_RESOLVED` · `429`.

---

### 6.4 `GET /diary?date=YYYY-MM-DD` — listar e agregar o dia

**A rota central.** Uma chamada devolve tudo que o dashboard desenha, inclusive a metade planejada (D-4). Rate limit `120/minute`.

| Query | Tipo | Regra |
|---|---|---|
| `date` | `date` | Obrigatório. Sem janela (ler o passado é legítimo) |

**200**
```json
{
  "date": "2026-08-11",
  "calories_target": 2100.0,
  "totals": { "calories": 1487.3, "protein_g": 92.4, "carbs_g": 168.1, "fat_g": 48.9 },
  "planned_totals": { "calories": 2050.0, "protein_g": null, "carbs_g": null, "fat_g": null },
  "planned_unmatched_calories": 0.0,
  "entries_count": 7,
  "has_estimate": true,
  "macros_incomplete": true,
  "meal_plan": {
    "binding_id": 3,
    "meal_plan_id": 12,
    "title": "Semana de corte",
    "day_label": "Segunda-feira",
    "day_index": 0
  },
  "slots": [
    {
      "slot": "cafe_da_manha",
      "label": "Café da Manhã",
      "logged_calories": 380.5,
      "planned_calories": 400.0,
      "entries": [
        {
          "id": 991,
          "entry_date": "2026-08-11",
          "meal_slot": "cafe_da_manha",
          "food_ref": "catalog:ovo-cozido-g",
          "food_name": "Ovo cozido",
          "quantity": 100.0,
          "unit": "g",
          "base_unit": "g",
          "calories_total": 146.0,
          "protein_g_total": 13.3,
          "carbs_g_total": 0.6,
          "fat_g_total": 9.5,
          "source": "taco",
          "is_estimate": false,
          "created_at": "2026-08-11T09:12:04",
          "updated_at": "2026-08-11T09:12:04"
        }
      ],
      "planned_meals": [
        { "id": 88, "title": "Ovos mexidos com pão integral", "calories": 400.0, "recipe_id": 45 }
      ]
    }
  ]
}
```

Campos que exigem definição literal, para não haver duas leituras:

| Campo | Definição exata |
|---|---|
| `calories_target` | `profiles.daily_calories` do usuário. `null` se não houver perfil ou se for `NULL`. **Não** é `MealPlanDay.calories_target` |
| `totals.*` | Soma dos valores **já persistidos e já arredondados** das entradas do dia, re-arredondada a 1 casa (§ 9.3). Macro com `null` em alguma entrada é ignorada na soma |
| `planned_totals.calories` | Soma de `MealPlanMeal.calories` das refeições do dia do plano, **incluindo as de slot não mapeado** |
| `planned_totals.protein_g` etc. | **Sempre `null` na v1.** `MealPlanDay` guarda macro como texto livre (`macros_protein: String`, ex.: `"120g"`); parsear string de IA para número é inventar dado. O campo existe para não quebrar o tipo quando isso for resolvido |
| `planned_unmatched_calories` | Soma das refeições do plano cujo `slot_name` não caiu em nenhum dos 6 slots. Já está dentro de `planned_totals.calories`; existe para a interface poder mostrar a nota de rodapé |
| `entries_count` | Contagem de entradas do dia. Alimenta o aviso do teto de 60 (RS-11) |
| `has_estimate` | `true` se alguma entrada tem `is_estimate` |
| `macros_incomplete` | `true` se alguma entrada tem qualquer macro `null` — a interface não pode apresentar `totals.protein_g` como fato fechado |
| `meal_plan` | `null` quando não há binding vigente, quando o plano não tem dias, ou quando a data é anterior a `start_date` / posterior a `end_date` |
| `slots[].logged_calories` | Soma de `calories_total` das entradas **daquele slot** |
| `slots[].planned_calories` | Soma de `MealPlanMeal.calories` mapeadas para aquele slot. `0.0`, nunca `null` |

**Mapeamento `slot_name` (texto livre do cardápio) → slot canônico.** `MealPlanMeal.slot_name` é `String` livre. A tabela é aplicada sobre `_normalize(slot_name)` (minúscula, sem acento, sem espaço nas pontas):

| `_normalize(slot_name)` | Slot |
|---|---|
| `cafe da manha`, `cafe`, `desjejum` | `cafe_da_manha` |
| `lanche da manha`, `lanche manha` | `lanche_manha` |
| `almoco` | `almoco` |
| `lanche da tarde`, `lanche tarde`, `lanche` | `lanche_tarde` |
| `jantar`, `janta` | `jantar` |
| `ceia` | `ceia` |

`lanche` sozinho vai para `lanche_tarde` porque a estrutura de 4 refeições do `generate_meal_plan` (`services/ai.py`) é "Café da Manhã, Almoço, Lanche da Tarde, Jantar" — o lanche genérico é o da tarde em 100% dos cardápios gerados hoje. Qualquer outro valor cai em `planned_unmatched_calories`; **nunca** é chutado num slot.

**Custo**: ≤ 5 queries — entradas (1, escopada por `user_id` + `date` na mesma cláusula, RS-05), perfil (1), binding (1), dias+refeições do plano com `joinedload` (1–2). Nenhuma query por slot.

**Erros**: `422` (data inválida) · `429`. Nunca `404`: dia sem entrada e sem plano é `200` com `slots` vazios e `totals` zerados.

---

### 6.5 `GET /diary/{entry_id}` — ler uma entrada

Existe para o teste do RS-01. Rate limit `120/minute`.

**200** → um `DiaryEntry` (o objeto do § 6.4). **404** `{"detail": {"code": "ENTRY_NOT_FOUND", "message": "Entrada não encontrada"}}` — corpo **byte a byte idêntico** para id inexistente e para id de outro usuário (RS-03). Nunca `403`, nem para superusuário (RS-04).

---

### 6.6 `PATCH /diary/{entry_id}` — editar entrada

Rate limit `60/minute`. Corpo parcial; todos os campos opcionais, mas **pelo menos um** obrigatório (senão `422`).

```json
{ "quantity": 200, "unit": "g", "meal_slot": "jantar", "entry_date": "2026-08-11" }
```

| Campo | Regra |
|---|---|
| `quantity` | mesma do § 6.3 |
| `unit` | mesma do § 6.3, revalidada contra o `base_unit` **persistido na entrada** |
| `meal_slot` | as 6 chaves |
| `entry_date` | janela do RS-09 |

**`food_ref` não é editável.** Trocar o alimento é apagar e criar — mantém o recálculo fechado dentro da linha (§ 4.4) e evita reintroduzir uma resolução na rota de edição. Enviar `food_ref` (ou qualquer campo fora da lista) → `422` por `extra="forbid"`.

Recálculo a partir dos `*_per_base_unit` **já persistidos** — sem consultar `food_catalog`, `food_cache`, LLM ou rede. Um alimento cujo valor foi corrigido no catálogo depois não muda por causa de um `PATCH` de quantidade.

**200** → `DiaryDay` recalculado (D-6). Se `entry_date` mudou, o `DiaryDay` é o da **data nova**; a interface tem que navegar para ela.

**Erros**: `422` · `404 ENTRY_NOT_FOUND` (mesmo corpo do § 6.5) · `403 PLAN_LIMIT_REACHED` (quando mover para uma data que já tem 60 entradas) · `429`.

---

### 6.7 `DELETE /diary/{entry_id}` — apagar entrada

Rate limit `60/minute`.

**200** → `DiaryDay` recalculado da data da entrada apagada (D-6). **Não é `204`**: a barra precisa do total novo, e um `204` forçaria um `GET` logo em seguida.

**Erros**: `404 ENTRY_NOT_FOUND` (mesmo corpo; a linha do outro usuário **continua existindo** no banco — RS-01) · `429`.

---

### 6.8 `GET /diary/summary?start=&end=` — faixa de dias

Alimenta a fita da semana sem 7 chamadas. Rate limit `60/minute`.

| Query | Tipo | Regra |
|---|---|---|
| `start` | `date` | Obrigatório |
| `end` | `date` | Obrigatório, `>= start`, e `end - start <= 31 dias` → senão `422` |

**200**
```json
{
  "days": [
    { "date": "2026-08-10", "calories": 1980.4, "planned_calories": 2050.0, "entries_count": 9 },
    { "date": "2026-08-11", "calories": 1487.3, "planned_calories": 2050.0, "entries_count": 7 }
  ],
  "calories_target": 2100.0
}
```

`days` traz **todas** as datas do intervalo, inclusive as sem registro (`calories: 0.0`, `entries_count: 0`), em ordem crescente — o frontend não preenche buraco de calendário. `calories_target` sai do array porque é do usuário, não do dia.

Uma query agregada (`GROUP BY entry_date`, escopada por `user_id`) + uma resolução de binding por dia sobre o mesmo plano já carregado.

**Erros**: `422` · `429`.

---

### 6.9 Vínculo com o cardápio

**`POST /diary/plan-bindings`** — rate limit `30/minute`
```json
{ "meal_plan_id": 12, "start_date": "2026-08-10", "end_date": null }
```
`meal_plan_id` é validado contra `meal_plans.user_id == current_user.id`; plano alheio → **`404`** `{"code": "MEAL_PLAN_NOT_FOUND"}`, nunca `403` (RS-03, mesmo padrão de `meal_plans.py:48-54`). `end_date`, se presente, `>= start_date`.

**201**
```json
{ "id": 3, "meal_plan_id": 12, "start_date": "2026-08-10", "end_date": null, "created_at": "2026-08-10T21:00:00" }
```
Criar um vínculo **não apaga** os anteriores: o mais recente que já começou ganha (§ 4.5). Comportamento observável exigido em teste: com vínculos em `2026-08-01` (plano A) e `2026-08-10` (plano B), `GET /diary?date=2026-08-11` traz o **plano B**.

**`DELETE /diary/plan-bindings/{binding_id}`** — `200` `{"ok": true}`; alheio ou inexistente → `404 BINDING_NOT_FOUND`, mesmo corpo.

Listagem de vínculos fica **fora da v1** — a tela do dia já informa qual plano está valendo, e a gestão de cardápios tem tela própria.

---

### 6.10 Tabela consolidada

| Método | Path | Corpo/Query | Sucesso | Erros | Rate limit |
|---|---|---|---|---|---|
| `GET` | `/diary/foods/search` | `q` | `200 FoodSearchResponse` | `422`, `429` | `30/min` |
| `POST` | `/diary/foods/resolve` | `{name, unit}` | `200 FoodOption` | `422`, `403`, `404`, `503`, `429` | `5/min` |
| `POST` | `/diary` | `DiaryEntryCreate` | `201 DiaryDay` | `422`, `403`, `404`, `429` | `60/min` |
| `GET` | `/diary` | `date` | `200 DiaryDay` | `422`, `429` | `120/min` |
| `GET` | `/diary/{entry_id}` | — | `200 DiaryEntry` | `404`, `429` | `120/min` |
| `PATCH` | `/diary/{entry_id}` | `DiaryEntryUpdate` | `200 DiaryDay` | `422`, `403`, `404`, `429` | `60/min` |
| `DELETE` | `/diary/{entry_id}` | — | `200 DiaryDay` | `404`, `429` | `60/min` |
| `GET` | `/diary/summary` | `start`, `end` | `200 DiarySummaryResponse` | `422`, `429` | `60/min` |
| `POST` | `/diary/plan-bindings` | `{meal_plan_id, start_date, end_date?}` | `201 DiaryPlanBinding` | `422`, `404`, `429` | `30/min` |
| `DELETE` | `/diary/plan-bindings/{binding_id}` | — | `200 {ok}` | `404`, `429` | `30/min` |

**Códigos de negócio** (valores de `detail.code`): `FOOD_NOT_FOUND` · `FOOD_NOT_RESOLVED` · `FOOD_RESOLVER_UNAVAILABLE` · `ENTRY_NOT_FOUND` · `MEAL_PLAN_NOT_FOUND` · `BINDING_NOT_FOUND` · `PLAN_LIMIT_REACHED` · `UNIT_NOT_SUPPORTED_FOR_FOOD`.

**Nenhuma rota devolve `403` por posse de recurso.** `403` nesta feature só existe com `code: "PLAN_LIMIT_REACHED"`, onde ele é a resposta honesta (o usuário precisa saber que existe um limite para poder fazer upgrade). Recurso alheio é sempre `404` (RS-03).

---

## 7. Tipos TypeScript

Bloco para **anexar ao fim** de `frontend/src/types.ts`. Copiar literalmente.

> **Não alterar nada do que já existe no arquivo.** Em especial: `MEAL_SLOTS` (array de rótulos usado pelo construtor de cardápio) e `MealPlanMeal` (a refeição *planejada*) continuam como estão. Os tipos abaixo usam nomes diferentes de propósito — `MEAL_SLOT_ORDER`/`MEAL_SLOT_LABELS` e `DiaryPlannedMeal` — porque o diário e o cardápio são entidades distintas (§ 3.2) e fundir os nomes fundiria os conceitos.

```ts
// ============================================================================
// DIÁRIO ALIMENTAR — contrato do ADR-0001 (docs/adr/0001-diario-alimentar.md).
// Espelha os schemas Pydantic de backend/app/schemas/diary.py.
// Alterar aqui sem alterar lá (e o ADR) quebra o contrato entre front e back.
// ============================================================================

/** As 6 chaves de slot. Valor de API e de banco — o rótulo fica em MEAL_SLOT_LABELS. */
export type MealSlot =
  | 'cafe_da_manha'
  | 'lanche_manha'
  | 'almoco'
  | 'lanche_tarde'
  | 'jantar'
  | 'ceia';

/** Ordem canônica. DiaryDay.slots já vem nesta ordem — não reordenar no cliente. */
export const MEAL_SLOT_ORDER: readonly MealSlot[] = [
  'cafe_da_manha',
  'lanche_manha',
  'almoco',
  'lanche_tarde',
  'jantar',
  'ceia',
];

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  cafe_da_manha: 'Café da Manhã',
  lanche_manha: 'Lanche da Manhã',
  almoco: 'Almoço',
  lanche_tarde: 'Lanche da Tarde',
  jantar: 'Jantar',
  ceia: 'Ceia',
};

/** As 8 unidades aceitas. O dropdown é montado a partir de FoodOption.allowed_units,
 *  nunca a partir desta lista inteira. */
export type DiaryUnit =
  | 'g'
  | 'ml'
  | 'un'
  | 'colher_sopa'
  | 'colher_cha'
  | 'xicara'
  | 'fatia'
  | 'porcao';

export const DIARY_UNIT_LABELS: Record<DiaryUnit, string> = {
  g: 'g',
  ml: 'ml',
  un: 'unidade',
  colher_sopa: 'colher de sopa',
  colher_cha: 'colher de chá',
  xicara: 'xícara',
  fatia: 'fatia',
  porcao: 'porção',
};

/** Unidade em que o valor nutricional do alimento é expresso: 1 g, 1 ml ou 1 unidade. */
export type FoodBaseUnit = 'g' | 'ml' | 'un';

/** Procedência do dado nutricional. 'taco'/'curated' são curados e compartilhados;
 *  'openfoodfacts'/'llm' são estimativas isoladas por usuário (RS-17). */
export type FoodSource = 'taco' | 'curated' | 'openfoodfacts' | 'llm';

/** Alimento pronto para virar entrada. Mesmo formato na busca e no resolve. */
export interface FoodOption {
  /** 'catalog:<slug>' ou 'cache:<id>'. Opaco — não parsear, só repassar no POST. */
  food_ref: string;
  name: string;
  base_unit: FoodBaseUnit;
  kcal_per_base_unit: number;
  /** null = a fonte não informou o macro. NÃO é zero. */
  protein_per_base_unit: number | null;
  carbs_per_base_unit: number | null;
  fat_per_base_unit: number | null;
  /** Único insumo válido para montar o seletor de unidade deste alimento. */
  allowed_units: DiaryUnit[];
  source: FoodSource;
  /** true => a interface marca como estimativa. Já calculado no servidor. */
  is_estimate: boolean;
}

/** GET /diary/foods/search */
export interface FoodSearchResponse {
  results: FoodOption[];
  /** true apenas quando results está vazio: habilita o botão "Estimar com IA". */
  suggest_resolve: boolean;
}

/** Uma linha do diário. Totais já calculados e arredondados no servidor. */
export interface DiaryEntry {
  id: number;
  /** 'YYYY-MM-DD' */
  entry_date: string;
  meal_slot: MealSlot;
  food_ref: string;
  food_name: string;
  quantity: number;
  unit: DiaryUnit;
  base_unit: FoodBaseUnit;
  calories_total: number;
  /** null = macro desconhecido para este alimento. Não renderizar como 0. */
  protein_g_total: number | null;
  carbs_g_total: number | null;
  fat_g_total: number | null;
  source: FoodSource;
  is_estimate: boolean;
  /** ISO 8601 sem timezone (UTC) */
  created_at: string;
  updated_at: string;
}

/** Bloco de totais. `calories` sempre número; macros podem ser null. */
export interface DiaryTotals {
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

/** Refeição do CARDÁPIO (planejado) projetada no dia. Não é DiaryEntry. */
export interface DiaryPlannedMeal {
  /** id de meal_plan_meals */
  id: number;
  title: string;
  calories: number | null;
  recipe_id: number | null;
}

/** Um dos 6 slots. Sempre presente, mesmo vazio. */
export interface DiaryDaySlot {
  slot: MealSlot;
  label: string;
  /** Parte SÓLIDA da barra segmentada. */
  logged_calories: number;
  /** Parte HACHURADA da barra segmentada. 0 quando não há plano — nunca null. */
  planned_calories: number;
  entries: DiaryEntry[];
  planned_meals: DiaryPlannedMeal[];
}

/** Cardápio vigente na data, resolvido via diary_plan_bindings. */
export interface DiaryBoundPlan {
  binding_id: number;
  meal_plan_id: number;
  title: string;
  day_label: string;
  day_index: number;
}

/** GET /diary?date= e resposta de TODA mutação (POST/PATCH/DELETE).
 *  O frontend nunca soma nada: usa totals/logged_calories como vêm. */
export interface DiaryDay {
  /** 'YYYY-MM-DD' */
  date: string;
  /** Meta do perfil (profiles.daily_calories). null = perfil sem meta definida. */
  calories_target: number | null;
  totals: DiaryTotals;
  planned_totals: DiaryTotals;
  /** Calorias planejadas cujo slot não foi reconhecido. Já inclusas em planned_totals. */
  planned_unmatched_calories: number;
  entries_count: number;
  has_estimate: boolean;
  /** true => algum macro do dia é desconhecido; não apresentar totals de macro como fechado. */
  macros_incomplete: boolean;
  meal_plan: DiaryBoundPlan | null;
  /** SEMPRE 6 itens, sempre em MEAL_SLOT_ORDER. */
  slots: DiaryDaySlot[];
}

/** GET /diary/summary */
export interface DiaryDaySummary {
  date: string;
  calories: number;
  planned_calories: number;
  entries_count: number;
}

export interface DiarySummaryResponse {
  /** Todas as datas do intervalo, inclusive as sem registro. */
  days: DiaryDaySummary[];
  calories_target: number | null;
}

/** Corpo do POST /diary. Sem food_name, sem calories_total, sem user_id:
 *  o backend recusa campo extra com 422 (extra="forbid"). */
export interface DiaryEntryCreate {
  entry_date: string;
  meal_slot: MealSlot;
  food_ref: string;
  quantity: number;
  unit: DiaryUnit;
}

/** Corpo do PATCH /diary/{id}. Pelo menos um campo. food_ref NÃO é editável. */
export interface DiaryEntryUpdate {
  entry_date?: string;
  meal_slot?: MealSlot;
  quantity?: number;
  unit?: DiaryUnit;
}

/** POST /diary/foods/resolve */
export interface FoodResolveRequest {
  name: string;
  unit: DiaryUnit;
}

export interface DiaryPlanBinding {
  id: number;
  meal_plan_id: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface DiaryPlanBindingCreate {
  meal_plan_id: number;
  start_date: string;
  end_date?: string | null;
}

/** Erro de negócio: axios error.response.data.detail quando NÃO é array. */
export interface DiaryApiError {
  code:
    | 'FOOD_NOT_FOUND'
    | 'FOOD_NOT_RESOLVED'
    | 'FOOD_RESOLVER_UNAVAILABLE'
    | 'ENTRY_NOT_FOUND'
    | 'MEAL_PLAN_NOT_FOUND'
    | 'BINDING_NOT_FOUND'
    | 'PLAN_LIMIT_REACHED'
    | 'UNIT_NOT_SUPPORTED_FOR_FOOD';
  message: string;
  /** Presentes apenas em PLAN_LIMIT_REACHED (formato de quotas.py). */
  event_type?: string;
  limit?: number;
  used?: number;
}

/** O 422 devolve `detail` como ARRAY (handler do RS-12) e sem o campo `input`.
 *  Use este type guard antes de ler `detail.code`. */
export function isDiaryApiError(detail: unknown): detail is DiaryApiError {
  return typeof detail === 'object' && detail !== null && !Array.isArray(detail)
    && 'code' in (detail as Record<string, unknown>);
}
```

**Três regras que o agente de frontend não pode inferir do tipo e precisa seguir:**

1. **Nunca somar.** `totals.calories` e `slots[].logged_calories` vêm prontos. Somar `entries` no cliente produz um número diferente por arredondamento (§ 9.3) e a barra passa a discordar das linhas.
2. **`null` de macro nunca vira `0`.** Renderizar `—` ou "não informado". `0` é uma afirmação nutricional que ninguém fez.
3. **Não ler `error.response.data.detail[].input`.** O handler do RS-12 removeu esse campo de **toda** a API. Verificar se algum lugar do frontend já dependia dele. → handoff `ui-senior`.

---

## 8. Limites de plano

### 8.1 O diário em si é ilimitado nos três planos

**Registrar refeição não tem cota de plano e não é gated por plano.** Starter, Plus e Pro registram o quanto quiserem.

Duas razões, uma de produto e uma técnica:

- **Produto**: o diário é o laço de hábito diário e a fonte do dado que torna as features pagas (geração de cardápio calibrada, evolução de peso) compráveis. Medir o registro é medir o engajamento que sustenta a assinatura — cobra-se no lugar errado. O que se monetiza é a **inteligência** (gerar cardápio, resolver alimento desconhecido com IA), não a **digitação**.
- **Técnica**: `POST /diary` não custa nada por chamada — nenhuma API externa, nenhum token. É um `SELECT` por id e um `INSERT`. Cota de plano existe para repassar custo marginal ou racionar recurso escasso; aqui não há nem um nem outro.

**Ilimitado não é irrestrito.** Há dois tetos, e a distinção é o ponto:

| Teto | Valor | Natureza |
|---|---|---|
| RS-11 — entradas por dia | **60** por `(user_id, entry_date)` | **Segurança.** ~10 itens por refeição nos 6 slots: folgado para humano, apertado para laço. Devolve `403 PLAN_LIMIT_REACHED` com `event_type: "diary_entries_per_day"` — mesma forma que o frontend já trata, embora não seja limite comercial |
| RS-24 — rate limit | `60/minute` | **Segurança.** Contém rajada por origem |

Teto de segurança é fixo e igual para todos os planos; teto comercial varia com o plano. Confundir os dois leva a "compre o Pro para registrar mais almoços", que é o oposto do produto.

**Sem gating de profundidade de histórico na v1.** O Starter enxerga o histórico inteiro. É uma alavanca de monetização óbvia para depois (ex.: "últimos 30 dias no Starter"), mas ativá-la agora estraga o dado de retenção que ainda nem existe. Registrar como decisão consciente, não como esquecimento.

### 8.2 O caminho pago tem cota — chave nova `diary_food_resolve`

Único endpoint com custo marginal. Valores do RS-23, a acrescentar em `backend/app/core/plan_limits.py`:

| Plano | `limit` | `window_days` |
|---|---|---|
| `starter` | `10` | `1` |
| `plus` | `50` | `1` |
| `pro` | **`200`** | `1` |

`check_quota(db, user, "diary_food_resolve")` antes de chamar a fonte externa; `log_usage(...)` **só depois do sucesso** — falha de rede não pode debitar a cota do usuário. Acerto em `food_catalog` ou em `food_cache` (passos 1 e 2 do § 6.2) **não consome cota**: não custou nada.

### 8.3 Achado A-6 — `pro.food_lookup.limit = None`

O anexo do ADR-0002 classifica como **Médio**: `core/plan_limits.py:45` deixa `food_lookup` ilimitado no Pro, num caminho autenticado que gasta dinheiro por chamada. Uma conta Pro — ou uma credencial Pro vazada — mais um laço é orçamento aberto.

Este ADR faz duas coisas com esse achado:

1. **Não repete o erro.** `pro.diary_food_resolve.limit = 200`, um número. `200/dia` está uma ordem de grandeza acima de qualquer uso humano (uma pessoa não come 200 alimentos novos por dia) e ainda assim é um teto. A regra que fica: **`None` é aceitável em limite de armazenamento (`max_saved_recipes`), nunca em limite de chamada externa paga.**
2. **Corrige o existente.** `PLAN_LIMITS["pro"]["food_lookup"]["limit"]`: de `None` para **`2000`** (`window_days: 1`). O valor é 2× o do Plus, mantendo o Pro claramente superior, e limita o pior caso a 2.000 chamadas/dia/conta em vez de infinito. Mudança de uma linha, sem migration. → handoff `eng-senior`.

### 8.4 Retenção — resposta ao RS-30

O RS-30 delegou a decisão de retenção a este documento. **A retenção é por tabela, não global** — tratar "diário" e "cache" com a mesma régua erraria os dois.

| Dado | Retenção | Porquê |
|---|---|---|
| `diary_entries` | **Enquanto a conta existir.** Sem expurgo por idade | O histórico *é* o produto: correlacionar alimentação com peso ao longo de meses é a única coisa que um diário faz e uma planilha não. Apagar aos 12 meses destruiria a proposta. O crescimento já está limitado: RS-09 barra registro além de 730 dias no passado e RS-11 limita 60 entradas/dia — teto de ~44 mil linhas por conta, em anos |
| `diary_entries` na exclusão de conta | **Apagado imediatamente**, por `ondelete="CASCADE"` (RS-29) | Direito de eliminação, LGPD art. 18, VI |
| `food_cache` `source IN ('taco','curated')` | **Permanente** | Determinístico, versionado, não identifica ninguém |
| `food_cache` `source IN ('openfoodfacts','llm')` | **90 dias** desde `created_at` | Ver abaixo |
| `food_cache` com `created_by_user_id IS NULL` **e** `source IN ('openfoodfacts','llm')` | **Apagado no próximo job**, independente da idade | Órfã do `SET NULL` (§ 4.3): sem dono, casaria o índice parcial *compartilhado* e vazaria para todos |
| Log | Não retém conteúdo de diário **em nenhum nível** (RS-26), então não há o que expurgar | Log não tem controle de acesso e sobrevive à exclusão da conta |

**Por que 90 dias para o cache não confiável, e por que essa é a parte que reduz risco de verdade.** Essas linhas são exatamente as do achado **A-3** — dado de origem não verificável, agora isolado por usuário mas ainda servido como número nutricional. Um TTL:

- **força reverificação periódica**: um valor forjado na Open Food Facts em janeiro deixa de ser servido em abril, mesmo que ninguém perceba o ataque;
- **limita a janela de exposição** de um envenenamento bem-sucedido a um trimestre, em vez de "para sempre";
- **limita crescimento** da única tabela que cresce com o comportamento do usuário e não com o catálogo;
- **custa pouco**: no máximo uma re-resolução por usuário, por alimento, por trimestre — e as entradas de diário já criadas **não mudam**, porque guardam snapshot (§ 4.4).

Implementação: job no APScheduler existente (`core/scheduler.py`), **1×/dia, fora do horário de pico**. Duas instruções: usa `ix_food_cache_retention` (`source`, `created_at`), e apaga em lotes (`DELETE ... WHERE id IN (SELECT id ... LIMIT 500)`) — o scheduler roda no mesmo processo e disputa um pool de 5+5 conexões (`db/session.py:26-28`); um `DELETE` gigante segura conexão e derruba request.

**O que precisa ir para a política de privacidade** (→ handoff `tech-writer`, fecha o RS-30):
1. o diário coleta **dado pessoal sensível de saúde** (LGPD art. 5º, II) — e o que ele revela por inferência está descrito na seção 6 do ADR-0002;
2. o **nome do alimento** (e só ele, RS-28) é enviado ao Google/Gemini quando não é encontrado localmente — transferência a terceiro, que exige informação prévia;
3. o histórico é retido **enquanto a conta existir** e apagado na exclusão da conta;
4. o cache de estimativas expira em **90 dias**.

---

## 9. Unidades e arredondamento

Esta seção existe para que back e front produzam **exatamente o mesmo número**. Toda a aritmética mora em **um** módulo: `backend/app/services/diary_math.py`. O frontend não reimplementa nada daqui.

### 9.1 As 8 unidades, em duas famílias

| Unidade | Família | Fator para a unidade base |
|---|---|---|
| `g` | massa/volume | `1.0` |
| `ml` | massa/volume | `1.0` |
| `colher_sopa` | massa/volume | `15.0` |
| `colher_cha` | massa/volume | `5.0` |
| `xicara` | massa/volume | `240.0` |
| `un` | contagem | `1.0` |
| `fatia` | contagem | `1.0` |
| `porcao` | contagem | `1.0` |

```python
UNIT_FACTOR: dict[str, float] = {
    "g": 1.0, "ml": 1.0, "colher_sopa": 15.0, "colher_cha": 5.0, "xicara": 240.0,
    "un": 1.0, "fatia": 1.0, "porcao": 1.0,
}
MASS_VOLUME_UNITS = frozenset({"g", "ml", "colher_sopa", "colher_cha", "xicara"})
COUNT_UNITS = frozenset({"un", "fatia", "porcao"})
```

**Uma colher de sopa é 15 g de sólido e 15 ml de líquido** — o `base_unit` do alimento decide qual. É uma aproximação assumida (uma colher de azeite tem ~13,5 g, não 15). A aproximação está no **dado nutricional**, não no contrato: dois clientes com a mesma entrada obtêm rigorosamente o mesmo número. `fatia` e `porcao` valem 1 unidade do alimento — "1 fatia de queijo" já é um item de `TACO_PER_UNIT`.

### 9.2 `allowed_units` — compatibilidade unidade × alimento

Regra fechada, calculada no servidor e devolvida em `FoodOption.allowed_units`:

| `base_unit` do alimento | `allowed_units` |
|---|---|
| `g` | `["g", "colher_sopa", "colher_cha", "xicara"]` |
| `ml` | `["ml", "colher_sopa", "colher_cha", "xicara"]` |
| `un` | `["un", "fatia", "porcao"]` |

Unidade fora da lista → **`422`** com `code: "UNIT_NOT_SUPPORTED_FOR_FOOD"`. "3 xícaras de ovo cozido (unidade)" não é um erro de digitação a ser adivinhado: não há fator de conversão honesto entre contagem e volume sem saber o volume da unidade, e chutar produziria número errado com cara de certo.

O frontend monta o seletor **a partir de `allowed_units`**, nunca a partir de `DIARY_UNIT_LABELS` inteiro. Assim a regra existe num lugar só, e não em dois que precisam concordar.

### 9.3 Cálculo e arredondamento — arredonda-se **uma vez**, no backend

```python
def calcular(kcal_por_base: float, macro_por_base: float | None,
             quantity: float, unit: str) -> tuple[float, float | None]:
    fator = quantity * UNIT_FACTOR[unit]        # NÃO arredondar o fator
    kcal = round(kcal_por_base * fator, 1)
    macro = None if macro_por_base is None else round(macro_por_base * fator, 1)
    return kcal, macro
```

As quatro regras, na ordem em que importam:

1. **O fator intermediário nunca é arredondado.** Só o resultado final.
2. **`round(x, 1)`** — uma casa decimal, para kcal e para gramas de macro. `round` nativo do Python (half-to-even). Não `Decimal`, não `math.floor`, não formatação de string.
3. **Os totais somam os valores JÁ arredondados e persistidos**, e arredondam de novo:
   ```python
   totals_calories = round(sum(e.calories_total for e in entradas_do_dia), 1)
   ```
   Isto é deliberado e é o cerne desta seção. Somar valores crus e arredondar só no fim daria um total mais "correto" matematicamente e **diferente da soma das linhas visíveis na tela** — o usuário somaria 3 linhas com a calculadora e acharia um bug. Preferimos o total que fecha com o que está escrito.
4. **O frontend nunca soma.** Consequência direta da regra 3: qualquer soma no cliente é redundante na melhor hipótese e divergente na pior.

**Exemplos verificáveis** (usar como caso de teste):

| Entrada | Conta | `calories_total` |
|---|---|---|
| 100 g de arroz branco cozido (128 kcal/100 g → `1.28`) | `1.28 × 100` | `128.0` — igual ao exigido pelo teste do RS-10 |
| 150 g de arroz branco cozido | `1.28 × 150` | `192.0` |
| 1 colher_sopa de azeite (884 kcal/100 g → `8.84`) | `8.84 × 15` | `132.6` |
| 2 un de ovo (70 kcal/un) | `70.0 × 2` | `140.0` |
| 0,5 xicara de leite integral (61 kcal/100 ml → `0.61`) | `0.61 × 120` | `73.2` |

**Tipo de retorno**: `float` no Python, `Float` no banco, `number` no TypeScript, `number` no JSON. Nunca string, nunca `Decimal`, nunca centavos-em-inteiro.

`Float` (ponto flutuante binário) é o tipo já usado por todas as colunas numéricas do projeto (`recipes.calories`, `meal_plan_meals.calories`, `food_cache.calories_per_unit`) e trocar por `Numeric` só nesta feature criaria duas convenções. O custo é conhecido: somar 60 floats acumula ruído na 13ª casa. O `round(..., 1)` na fronteira o esconde completamente na faixa de valores desta feature (0–20.000 kcal). Registrado como consequência, não como descuido.

### 9.4 `null` de macro é "desconhecido", nunca zero

Um alimento resolvido por LLM ou Open Food Facts pode ter kcal confiável e macro nenhum. Nesse caso `protein_per_base_unit` (e o total derivado) é **`NULL` no banco e `null` no JSON**.

- A soma do dia **ignora** as entradas com macro `null` — não trata como 0.
- `DiaryDay.macros_incomplete` fica `true` para que a interface não apresente `totals.protein_g` como número fechado.
- A interface renderiza `—`, nunca `0 g`.

É o mesmo princípio do RS-22 aplicado a macro: falha e ausência não podem se disfarçar de valor. "0 g de proteína" é uma afirmação nutricional; ninguém a fez.

---

## 10. Consequências

### 10.1 O que fica mais fácil

- Uma chamada desenha a tela do dia inteira, planejado e registrado (D-4, D-6). Sem React Query no projeto, isso importa mais do que importaria: cada chamada extra seria um `useEffect` a mais para sincronizar à mão.
- Envenenamento de dado nutricional deixa de atravessar contas (D-1). O achado A-3 passa de "explorável contra toda a base" para "explorável contra a própria conta do atacante".
- `POST /diary` é determinístico e gratuito: nenhuma rede externa, um `SELECT` por id (D-5). Dá para testar sem mock de LLM.
- Corrigir um valor no catálogo não reescreve o histórico de ninguém (snapshot, § 4.4).

### 10.2 O que fica mais difícil, e o que isso custa

| Custo | Detalhe | Mitigação |
|---|---|---|
| **Duas fontes para o mesmo alimento** | `food_catalog` (curado) e `food_cache` (resolvido) vivem em paralelo, com `food_ref` de dois namespaces | O namespace é explícito na string; um `_resolver_food_ref()` único, e nenhuma outra função resolve |
| **Deriva entre `taco_foods.py` e `food_catalog`** | Editar o arquivo e esquecer de subir `TACO_DATASET_VERSION` faz o seeder não sincronizar | Teste que assere `count(dataset_version=atual) == len(TACO_FOODS)` depois do `sync`. → `tester-senior` |
| **Fluxo de dois passos na interface** | Buscar → registrar. Alimento novo exige o passo do resolve, com botão explícito | É a mesma separação que o RS-16 exige por custo; a interface a apresenta como "Estimar com IA", não como erro |
| **Payload de mutação maior** | `POST`/`PATCH`/`DELETE` devolvem o dia inteiro (≤ 60 entradas ≈ 25 KB no pior caso) | Preço de eliminar refetch e divergência de soma. Se virar problema, o corte é paginar o dia — não voltar a somar no cliente |
| **Barra hachurada é retroativa** | Trocar o cardápio vinculado muda o planejado de dias passados (§ 3.2) | Documentado como comportamento, não bug. Congelar exigiria copiar o plano por dia |
| **Sem constraint de não sobreposição de binding** | Dois vínculos podem cobrir a mesma data | Desempate determinístico `start_date DESC, id DESC`, com teste do comportamento observável (§ 6.9). `EXCLUDE` não existe em SQLite |
| **`downgrade` destrói dados** | Desce e apaga `diary_entries` e esvazia `food_cache` (§ 5.3) | Aviso em maiúscula no topo da migration + `pg_dump` obrigatório antes. → `devops-senior` |
| **`Float` acumula ruído** | Somar 60 floats tem erro na 13ª casa (§ 9.3) | `round(..., 1)` na fronteira o elimina na faixa desta feature. Trocar por `Numeric` criaria duas convenções no projeto |

### 10.3 O que precisa ser monitorado depois do deploy

| Sinal | Limiar de atenção | O que significa |
|---|---|---|
| `food_cache` com `source IN ('llm','openfoodfacts')` — linhas/dia | Crescimento sustentado acima de ~50/dia/usuário | Teto de escrita do RS-23 sendo raspado, ou catálogo com buraco grande |
| Taxa de `suggest_resolve: true` na busca | > 30% das buscas | O catálogo TACO não cobre o que as pessoas comem → expandir `curated` sai mais barato que pagar LLM |
| `503 FOOD_RESOLVER_UNAVAILABLE` | Qualquer ocorrência | Disjuntor abriu: incidente no Gemini, ou laço de retry no cliente |
| `403` com `event_type: "diary_entries_per_day"` | Recorrente na mesma conta | Ou abuso, ou o teto de 60 é baixo demais para um caso de uso real |
| p95 de `GET /diary?date=` | > 400 ms | As 5 queries viraram N+1 — provável `joinedload` perdido nas refeições do plano |
| Linhas apagadas pelo job de retenção | Zero por várias semanas | O job não está rodando; o TTL de 90 dias é ficção |

### 10.4 Critério de extração — quando isto deixa de ser módulo

O diário nasce como módulo do monolito (`routers/diary*.py` + `services/diary_*.py`), como todo o resto. O critério concreto para virar serviço separado, declarado agora para não ser decidido no calor de um incidente:

> **Extrair `diary_foods` (busca + resolve) para um serviço próprio quando qualquer um destes for verdadeiro por 2 semanas seguidas:**
> 1. o resolvedor externo consumir > 30% das conexões do pool (5+5 por processo) em p95 — a chamada de 10 s segurando worker passa a competir com a escrita do diário;
> 2. `food_catalog` passar de ~50 mil linhas — a busca deixa de caber em seq scan e precisa de `pg_trgm`/GIN, ou de um mecanismo de busca de verdade, que é outra tecnologia e outro ciclo de deploy;
> 3. a cadência de mudança do catálogo (curadoria nutricional) se descolar da cadência de deploy do backend.

Nenhum é verdade hoje, e por isso **não é serviço hoje**. O que já está pronto para a extração: `diary_foods` não compartilha tabela de escrita com `diary` (só lê `food_catalog`/`food_cache`), e a fronteira entre os dois já é uma string (`food_ref`), não um objeto. Enquanto essa fronteira continuar sendo uma string, a extração é mecânica.

---

## 11. Limites da plataforma verificados

| Limite | Valor real | Efeito no desenho |
|---|---|---|
| **Runtime** | Python/FastAPI em contêiner no Render. Versão da fonte única `backend/.python-version` (usada por `tests.yml:41` e `deploy-render.yml:99`). **Não há runtime Edge neste projeto** | Nenhuma restrição de Edge se aplica. Se algum dia houver função Edge, `services/ai.py` (httpx, timeouts longos) e todo o SQLAlchemy ficam **fora** dela por construção |
| **Conexões** | Postgres via **pooler do Supabase em session mode**; `pool_size=5` + `max_overflow=5` = **10 por processo**, `pool_pre_ping=True`, `pool_timeout=30 s`, `pool_recycle=1800 s` (`app/db/session.py:18-33`) | É o limite que dita D-4 (≤ 5 queries e 1 chamada para a tela do dia) e o `DELETE` em lotes do § 8.4. O **APScheduler roda no mesmo processo** e abre a própria `SessionLocal()`, disputando o mesmo pool |
| **Timeout de request** | Render corta em **~100 s** (documentado em `services/ai.py:16-19`) | `POST /diary/foods/resolve` usa **10 s** (RS-23), não os 90 s de `GEMINI_TIMEOUT_SECONDS`. Um caminho interativo de 90 s ocupa 1 de 10 conexões e é, ele próprio, o vetor de DoS |
| **Trabalho fora do caminho da requisição** | Nenhum job novo. O expurgo de retenção (§ 8.4) entra no APScheduler que já roda `_run_lifecycle_job` a cada 24 h (`core/scheduler.py:43`) | Não há fila (Inngest/QStash) no projeto e esta feature **não justifica introduzir uma**: o único trabalho assíncrono é um `DELETE` diário em lotes. Se o resolve precisar virar assíncrono, aí sim é decisão de fila — e é outro ADR |
| **Tamanho de bundle (frontend)** | Vite (`rolldown-vite`), React 19. `axios`, `date-fns`, `recharts`, `lucide-react`, `clsx`, `tailwind-merge` **já estão** em `frontend/package.json` | **Zero dependência nova.** Datas com `date-fns`, gráficos com `recharts`, chamadas com o `api` de `lib/api.ts`. Sem React Query no projeto: o estado do dia é `useState` alimentado pelo `DiaryDay` que toda mutação devolve (D-6) — o que é justamente por que D-6 vale a pena aqui |
| **Custo por invocação** | `GET /diary`, `POST/PATCH/DELETE /diary`, `GET /diary/summary`, `GET /diary/foods/search`: **R$ 0,00** — só banco. `POST /diary/foods/resolve`: **único caminho pago** (Open Food Facts grátis mas com latência; Gemini por token) | Teto de gasto por conta: `starter` 10/dia, `plus` 50/dia, `pro` 200/dia (§ 8.2). Teto global: disjuntor de 500 chamadas/hora (RS-23). Pior caso diário sem o disjuntor com 100 contas Pro: 20.000 chamadas — com ele, 12.000. É por isso que o disjuntor não é opcional |
| **Migration em dois dialetos** | Produção Postgres; suíte inteira em **SQLite in-memory** (`tests/conftest.py:15`) | `batch_alter_table` obrigatório; índice parcial com `postgresql_where` **e** `sqlite_where`; nada de `JSONB`, `ARRAY`, `EXCLUDE` ou `CHECK` alterável (§ 5) |
| **Rate limiting atrás de proxy** | `TRUSTED_PROXY_COUNT` tem default **`0`** (`core/config.py:54`) | Com `0` em produção, todos os limites do RS-24 viram um balde único global e o `5/minute` do resolve quebra a feature para todo mundo. **`TRUSTED_PROXY_COUNT=1` no Render é pré-requisito de deploy** (RS-25) |

---

## 12. Handoffs

Fora do escopo deste ADR. Cada item vai com o responsável, como manda o processo.

| Para | O quê |
|---|---|
| `eng-senior` | Implementar §§ 4–6 e 8–9: models, migration `d5a3e7c1b204`, schemas, routers `diary.py`/`diary_foods.py`, `services/diary_math.py`, `services/diary_plan.py`, seeder. Os macros dos 96 registros da TACO têm que vir da tabela TACO/UNICAMP real — item sem macro publicado fica fora de `TACO_FOODS`. Mais o A-6: `pro.food_lookup.limit` de `None` para `2000` (§ 8.3) |
| `ui-senior` | Consumir § 6 com os tipos do § 7. Debounce ≥ 300 ms na busca (RS-24); marcar `is_estimate` na interface (decisão 2 do dono do produto); renderizar macro `null` como `—`; **nunca somar total**; verificar se algo hoje lê `detail[].input` (RS-12) |
| `si-senior` | Revisar se a partição do § 4.3 (dois índices parciais + o `WHERE` do RS-17) de fato fecha o A-3, e se o par `SET NULL` + expurgo de órfãs (§ 4.3, § 8.4) não deixa janela |
| `tester-senior` | Testes de `services/diary_math.py` (tabela de exemplos do § 9.3, com `128.0` do RS-10); garantia de 6 slots sempre presentes; deriva `TACO_FOODS` × `food_catalog`; desempate de binding sobreposto (§ 6.9); `upgrade`/`downgrade`/`upgrade` da migration em SQLite |
| `devops-senior` | **`pg_dump` de `food_cache` antes de aplicar a migration** (§ 5.2) e de todo o banco antes de qualquer `downgrade` (§ 5.3). `TRUSTED_PROXY_COUNT=1` no Render (RS-25). Confirmar que o coletor de log não captura corpo de 4xx |
| `tech-writer` | Política de privacidade com os 4 pontos do § 8.4 — fecha o RS-30 |
| `full-senior` | Verificação pós-deploy de que a ordem de `include_router` do § 6.0 está correta: `GET /diary/foods/search?q=arroz` tem que devolver `200`, não `422` |

---

## 13. Checklist de sincronia entre os dois agentes

O que quebra o merge se divergir. Cada linha é verificável sem ler o resto do documento.

- [ ] `DiaryDay.slots` tem **6 itens**, na ordem de `MEAL_SLOT_ORDER`, mesmo vazios
- [ ] `POST`, `PATCH` e `DELETE` de `/diary` devolvem **`DiaryDay`**, não `DiaryEntry` (e o `DELETE` é `200`, não `204`)
- [ ] `POST /diary` manda **`food_ref`**, nunca `food_name` e nunca `calories_total`
- [ ] Recurso alheio é sempre **`404`**, com corpo idêntico ao de id inexistente. `403` só com `code: "PLAN_LIMIT_REACHED"`
- [ ] `detail` é **objeto** com `code` em erro de negócio e **array** em `422`; o `422` **não** traz `input`
- [ ] `null` de macro é desconhecido; a interface mostra `—`, nunca `0`
- [ ] O seletor de unidade vem de **`allowed_units`**, nunca da lista completa de unidades
- [ ] O frontend **não soma** nada: usa `totals.*` e `slots[].logged_calories` como vêm
- [ ] `include_router(diary_foods)` **antes** de `include_router(diary)` no `main.py`
- [ ] `down_revision = 'c4f8b1d90a27'` e `alembic heads` imprime **uma** head
- [ ] `app/db/base.py` importa `FoodCatalog`, `DiaryEntry` e `DiaryPlanBinding`
- [ ] `TACO_PER_100G` e `TACO_PER_UNIT` continuam existindo com o mesmo conteúdo — `services/ai.py` fica intocado
- [ ] `cd backend && ./.venv/bin/python -m pytest -q` continua em **231 passed** ou mais

