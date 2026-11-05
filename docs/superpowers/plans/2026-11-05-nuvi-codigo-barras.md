# Frente B: código de barras, plano de implementação

> **Para agentes:** sub-skill obrigatória: superpowers:executing-plans (ou subagent-driven-development). Os passos usam caixas de seleção (`- [ ]`).

**Objetivo:** ler um código de barras e devolver um `FoodOption` pronto para o diário, de graça em todos os planos.

**Arquitetura:**
- Toda a lógica fica em `app/services/openfoodfacts.py`: a cadeia mine → cache → Open Food Facts, a validação e a gravação no cache.
- A rota `GET /diary/foods/barcode/{code}` em `app/routers/diary_foods.py` só traduz as exceções do serviço em HTTP. Assim o router continua sem importar `FoodCache` (grep do RS-13) e sem tocar no LLM (RS-16).
- O frontend `src/pages/registrar/CodigoDeBarras.tsx` usa a câmera quando ela existe e mostra um campo digitado como alternativa.

**Stack:** FastAPI, SQLAlchemy, httpx e pytest; React 19, react-router 7 e Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-redesign-nuvi-fase1-design.md` §7 item 3, mais o plano-mãe `docs/superpowers/plans/2026-11-05-redesign-nuvi-fase1.md` (Frente B), o ADR-0001 (§4.3 e §6) e o ADR-0002 (RS-13, RS-16, RS-17, RS-18, RS-21, RS-22, RS-24, RS-26 e RS-27).

## Restrições globais

- **Grátis em todos os planos:** sem `check_quota` e sem `log_usage`.
- **Tempo limite do Open Food Facts:** 5 s (`OFF_BARCODE_TIMEOUT_SECONDS = 5.0`).
- **Cache em `food_cache`:**
  - `source="openfoodfacts"`, `created_by_user_id=<usuário>` e `off_product_id=<código>`;
  - `name_normalized = f"barcode:{code}"`. Isso evita colisão no `uq_food_cache_private` entre dois produtos de mesmo nome, e impede que o `resolve` por nome case com uma linha de código de barras.
- **Leitura do cache:** `source == "openfoodfacts"`, `off_product_id == code` e `created_by_user_id == user_id` (RS-17: uma linha do OFF nunca é compartilhada).
- **Código:** `^\d{8,14}$` (EAN-8, UPC-A, EAN-13 e GTIN-14). Qualquer outro valor dá `422` antes de qualquer rede, e com isso a URL externa não é montada a partir de texto livre.
- **Plausibilidade (RS-18):** usa `diary_foods.kcal_plausivel` por grama ou ml. Cada macro precisa estar em `[0, 1]` g por g; fora disso, vira `None` (não sei), nunca zero.
- **Unidade base:** `ml` quando `product_quantity_unit` do OFF for `ml`, `l` ou `cl`; senão, `g`.
- **Nome:** `product_name_pt`, depois `product_name`, depois `generic_name`. Tira caracteres de controle e corta em 120. Sem nome, usa `"Produto {code}"`.
- **Respostas:**
  - `200 FoodOption` (`food_ref` `cache:<id>` ou `mine:<id>`, `is_estimate=True` para o OFF);
  - `404 {"code":"FOOD_NOT_FOUND","message":"Produto não encontrado."}`;
  - `503 {"code":"BARCODE_UNAVAILABLE",...}` para tempo esgotado ou erro de rede. Segue o Δ3: falha não se disfarça de "não existe";
  - `422` para código inválido.
- **Rate limit:** `30/minute`, igual ao da busca (RS-24).
- **Log (RS-26):** só `user_id` e a origem. Nunca o código nem o nome.
- **Teto de escrita:** reutiliza `diary_foods._pode_gravar_cache`. Acima dele, devolve uma opção efêmera (`cache:0`), como o resolve faz.
- **Corrida entre duas leituras:** um `IntegrityError` na gravação leva a rollback e a uma nova leitura do cache.

## Foco de revisão

1. **Sem câmera ou com permissão negada:** o campo digitado aparece. Coberto na Tarefa 4.
2. **OFF lento ou fora do ar:** `503` em até ~5 s, nunca `404`. Coberto na Tarefa 1 (`test_tempo_esgotado_levanta_indisponivel`) e na Tarefa 2.
3. **Produto do OFF com kcal absurdo (wiki editável):** `404`, e nada é gravado. Coberto na Tarefa 1.
4. **Código com letras ou com `../`:** `422`, sem chamada externa. Coberto na Tarefa 2.
5. **Usuário B lendo o mesmo código já cacheado por A:** não reaproveita a linha de A. Coberto na Tarefa 2 (isolamento).

---

### Tarefa 1: `app/services/openfoodfacts.py`

**Arquivos:** criar `backend/app/services/openfoodfacts.py` e `backend/tests/test_openfoodfacts.py`.

**Interfaces (produz):**
- `CODIGO_VALIDO: re.Pattern`, igual a `^\d{8,14}$`.
- `class BarcodeNotFound(Exception)` e `class BarcodeUnavailable(Exception)`.
- `buscar_produto_off(code: str) -> Optional[ProdutoOff]`. `ProdutoOff` é um dataclass com `nome`, `base_unit`, `kcal`, `proteina`, `carbo` e `gordura` (por g ou ml).
  - Faz `GET https://world.openfoodfacts.org/api/v2/product/{code}.json` com `fields=code,product_name,product_name_pt,generic_name,nutriments,product_quantity_unit` e `timeout=5.0`.
  - Devolve `None` para 404, `status != 1` ou produto sem `energy-kcal_100g`.
  - Levanta `BarcodeUnavailable` com `httpx.TimeoutException` ou `httpx.HTTPError`, ou com status 5xx.
