# Frente T: telas existentes no visual Nuvi (plano)

> **Para agentes:** sub-skill obrigatória: superpowers:executing-plans. Antes de começar, leia `docs/superpowers/plans/2026-11-05-nuvi-continuacao.md`, que traz as regras e o rodapé do commit. **Só comece com o commit da F6 da Fundação em `git log origin/main`.**

**Objetivo:** cada tela que já existe passa a ser igual à do protótipo `docs/design/13-prototipo-nuvi.html`, nos temas claro e escuro, sem perder nenhum dado nem nenhuma ação que a tela faz hoje.

**Abordagem:** a lógica fica, a apresentação muda.
- Manter as chamadas de API, os hooks (`useDiaryDay`, `useFoodSearch`, os contextos) e os estados de carregando, erro e vazio.
- Trocar a marcação e as classes pelos tokens Nuvi (`bg`, `card`, `ink`, `mut`, `act`, `on-act`, `act-text`, `pos`, `pos-text`) e pelos componentes da Fundação.
  - Do `src/components/ui/*`: `Button`, `Sheet`, `Tabs`, `Input`, `toast`, `Switch` e `Skeleton`.
  - Do `src/components/brand/*`: `NuviSlice`, `NuviLogo` e `NuviLoader`.
- Navegação pelo `ROUTES` de `src/routes.ts`.

## Como ler o protótipo

Abra o HTML no navegador interno. Cada tela é uma função JavaScript no arquivo, e o HTML que ela devolve é a referência de estrutura, espaçamento, rótulos e textos.

