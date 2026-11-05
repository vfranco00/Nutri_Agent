# Frente G: Agente que registra — plano de implementação

> **Para agentes:** sub-skill obrigatória: superpowers:executing-plans (ou subagent-driven-development). Os passos usam caixas de seleção (`- [ ]`).

**Objetivo:** o usuário escreve "comi 2 ovos e pão francês" (ou manda uma foto) na aba `/agente`; o backend devolve os itens casados com a TACO, e o usuário confirma antes de qualquer coisa entrar no diário.

**Arquitetura:** `POST /agent/parse` faz **uma** chamada ao Gemini, que devolve JSON estrito com os itens. Cada item é casado pelos primeiros passos do caminho do `resolve` (catálogo exato → cache escopado), e o que não casar vira item de confiança `baixa` com as alternativas da busca do catálogo. A rota **não grava nada** e não chama Open Food Facts nem um segundo LLM por item: o que ficar sem correspondência o usuário resolve com a busca normal (e o `resolve` pago, que conta cota à parte). O frontend confirma e grava com `POST /diary`, item por item.

**Stack:** FastAPI, Pydantic v2, httpx, pytest (backend); React 19, react-router 7, Tailwind v4 e os componentes da Fundação (frontend).

**Spec:** `docs/superpowers/specs/2026-11-05-redesign-nuvi-fase1-design.md` (§7 item 7) e a Frente G de `docs/superpowers/plans/2026-11-05-redesign-nuvi-fase1.md`. Contrato do diário: `docs/adr/0001-diario-alimentar.md`.

## Restrições globais

- Posse: `backend/app/routers/agent.py`, `backend/app/services/agent_parse.py`, `backend/tests/test_agent_parse.py`, `frontend/src/pages/Agente.tsx` (+ `Agente.test.tsx`, `frontend/src/lib/agentApi.ts`). Fora da posse, só o mínimo e dito no commit: o `include_router` em `app/main.py`, a extração de `call_gemini_parts` em `app/services/ai.py`, a rota `/agente` em `src/App.tsx` e os tipos em `src/types.ts`.
- Cota: `diary_food_resolve` (Starter 10/dia, Plus 50, Pro 200). Debita **uma** vez por parse quando o Gemini respondeu (chamada paga), mesmo que a resposta não sirva. Falha de rede ou disjuntor aberto não debitam (§ 8.2 do ADR-0001).
- Cota esgotada: **`429`**, `detail = { code: "PLAN_LIMIT_REACHED", message, upgrade_url: "/assinatura", limit, used }`, com `message` = `"Você usou as {limit} leituras do Agente de hoje no plano {Nome}. Assine um plano maior para continuar."` (`Nome` = Starter/Plus/Pro).
- Imagem: `image_base64` (pode vir com o prefixo `data:image/...;base64,`), JPEG, PNG ou WebP, até **4 MB decodificados**. Maior → **`413`** `{ code: "IMAGE_TOO_LARGE", message: "A foto é grande demais. Envie uma de até 4 MB." }`. Base64 inválido ou tipo desconhecido → `422`.
- Texto: até 500 caracteres; quebras de linha viram espaço; outro byte de controle → `422`. Sem texto e sem imagem → `422`.
- RS-26: nenhum log recebe o texto, o nome de alimento ou a imagem. Só `user_id`, contagens e confiança.
- O prompt leva só o texto do usuário, a lista de nomes do catálogo e as unidades permitidas. Nunca perfil, e-mail ou meta.
- Saída do Gemini validada estritamente: no máximo 12 itens; nome pelo `_validar_nome_alimento`; `unit` em `DiaryUnitType`; `0 < quantity ≤ 10000`. Item que reprova é descartado, não corrigido.
- Rate limit `10/minute` (o chat pede mais que o `resolve`, que é 5).
- Frontend: botão laranja com texto `#1C1712`; sem gradiente; DM Sans; a espera mostra `NuviSlice face="normal" wave` só depois de 300 ms (`useDelayedFlag`); movimento reduzido respeitado pela própria `brand.css`.

## Foco de revisão