- `buscar_por_codigo(db: Session, user_id: int, code: str) -> FoodOption`. A ordem é mine (gancho, Tarefa 3) → cache escopado → OFF. Levanta `BarcodeNotFound` ou `BarcodeUnavailable`.

- [ ] Testes com `httpx.MockTransport` no `monkeypatch` do `httpx.Client`:
  - `test_produto_encontrado_vira_opcao_cacheada`: kcal 250/100 g → `kcal_per_base_unit == 2.5`, `source == "openfoodfacts"`, `is_estimate`, uma linha com `off_product_id == code`;
  - `test_segunda_leitura_vem_do_cache_sem_rede`;
  - `test_produto_inexistente_levanta_nao_encontrado`: OFF com 404 ou `status: 0`;
  - `test_tempo_esgotado_levanta_indisponivel`;
  - `test_kcal_implausivel_nao_grava`: 5000/100 g;
  - `test_macro_fora_da_faixa_vira_none`;
  - `test_bebida_em_ml`;
  - `test_cache_de_outro_usuario_nao_e_lido`.
- [ ] Ver falhar, implementar e ver passar.
- [ ] Commit `feat(diario): serviço de código de barras do Open Food Facts` e subir.

### Tarefa 2: rota `GET /diary/foods/barcode/{code}`

**Arquivos:** alterar `backend/app/routers/diary_foods.py` (só a função nova) e criar `backend/tests/test_diary_barcode.py`.

- [ ] Testes:
  - `200` com o OFF falso;
  - `404 FOOD_NOT_FOUND`, sem o código na mensagem;
  - `503 BARCODE_UNAVAILABLE` com tempo esgotado;
  - `422` para `abc12345`, `1234567` e 15 dígitos;
  - **plano Starter com a cota `diary_food_resolve` esgotada continua `200`**, e nenhuma linha de uso é gravada;
  - isolamento: A lê, e B não recebe o `food_ref` de A (B gera a própria linha, ou `404` se o OFF não responder);
  - `401` sem login;
  - o `food_ref` devolvido funciona no `POST /diary`;
  - grep RS-13: `FoodCache` não aparece no router.
- [ ] Ver falhar, implementar com `@limiter.limit("30/minute")` e ver passar.
- [ ] Rodar a suíte inteira. Commit `feat(diario): rota de código de barras, grátis em todos os planos` e subir.

### Tarefa 3: procurar primeiro no `mine` (só depois do contrato da Frente R na `main`)

- [ ] Esperar `GET /diary/foods/mine?barcode=` e o modelo `UserFood` na `main`.
- [ ] Teste `test_mine_tem_prioridade_sobre_off`: com um `UserFood(barcode=code)` do usuário, a resposta tem `food_ref == "mine:<id>"` e nenhuma chamada ao OFF. O `UserFood` de outro usuário é ignorado.
- [ ] No `buscar_por_codigo`, a primeira etapa usa a função de opção que a Frente R expõe para o `mine:`.
- [ ] Commit e subir.

### Tarefa 4: `src/pages/registrar/CodigoDeBarras.tsx` (depois da F6 na `main`)

- [ ] Câmera:
  - `BarcodeDetector` nativo quando existir;
  - senão, `@zxing/browser` (sem dependência de animação);
  - formatos EAN-13, EAN-8, UPC-A e UPC-E.
- [ ] Campo "Digite o código" sempre disponível. Ele é a tela principal quando `getUserMedia` não existe ou quando a permissão é negada (`NotAllowedError` ou `NotFoundError`).
- [ ] Achou: navega para `ROUTES.alimento(food_ref)`. `404`: mostra "Cadastrar como meu alimento", que leva a `/alimentos/novo?barcode=…`. `503`: "Não deu para consultar agora", com "Tentar de novo".
- [ ] Testes Vitest com `fetch` falso:
  - permissão negada mostra o campo;
  - digitar um código válido chama `/diary/foods/barcode/{code}` e navega;
  - `404` mostra o link de cadastro com o `barcode`;
  - código com menos de 8 dígitos não envia.
- [ ] Verificar no navegador interno, com entrada digitada, a 375 px e a 1280 px, nos temas claro e escuro. Commit e subir.