| Tela do app (arquivo) | Rota | Função no protótipo |
|---|---|---|
| `pages/Dashboard.tsx` → renomear para `pages/Hoje.tsx` | `/hoje` | `hoje()` e `openMenu()` (menu do avatar) |
| `pages/DiaryLog.tsx` | `/diario` | `diario()`, `openMealMenu()` e `openDayMenu()`, só a parte visual; as ações de copiar e repetir são da Frente R |
| `pages/MealPlans.tsx` e a aba Cardápio | `/cardapios` | `cardapio()` e `pgPlans()` |
| `pages/MealPlanBuilder.tsx` | `/cardapios/novo` | `pgPlans()`, botão de criar |
| `pages/MealPlanDetail.tsx` | `/cardapios/:id` | `cardapio()`, lista do dia |
| `pages/AiPlain.tsx` | `/cardapios/gerar` | `pgGen()` e `genRun()` (carregando com `NuviLoader`) |
| `pages/ShoppingList.tsx` | `/compras` | `pgShop()` |
| `pages/Recipes.tsx` | `/receitas` | `pgRecipes()` |
| detalhe de receita (hoje dentro de `Recipes.tsx`) | `/receitas/:id` | `pgRecipe(id)` |
| `pages/NewRecipe.tsx` | `/receitas/nova` | `pgNewRecipe()` |
| `pages/AiChef.tsx` | `/chef` | `pgChef()` |
| nova `pages/Comunidade.tsx` (sai de Receitas) | `/comunidade` | `pgCommunity()` |
| `pages/Profile.tsx` | `/perfil` | `pgProfile()` |
| nova `pages/Progresso.tsx` (só peso, `WeightHistory`) | `/progresso` | `pgProgress()` |
| `pages/Plans.tsx` | `/assinatura` | `pgPlansSub()`, **com os preços e planos atuais** (sem plano anual, sem "Coach") |
| `pages/Landing.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `VerifyEmail.tsx`, `components/LoginForm.tsx` | `/`, `/register`… | sem tela no protótipo: usar o visual do Hoje (creme, cartões brancos, `NuviLogo`, botão laranja com texto escuro); a Landing usa o símbolo creme sobre laranja como no `og-image` do kit |

## Divisão em duas sessões (posse disjunta)

- **T-a:** Hoje, Diário, Cardápios (as quatro telas), Compras e Progresso. Também `components/diary/*`, `components/PullToRefresh.tsx` e `src/assets/refeicoes/`.
- **T-b:** Receitas (lista, detalhe e nova), Chef, Comunidade, Perfil, Assinatura, Landing, login e cadastro, recuperação de senha e verificação de e-mail.

## Regras desta frente

- **Hoje:**
  - topo com `NuviLogo` à esquerda, sino de lembretes (`ROUTES.lembretes`) e avatar, que abre um `Sheet` com Perfil e metas, Progresso, Meus alimentos (`ROUTES.alimentos`), Lembretes e Assinatura;
  - depois a saudação ("Bom dia/Boa tarde/Boa noite, <nome>.", com o nome em `act-text`) e a faixa de dias;
  - **medidor de meia-lua:** SVG `viewBox 0 0 200 104`, arco `M22 96 A78 78 0 0 1 178 96`, traço de 16 com pontas redondas, trilho em `soft` e arco em `act`, `pathLength=100`;
    - o arco anda em 450 ms com `--ease-in-out` (transição de `stroke-dashoffset`);
    - o número no centro (y=78, 32 px, peso 900) conta junto por `requestAnimationFrame` nos mesmos 450 ms;
    - "kcal que ainda cabem" em y=99, 9,5 px, cor `mut`;
    - sem ícone de fogo;
    - com movimento reduzido, a mudança é instantânea;
  - os números de macros trocam sem animação;
  - dois espaços vazios exportados: `HojeSlots.Agua` e `HojeSlots.Repetir` (componentes que retornam `null`), que as frentes A e R preenchem depois.
- **Comemoração de meta**, no cartão do Agente do Hoje:
  - quando proteína ou kcal atinge a meta pela primeira vez no dia (flag em `localStorage` por data, com try/catch), os gomos do `NuviSlice` giram com a WAAPI de 0 a 52° e voltam a 45°, em 640 ms, `--ease-out`;
  - `face="happy"` por 900 ms;
  - o aviso "Meta de … batida" sobe 6 px e aparece em 220 ms;
  - com movimento reduzido, não há giro.
- **Puxar para atualizar** (`components/PullToRefresh.tsx`, no Hoje e no Diário), conforme `docs/design/12-animacoes.html`, seção 4:
  - o arrasto segue o dedo com metade da distância, até 112 px;
  - a cada 12 px acende um gomo, só por opacidade;
  - com 96 px ou mais, soltar chama `onRefresh()` e mostra a onda até a promise resolver;
  - soltar antes volta em 320 ms ease-out.
- **Fotos:** imagem fixa por refeição em `src/assets/refeicoes/{cafe,almoco,lanche,jantar}.jpg`. Use fotos livres (Unsplash ou Pexels, com licença que permita uso comercial) com no máximo 80 KB cada, em WebP ou JPG. Receita sem foto usa a imagem da refeição.
- **Textos:** sempre em português com acentos. O nome do produto é "Nuvi", e o Agente é "Agente Nuvi".
- **Classes antigas:** ao terminar uma tela, ela não pode ter mais nenhuma classe `zinc-*`, `green-*`, `purple-*`, `teal-*`, `pink-*`, `amber-*` nem `blue-*`. Para conferir: `grep -nE "(zinc|green|purple|teal|pink|amber|blue)-[0-9]" src/pages/<arquivo>` não deve achar nada.

## Tarefas (uma por tela ou grupo; cada uma termina com commit e push)

Para cada linha da tabela da sua sessão:

- [ ] **Teste:** ajuste os testes que já existem (`Dashboard.test.tsx` → `Hoje.test.tsx`, `DiaryLog.*.test.tsx`, `Profile.test.tsx`, `Register.test.tsx`, `LoginForm.test.tsx`) aos textos novos, sem tirar nenhuma asserção de comportamento. Para tela nova, escreva um teste que confere o título e a ação principal (por exemplo, `Progresso` mostra o peso atual e o botão "Registrar peso").
- [ ] **Reescrever a apresentação** seguindo a função do protótipo e as regras acima.
- [ ] **Verificar:**
  - `npx tsc --noEmit -p tsconfig.app.json && npm test && npm run lint`;
  - o `grep` das classes antigas não acha nada;
  - no navegador interno, a 375 px e a 1280 px, nos temas claro e escuro, a tela bate com o protótipo;
  - o console não mostra erros.
- [ ] **Commit** `feat(telas): <tela> no visual Nuvi`, depois rebase e push na `main`.

**Ordem sugerida:**
- T-a: Hoje, Diário, Cardápios, Gerar, Compras, Progresso.
- T-b: Assinatura, Perfil, Receitas, Nova receita, Chef, Comunidade, Landing e login.

## Pronto quando

Todas as telas da sessão batem com o protótipo nos dois temas, os testes, o lint e o `tsc` passam, e nenhuma classe de cor antiga sobra nos arquivos da posse.