- Gemini responde texto que não é JSON, ou JSON com campos a mais/tipos errados → 200 com `items: []` (o chat diz "Não entendi"), e a cota debita.
- Gemini devolve unidade que o alimento não aceita ("2 g de ovo" para um alimento `un`) → item `baixa`, unidade trocada para a primeira permitida e quantidade padrão (1 un ou 100 g/ml), nunca um 422 do `POST /diary` depois.
- Gemini fora do ar (`call_gemini_parts` devolve `None`) → `503 AGENT_UNAVAILABLE`, sem debitar.
- Cota esgotada no Starter → o texto digitado continua no campo, e a mensagem do plano tem o link `/assinatura`.
- Item sem correspondência → `food: null`, `confidence: "baixa"`, `alternatives` da busca; o cartão oferece "Buscar" em vez de Confirmar para ele.

---

## Contrato

```
POST /agent/parse
{ text?: string; image_base64?: string; date: "AAAA-MM-DD"; meal_slot?: MealSlot }

200 {
  date: string,
  meal_slot: MealSlot | null,          // o que o texto disser ("no jantar") vence o da requisição
  items: Array<{
    name: string,                      // como o Gemini entendeu o item
    food: FoodOption | null,           // null = sem correspondência
    quantity: number,
    unit: DiaryUnitType,
    confidence: "alta" | "baixa",
    alternatives: FoodOption[]         // até 5 da busca do catálogo; [] quando alta
  }>
}
```

Desvio consciente do plano-mãe: `food` pode ser `null` e há `name` e `alternatives` a mais. Sem isso, "item sem correspondência, com a opção de buscar" não cabe no contrato.

Regra de confiança (`casar_item`):
1. `food_catalog` com `name_normalized` exato e `base_unit` compatível com a unidade → `alta`.
2. `food_catalog` com nome exato em outra família de unidade → o alimento, `baixa`, unidade/quantidade padrão.
3. `ler_cache_escopado` → `alta` se `is_estimate` falso, senão `baixa`.
4. `buscar_no_catalogo(nome)` com resultado → o primeiro como `food`, `baixa`, `alternatives` = até 5.
5. Nada → `food: null`, `baixa`, `alternatives: []`.

---

### Tarefa G1: serviço `agent_parse` (Gemini falso)

**Arquivos:**
- Criar: `backend/app/services/agent_parse.py`
- Alterar: `backend/app/services/ai.py` (extrair `call_gemini_parts(parts, timeout)`; `call_gemini` passa a delegar)
- Teste: `backend/tests/test_agent_parse.py`

**Interfaces (produz):**
- `ai.call_gemini_parts(parts: list[dict], timeout: float) -> str | None`
- `agent_parse.MAX_IMAGE_BYTES = 4_000_000`, `MAX_ITENS = 12`
- `class ImagemGrande(Exception)`, `class ImagemInvalida(Exception)`, `class AgenteIndisponivel(Exception)`
- `decodificar_imagem(b64: str) -> tuple[bytes, str]` (bytes, mime)
- `montar_prompt(texto: str | None, nomes_catalogo: list[str]) -> str`
- `extrair_itens(db, texto, imagem: tuple[bytes,str] | None) -> tuple[ExtracaoAgente, bool]` (resultado, modelo respondeu). Levanta `AgenteIndisponivel` se o disjuntor estiver aberto ou o Gemini não responder.
- `casar_item(db, user_id, item: ItemExtraido) -> AgentParsedItem`
- Schemas em `app/schemas/agent.py`: `AgentParseRequest`, `AgentParsedItem`, `AgentParseResponse`, `ItemExtraido`.

- [ ] Testes de unidade: `decodificar_imagem` aceita PNG com prefixo `data:`, levanta `ImagemGrande` acima de 4 MB e `ImagemInvalida` para lixo; `extrair_itens` com o Gemini falso devolvendo `{"meal_slot":"almoco","items":[{"name":"Ovo","quantity":2,"unit":"un"},{"name":"Pão francês","quantity":1,"unit":"un"}]}` dá 2 itens; resposta que não é JSON dá 0 itens com `respondeu=True`; item com `quantity: -1` ou `unit: "kg"` é descartado; `casar_item` segue as cinco regras acima.
- [ ] Ver falhar, implementar, ver passar.

### Tarefa G2: rota `POST /agent/parse`

**Arquivos:** criar `backend/app/routers/agent.py`; alterar `app/main.py` (`include_router(agent.router, prefix="/agent", tags=["agent"])`); teste em `backend/tests/test_agent_parse.py`.

- [ ] Testes de rota (Gemini falso via `monkeypatch` em `app.services.agent_parse.call_gemini_parts`, catálogo semeado com `semear_catalogo`):
  - `test_texto_com_dois_itens`: "comi 2 ovos e pão francês" → 200, 2 itens `alta`, `food_ref` `catalog:ovo-un` e `catalog:pao-frances-un`, `meal_slot == "almoco"`, uma linha `diary_food_resolve` em `usage_events`, **nenhuma** linha em `diary_entries`.
  - `test_item_sem_taco_vem_baixa_com_alternativas`: item "Tapioca de frango desfiado" → `confidence == "baixa"`; e item inexistente → `food is None`.
  - `test_cota_esgotada_429`: Starter com 10 usos → `429`, `code == "PLAN_LIMIT_REACHED"`, `upgrade_url == "/assinatura"`, `"Starter" in message`, e o Gemini **não** é chamado.
  - `test_imagem_grande_413`: 4 MB + 1 byte → `413`, `code == "IMAGE_TOO_LARGE"`, sem debitar.
  - `test_sem_texto_nem_imagem_422`, `test_gemini_fora_503_sem_debitar`, `test_meal_slot_da_requisicao_quando_texto_nao_diz`.
- [ ] Ver falhar, implementar, ver passar; suíte inteira verde.
- [ ] Commit `feat(agente): POST /agent/parse lê texto ou foto e casa com a TACO`, rebase, `python -m pytest -q`, `git push origin HEAD:main`.

### Tarefa G3: tela `/agente` (só com a F6 da Fundação na `main`)

**Arquivos:** criar `frontend/src/pages/Agente.tsx`, `Agente.test.tsx`, `frontend/src/lib/agentApi.ts`; alterar `src/types.ts` (tipos do contrato) e a rota `ROUTES.agente` em `src/App.tsx` (se a Fundação deixou um marcador).

**Interfaces:**
- Consome: `NuviSlice`, `useDelayedFlag`, `Button`, `toast`, `ROUTES` (Fundação); `api` (axios atual); `POST /diary` atual.
- `parseAgente(body: AgentParseRequest): Promise<AgentParseResponse>`; `reduzirImagem(file: File, maxLado = 1280): Promise<string>` (data URL JPEG 0.85 via canvas).

- [ ] Testes (Vitest + RTL, `api` mockado):
  - enviar "comi 2 ovos" mostra o cartão "Anotei no almoço" com os itens, Confirmar e Ajustar;
  - Confirmar chama `POST /diary` uma vez por item `alta`/escolhido, com `food_ref`, `quantity`, `unit`, `meal_slot`, `entry_date`, e depois mostra "Registrado";
  - `429` mostra a mensagem do plano com link para `/assinatura` e o texto continua no campo;
  - item `baixa` sem `food` mostra "Buscar" (abre `openRegistrar` com a busca) e não entra no Confirmar;
  - enquanto espera, depois de 300 ms aparece o mascote com a classe `nuvi-wave`.
- [ ] Ajustar = quantidade e unidade editáveis no cartão (unidades de `allowed_units`), e troca entre `alternatives`.
- [ ] Câmera: botão no campo de texto, `<input type="file" accept="image/*" capture="environment">`, imagem reduzida antes de enviar.
- [ ] Verificar no navegador interno, 375 px e 1280 px, claro e escuro.
- [ ] Commit `feat(agente): tela do Agente Nuvi que registra`, rebase, `npx tsc --noEmit -p tsconfig.app.json && npm test && npm run lint`, push.
