# Redesign Nuvi + Fase 1: plano de implementação

> **Para agentes:** sub-skill obrigatória: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam caixas de seleção (`- [ ]`) para acompanhar o andamento.

**Objetivo:** trocar o app para a marca e o visual Nuvi, com navegação pensada primeiro para o celular e PWA, e entregar os recursos da Fase 1. São eles: alimento personalizado, receita e refeição pronta no diário, registro rápido, código de barras, água, lembretes e o Agente que registra.

**Arquitetura:** primeiro vem uma **Fundação**: Tailwind v4, os tokens Nuvi, os componentes da marca, a casca de navegação e as rotas em português. Ela é feita antes de tudo e entra na `main`. Depois, **seis frentes** andam em paralelo, cada uma numa sessão e numa worktree próprias. Cada frente tem arquivos de sua posse e contratos fixados neste plano. As partes de backend das frentes R, B, A e G **não dependem da Fundação** e podem começar já. A parte de frontend de cada frente começa quando a Fundação estiver na `main`.

**Stack:**
- frontend: React 19, Vite (rolldown), TypeScript, react-router 7, Tailwind v4, coss ui (Base UI), lucide-react e Vitest;
- backend: FastAPI, SQLAlchemy, Alembic e pytest.

**Spec:** `docs/superpowers/specs/2026-11-05-redesign-nuvi-fase1-design.md`. As referências visuais estão em `docs/design/13-prototipo-nuvi.html`, `docs/design/12-animacoes.html`, `docs/design/06-fluxo-registro-f1.html` e `docs/marca/kit/`.

## Restrições globais

- **Cores:**
  - laranja `#E8590C`;
  - laranja-texto `#C2410C`;
  - gomo `#FF9A52` (só no símbolo);
  - verde `#3FA34D` e verde-texto `#2F7A33`;
  - creme `#FFF6EC`;
  - tinta `#1C1712`;
  - secundário `#7A6A58`;
  - escuro `#1A120B`;
  - cartão escuro `#261B13`;
  - texto escuro `#F3EFE9`.
- **Botão laranja sempre com texto `#1C1712`.** Texto branco sobre o laranja é proibido.
- **Sem gradiente** em botões, medidores e barras.
- **Uma fonte só:** DM Sans, de 400 a 900. A única exceção é o logotipo, "nuvi" em minúsculas com Nunito 900 e espaçamento −0,04em.
- **Contraste AA (4,5:1)** em todo texto, nos temas claro e escuro.
- **Curvas:**
  - `--ease-out: cubic-bezier(0.23,1,0.32,1)`;
  - `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`;
  - `--ease-drawer: cubic-bezier(0.32,0.72,0,1)`.
- **Durações:** toque 140 ms; aviso de meta 220 ms; aviso 260 ms; folha 320 ms; medidor 450 ms; onda 960 ms (8 gomos com 120 ms entre um e outro).
- **Ferramentas de animação:** só CSS e Web Animations API. Não instalar `motion`, `framer-motion` nem outra biblioteca de animação. Do Cult UI, só componentes sem essas dependências.
- **Movimento reduzido:** com `prefers-reduced-motion: reduce`, nada de escala nem deslocamento; ficam só opacidade e cor.
- **Sem animação:** trocar de aba, digitar na busca, passar de dia no Diário, números de macros e troca de página na Web.
- **Carregamento:** um indicador só aparece se a espera passar de **300 ms**.
- **Código de barras grátis em todos os planos.** Preços e regras de plano não mudam.
- **Rotas antigas redirecionam** com `replace`, preservando a query string.
- **Admin (`/admin/*`):** só troca o nome e o logo.
- **Nome visível:** "Nuvi" (o Agente vira "Agente Nuvi"). Identificadores internos, URLs do Render e variáveis de ambiente não mudam.
- **`food_ref`:** os formatos existentes são `catalog:<slug>` e `cache:<id>`. Esta fase acrescenta `mine:<id>` (alimento pessoal) e `recipe:<id>` (porção de receita). `POST /diary` continua sem chamar LLM nem rede externa (ADR-0001, D-5).

## Regras de trabalho em paralelo (todas as sessões)

1. **Cada frente trabalha na sua worktree e mexe só nos arquivos de sua posse** (ver "Posse" em cada frente). Precisou mexer em arquivo de outra frente? Faça a menor mudança possível e diga isso no commit.
2. **Subir para a `main` a cada tarefa verificada** (o Franco autorizou):
   - `git fetch origin && git rebase origin/main`;
   - rodar os testes da área (`cd backend && python -m pytest -q`, `cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run lint`);
   - `git push origin HEAD:main`.
   - Se o push for recusado, refaça o rebase e os testes. Nunca use `--force`.
3. **Migrações Alembic ficam em linha.** Antes de subir, rode `alembic heads`. Se houver duas cabeças, aponte o `down_revision` da sua migração para a cabeça atual da `main`. `tests/test_migrations.py` precisa passar.
4. **Commit** com o rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
5. **Telas:** comparar com o protótipo no navegador interno, no celular (375 px) e no computador (1280 px), nos temas claro e escuro.

## Foco de revisão

- **Rede lenta ou sem rede no PWA:** a abertura não pode travar na onda para sempre. Depois de 8 s sem dados, a abertura sai e a tela mostra o erro com "Tentar de novo" (Fundação, Tarefa F5).
- **Link antigo com query** (`/dashboard?x=1`, `/meal-plans/12`): o redirecionamento chega à rota nova com o id e a query (Fundação, Tarefa F4).
- **Cota do Agente esgotada no Starter:** mostra a mensagem do plano com o link para `/assinatura`, sem erro genérico e sem apagar o texto digitado (Frente G).
- **Código de barras sem câmera ou com permissão negada:** cai num campo para digitar o código (Frente B).
- **Duas abas fazendo "Repetir dia" ao mesmo tempo:** não pode duplicar as entradas (Frente R, teste de idempotência).

---

## Fundação (uma sessão; frontend; começa agora)

**Posse:** `frontend/package.json`, `postcss.config.js`, `tailwind.config.js` (removido), `src/index.css`, `src/App.css`, `src/App.tsx`, `src/routes.ts`, `src/layouts/AppLayout.tsx`, `src/components/Sidebar.tsx`, `src/lib/navItems.ts`, `src/components/brand/*`, `src/components/shell/*`, `src/components/ui/*`, `src/lib/useDelayedFlag.ts`, `frontend/index.html`, `frontend/public/*`, `vite.config.ts`.

### Tarefa F1: Tailwind v4 e tokens Nuvi

**Arquivos:**
- Alterar: `frontend/package.json`, `frontend/postcss.config.js` (ou `@tailwindcss/vite` no `vite.config.ts`) e `frontend/src/index.css`.
- Remover: `frontend/tailwind.config.js`.

**Interfaces:**
- Produz, no `@theme` de `src/index.css`:
  - cores `--color-nuvi-laranja`, `--color-nuvi-laranja-texto`, `--color-nuvi-gomo`, `--color-nuvi-verde`, `--color-nuvi-verde-texto`, `--color-nuvi-creme`, `--color-nuvi-tinta`, `--color-nuvi-secundario`, `--color-nuvi-escuro`, `--color-nuvi-cartao-escuro` e `--color-nuvi-texto-escuro`;
  - aliases semânticos `bg`, `card`, `ink`, `mut`, `line`, `soft`, `act`, `on-act`, `act-text`, `pos` e `pos-text`, que trocam de valor com `.dark`;
  - `--font-sans: "DM Sans"`, `--ease-out`, `--ease-in-out` e `--ease-drawer`.
- Modo escuro por classe `.dark` no `<html>`.

- [ ] Rodar `npx @tailwindcss/upgrade` e revisar o diff à mão. As classes `zinc`, `green` etc. das telas antigas podem continuar existindo; a Frente T troca uma por uma.
- [ ] Declarar os tokens. As fontes DM Sans (400 a 900) e Nunito 900 vêm do Google Fonts no `index.html`.
- [ ] Verificar: `npm run build`, `npm test` e `npm run lint` passam, e o `/dashboard` atual abre sem quebrar o layout (navegador interno).
- [ ] Commit `build(frontend): Tailwind v4 e tokens Nuvi` e subir para a `main`.

### Tarefa F2: kit da marca, PWA e nome visível

**Arquivos:**
- Copiar: `docs/marca/kit/png/*`, `docs/marca/kit/svg/favicon.svg` e os logos para `frontend/public/`.
- Remover: `frontend/public/nutri-agent-*`.
- Criar: `frontend/public/manifest.webmanifest`.
- Alterar: `frontend/index.html`.
- Backend: textos visíveis em `backend/app/main.py`, `core/config.py`, `services/email.py`, `services/email_templates.py` e `services/mercado_pago.py`.
- Teste: `backend/tests/test_email_templates.py`.

- [ ] Teste: `test_templates_usam_nome_nuvi` verifica que todo template renderizado contém "Nuvi" e não contém "NutriAgent".
- [ ] Rodar e ver falhar. Depois trocar os textos e ver passar.
- [ ] Manifesto conforme o README do kit, com uma mudança: `"background_color": "#E8590C"` (spec §9). Também `"start_url": "/hoje"` e `"display": "standalone"`.
- [ ] `<head>` conforme o README do kit. O `apple-touch-startup-image` pode ficar para depois; se ficar, anote no commit.
- [ ] Verificar: `grep -rn "NutriAgent" frontend/src frontend/index.html` não acha nenhum texto visível.
- [ ] Commit e subir.

### Tarefa F3: componentes da marca e de movimento

**Arquivos:**
- Criar: `src/components/brand/NuviSlice.tsx`, `NuviLogo.tsx`, `NuviLoader.tsx`, `src/lib/useDelayedFlag.ts` e `src/components/brand/brand.css` (importado em `index.css`).
- Testes: `src/components/brand/NuviSlice.test.tsx` e `src/lib/useDelayedFlag.test.ts`.

**Interfaces (produz):**
- `NuviSlice(props: { size?: number; tone?: 'light' | 'dark' | 'onOrange'; wave?: boolean | 'once'; face?: false | 'normal' | 'happy'; title?: string; className?: string }): JSX.Element`
  - SVG `viewBox="0 0 100 100"`;
  - casca `r=41`, parte branca `r=35`;
  - oito gomos `wedge(50,50,6,31,a+5,a+40)` com `a = i*45-90`, cada um com `className="nuvi-gomo"` e `style={{'--i': i}}`.
  - Sem `title`, o SVG fica com `aria-hidden`.
- `NuviLogo(props: { size?: number; tone?: 'light' | 'dark' | 'onOrange'; wave?: boolean | 'once' }): JSX.Element`: o símbolo e "nuvi" em Nunito 900.
- `useDelayedFlag(active: boolean, delayMs = 300): boolean`: só fica `true` depois de `delayMs` com `active` ligado, e volta a `false` na hora em que `active` desliga.
- `NuviLoader(props: { active: boolean; size?: number; label: string }): JSX.Element | null`: a onda; não mostra nada antes de 300 ms.
- CSS em `brand.css`:
  - `.nuvi-gomo { transform-box: view-box; transform-origin: 50px 50px }`;
  - `.nuvi-wave .nuvi-gomo { animation: nuvi-gomo 960ms var(--ease-in-out) infinite; animation-delay: calc(var(--i) * 120ms) }`;
  - keyframe em 40%: `opacity .35; transform: scale(.84)`;
  - variante `.nuvi-wave-once` (uma iteração) e versão de movimento reduzido só com opacidade.

- [ ] Testes:
  - `NuviSlice` renderiza 8 `.nuvi-gomo`;
  - `wave` aplica a classe `nuvi-wave`;
  - `face="happy"` desenha os olhos fechados em arco;
  - com `title`, o SVG tem `role="img"`.
  - `useDelayedFlag` com timers falsos: `false` aos 299 ms, `true` aos 300 ms, e `false` na hora quando `active` vira `false`.
  - `NuviLoader` com `active` dá `null` antes de 300 ms.
- [ ] Ver falhar, implementar e ver passar.
- [ ] Commit e subir.

### Tarefa F4: casca de navegação e rotas em português

**Arquivos:**
- Criar: `src/routes.ts`, `src/components/shell/AppShell.tsx`, `BottomTabBar.tsx`, `SideNav.tsx` e `RegistrarOutlet.tsx`.
- Alterar: `src/App.tsx`, `src/lib/navItems.ts` e `src/layouts/AppLayout.tsx` (passa a usar o `AppShell`).
- Remover: `src/components/Sidebar.tsx`, depois de migrar quem o usa.
- Testes: `src/routes.test.tsx` e `src/lib/navItems.test.ts`.

**Interfaces (produz):**
- `ROUTES`: `{ hoje: '/hoje', diario: '/diario', registrar: '/registrar', codigoDeBarras: '/registrar/codigo-de-barras', alimento: (ref: string) => string, alimentos: '/alimentos', alimentoNovo: '/alimentos/novo', agente: '/agente', progresso: '/progresso', cardapios: '/cardapios', cardapioNovo: '/cardapios/novo', cardapioGerar: '/cardapios/gerar', cardapio: (id: string | number) => string, compras: '/compras', receitas: '/receitas', receitaNova: '/receitas/nova', receita: (id) => string, chef: '/chef', comunidade: '/comunidade', perfil: '/perfil', lembretes: '/perfil/lembretes', assinatura: '/assinatura' } as const`.
- `LEGACY_REDIRECTS: Array<[from: string, to: string]>`:
  - `/dashboard→/hoje`, `/profile→/perfil`, `/recipes→/receitas`, `/recipes/new→/receitas/nova`, `/ai-plan→/cardapios/gerar`, `/ai-chef→/chef`, `/shopping→/compras`, `/meal-plans→/cardapios`, `/meal-plans/new→/cardapios/novo`, `/meal-plans/:id→/cardapios/:id`, `/planos→/assinatura`.
  - Quem já entrou e abre `/` vai para `/hoje`.
- `openRegistrar(navigate, location, opts?: { refeicao?: 'cafe' | 'almoco' | 'lanche' | 'jantar'; data?: string }): void`: abre `/registrar?...` com `state.background = location`. O `RegistrarOutlet` mostra a folha por cima da tela de fundo.
  - **No celular**, a folha sobe de baixo (320 ms, curva de gaveta), e o botão Voltar do sistema fecha a folha.
  - **No computador**, abre um painel à direita.
  - Sem refeição informada, ela é escolhida pelo horário: antes das 10h café, até as 15h almoço, até as 18h lanche, depois jantar.
- `BottomTabBar` aparece abaixo de 768 px, com Hoje · Diário · [+] · Cardápio · Agente. O `+` chama `openRegistrar`.
- `SideNav` aparece a partir de 768 px, com "+ Registrar" no topo e os grupos da spec §6 (o Agente no topo de Acompanhar).
- O conteúdo de `/registrar`, enquanto a Frente R não chega, é um marcador "Registrar".

- [ ] Testes:
  - cada par de `LEGACY_REDIRECTS` chega ao destino, inclusive `/meal-plans/12?x=1` → `/cardapios/12?x=1`;
  - `navItems` tem os 4 grupos na ordem da spec;
  - `openRegistrar` sem refeição às 12h usa `almoco`;
  - o tab bar tem 5 itens e o do meio tem o rótulo acessível "Registrar".
- [ ] Ver falhar, implementar e ver passar.
- [ ] Trocar de aba é instantâneo. Verificar que a troca de rota não tem nenhuma transição.
- [ ] Commit e subir.

### Tarefa F5: abertura do PWA e onda do logo na Web

**Arquivos:**
- Criar: `src/components/brand/Splash.tsx` e `src/components/brand/Splash.test.tsx`.
- Alterar: `src/main.tsx` ou `AppShell.tsx`.

**Interfaces:**
- `Splash(props: { ready: boolean; error?: boolean; onDone: () => void })`.
- Só aparece em modo `standalone` (`matchMedia('(display-mode: standalone)')`) e no primeiro carregamento.
- Na Web comum, o `NuviLogo` do `SideNav` usa `wave="once"` uma vez por sessão (flag em `sessionStorage`, com try/catch).

- [ ] Testes:
  - com `ready` já verdadeiro, a onda não liga;
  - sem `ready` por 300 ms, a onda liga;
  - sem `ready` por 8 s, chama `onDone` e a tela mostra o erro;
  - com movimento reduzido, a saída é só opacidade em 200 ms.
- [ ] Implementar a saída como em `docs/design/12-animacoes.html` (função `playSplash`):
  - os gomos voltam a 1 em 160 ms;
  - a fatia voa até o logo do topo com WAAPI (420 ms, ease-in-out);
  - o fundo some (280 ms, com 140 ms de atraso);
  - o conteúdo entra em cascata (260 ms, intervalo de 40 ms).
- [ ] Verificar no navegador interno, com o painel visível e a velocidade 3× do DevTools.
- [ ] Commit e subir.

### Tarefa F6: componentes base de interface

**Arquivos:** `src/components/ui/` (Button, Sheet, Dialog, Tabs, Input, Toast, Switch e Skeleton), via coss ui, ajustados aos tokens.

**Interfaces (produz):**
- `Button` com variantes `primary` (laranja com texto tinta), `ghost` e `outline`. Ao toque, `scale(.97)` em 140 ms com ease-out.
- `Sheet` sobe de baixo (320 ms, curva de gaveta) e permite arrastar para fechar.
- `toast(message: string, opts?: { action?: { label: string; onClick: () => void } })` sobe de baixo por **transição** (260 ms) e fica 4 s na tela.

- [ ] Testes de componente:
  - `Button` primário tem a classe de texto tinta;
  - `toast` com ação chama `onClick`;
  - `Sheet` fecha com Esc e devolve o foco a quem abriu.
- [ ] Commit e subir. **Com isso a Fundação termina.** Avise na mensagem final que as frentes de frontend podem começar.

---

## Frentes paralelas

Cada frente roda na própria sessão. Primeiro **escreve o próprio plano detalhado** com superpowers:writing-plans, a partir da spec e da sua parte abaixo, e salva em `docs/superpowers/plans/2026-11-05-nuvi-<frente>.md`. Depois executa esse plano. Uma tarefa de frontend só começa com a Fundação na `main` (`git log origin/main` mostra o commit da F6).

### Frente T: telas existentes no visual novo (só frontend; depois da Fundação)

**Posse:** `src/pages/Dashboard.tsx` (vira `Hoje`), `DiaryLog.tsx`, `MealPlans*.tsx`, `AiPlain.tsx`, `Recipes.tsx`, `NewRecipe.tsx`, `AiChef.tsx`, `ShoppingList.tsx`, `Profile.tsx`, `Plans.tsx`, `Landing.tsx`, `Register.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`, `VerifyEmail.tsx`, `components/LoginForm.tsx`, `components/diary/*` e as páginas novas `Comunidade.tsx` e `Progresso.tsx`.

**Entrega:** cada tela igual à do protótipo, nos temas claro e escuro.
- O **Hoje** tem a marca no topo, o avatar com o menu da conta (Perfil e metas, Progresso, Meus alimentos, Lembretes, Assinatura) e o medidor de meia-lua.
  - O arco do medidor usa `stroke-dashoffset`, 450 ms, ease-in-out.
  - O número conta junto e tem o rótulo "kcal que ainda cabem" alinhado à base do arco.
  - Os números de macros trocam sem animação.
- Na **aba Cardápio**, os atalhos ficam no topo.
- A **Comunidade** sai de dentro de Receitas.
- O **Progresso** mostra só o peso, com o `WeightHistory` que já existe.
- A **comemoração de meta** do Agente (giro de 45° com passo a 52°, em 640 ms, e o sorriso) fica no cartão do Agente do Hoje, uma vez por meta por dia.
- **Assinatura, Landing e login:** só o visual e o nome.
- **Puxar para atualizar** no Hoje e no Diário:
  - cada pedaço do puxão acende um gomo, só por opacidade, e o arrasto segue o dedo com metade da distância;
  - com os oito gomos acesos, soltar atualiza, e a onda roda até terminar;
  - soltar antes volta em 320 ms ease-out.
  - Fica em `src/components/PullToRefresh.tsx`, de posse desta frente.
- **Fotos das refeições:** imagem fixa por tipo de refeição, em `src/assets/refeicoes/`; receita sem foto usa a mesma imagem.

**Pontos de encaixe:** o Hoje expõe dois espaços que as frentes A e R preenchem depois do rebase: `<HojeSlots.Agua/>` (frente A) e `<HojeSlots.Repetir/>` (frente R). Enquanto as frentes não chegam, os espaços ficam vazios.

**Pronto quando:** as telas batem com o protótipo, os testes atuais de Dashboard, DiaryLog e Profile passam (ajustados ao texto novo) e não sobra classe `zinc-*` nem `green-*` nas páginas da posse.

### Frente R: registro (backend agora; frontend depois da Fundação)

**Posse:**
- Backend: modelos e rotas novas em `app/models/user_food.py`, `app/models/saved_meal.py`, `app/routers/diary_foods.py` e `app/routers/diary.py`, mais as migrações.
- Frontend: `src/pages/registrar/*`, `src/pages/alimentos/*` e `src/lib/useFoodSearch.ts`.

**Entrega:**
- **Alimento pessoal.** Tabela `user_foods` com `id`, `user_id`, `name`, `portion_label`, `portion_grams` (pode ser nulo), `kcal`, `protein_g`, `carbs_g`, `fat_g`, `barcode` (pode ser nulo; único por usuário) e `created_at`. O CRUD fica em `/diary/foods/mine`. O `food_ref` é `mine:<id>`, sempre restrito ao dono.
- **Receita no diário.** `food_ref` `recipe:<id>`, com a unidade "porção" e os valores por porção calculados da receita.
- **Recentes e frequentes:**
  - `GET /diary/foods/recent?limit=20`: itens distintos por `food_ref`, os mais recentes primeiro;
  - `GET /diary/foods/frequent?limit=20`: os mais registrados nos últimos 30 dias.
- **Copiar e repetir:**
  - `POST /diary/copy` com `{ from_date, to_date, meal_slot? }`;
  - "Repetir dia" é o `copy` sem `meal_slot`;
  - **é idempotente**: as mesmas entradas de origem não se duplicam no destino.
- **Refeição pronta:** `saved_meals` e os itens dela.
  - `POST /diary/saved-meals` cria a partir de uma refeição do dia.
  - `POST /diary/saved-meals/{id}/log` registra a refeição inteira.
- **Frontend:**
  - a folha Registrar tem as abas Buscar · Recentes · Frequentes · Meus · Receitas, o carrinho de vários itens e o botão "Salvar" com aviso de desfazer;
  - na folha de porção, o botão de código de barras leva a `ROUTES.codigoDeBarras`;
  - arrastar uma entrada para apagar mostra o aviso "Desfazer";
  - menus de refeição e de dia com as opções da spec §7;
  - o cartão "Repetir café de ontem" vai no `HojeSlots.Repetir`.

**Contrato para as frentes B e G:** `POST /diary/foods/mine` aceita `barcode`, e `GET /diary/foods/mine?barcode=…` busca por código. A frente B usa os dois.

**Pronto quando:** existem testes de isolamento por usuário para `mine:` e `recipe:` (no padrão de `test_diary_isolation.py`), o teste de idempotência do `copy` passa, e o fluxo do protótipo funciona de ponta a ponta no navegador interno.

### Frente B: código de barras (backend agora; frontend depois da Fundação e do contrato `mine` da frente R)

**Posse:** `app/services/openfoodfacts.py`, a rota `GET /diary/foods/barcode/{code}` em `app/routers/diary_foods.py` (só essa função) e `src/pages/registrar/CodigoDeBarras.tsx`.

**Entrega:**
- A busca procura primeiro no `mine` do usuário (`barcode`). Depois no `food_cache` com origem `openfoodfacts`, isolado por usuário. Por último no Open Food Facts, com tempo limite de 5 s.
- A resposta é `FoodOption` (com `food_ref` `cache:<id>` ou `mine:<id>`) ou `404`.
- **Não conta cota e funciona em todos os planos.**
- **Frontend:**
  - a câmera usa a biblioteca escolhida pela frente;
  - com permissão negada ou sem câmera, aparece um campo para digitar o código;
  - achando o produto, abre a folha de porção;
  - sem achar, oferece "Cadastrar como meu alimento", que leva a `/alimentos/novo?barcode=…`.

**Pronto quando:** existem testes com o Open Food Facts falso cobrindo encontrado, não encontrado e tempo esgotado, o teste de isolamento entre usuários passa, e o fluxo funciona no navegador interno com a entrada digitada.

### Frente A: água e lembretes (backend agora; frontend depois da Fundação)

**Posse:**
- `app/models/water.py`, `app/models/reminder.py`, `app/models/push_subscription.py` e `app/routers/water.py`, `reminders.py` e `push.py`;
- `.github/workflows/lembretes.yml`;
- `frontend/src/sw.ts` (ou o service worker escolhido), `src/pages/perfil/Lembretes.tsx` e `src/components/agua/*`.

**Entrega:**
- **Água:**
  - meta = peso × 35 ml, arredondada para 50 ml; sem peso, 2.000 ml;
  - `POST /water { date, ml }` e `GET /water?date=`;
  - `WaterCard` com "+250 ml" vai no `HojeSlots.Agua`, e a folha permite escolher outra quantidade.
- **Lembretes:**
  - tipos café, almoço, lanche, jantar, água e peso, cada um com horário e o fuso do usuário (padrão `America/Sao_Paulo`);
  - inscrição de push Web com chaves VAPID nas variáveis `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`;
  - `POST /internal/reminders/dispatch` é protegido pelo cabeçalho `X-Cron-Secret`, com o valor de `CRON_SECRET`. Ele envia os lembretes cujo horário caiu nos últimos 5 minutos e ainda não foram enviados no dia;
  - `.github/workflows/lembretes.yml` chama esse endpoint a cada 5 minutos (`*/5 * * * *`), com o segredo `CRON_SECRET` do repositório.
- **O Franco cadastra as variáveis no Render e o segredo no GitHub.** A frente deixa a lista exata no `.env.example` e na mensagem final.

**Pronto quando:** os testes do `dispatch` passam, cobrindo:
- janela de 5 minutos;
- nada enviado duas vezes no dia;
- fuso;
- `401` sem o segredo;
- inscrição inválida removida quando o push responde `410`.

O teste da meta de água também passa. No navegador interno, a inscrição e o cartão de água funcionam.

### Frente G: Agente que registra (backend agora; frontend depois da Fundação)

**Posse:** `app/routers/agent.py`, `app/services/agent_parse.py` e `src/pages/Agente.tsx`.

**Entrega:**
- `POST /agent/parse` recebe `{ text?: string; image_base64?: string; date: string; meal_slot?: MealSlot }`.
  - O Gemini separa os itens.
  - Cada item é casado com a TACO pelo caminho do `resolve`.
  - A resposta é `{ meal_slot, items: Array<{ food: FoodOption; quantity: number; unit: DiaryUnitType; confidence: 'alta' | 'baixa' }> }`.
- Conta na cota `diary_food_resolve` existente.
- **Não grava nada.** O frontend confirma e grava com `POST /diary`, item por item, ou com o endpoint em lote da frente R, se existir.
- **Tela:** chat igual ao do protótipo. A resposta vem como um cartão "Anotei no almoço", com Confirmar e Ajustar. Enquanto espera, o mascote fica com `NuviSlice face="normal" wave`. A câmera fica no campo de texto.
- **Cota esgotada:** a mensagem do plano com o link para `/assinatura`, sem perder o texto digitado.

**Pronto quando:** existem testes com o Gemini falso cobrindo:
- texto com 2 itens;
- item sem correspondência na TACO (vem como `baixa` e com a opção de buscar);
- cota esgotada (`429`, com a mensagem do plano);
- imagem grande demais (`413`).

E o fluxo funciona no navegador interno.

---

## Ordem e dependências

```
agora:            Fundação (F1–F6)   R-backend   B-backend   A-backend   G-backend
após F6 na main:  T   R-frontend   A-frontend   G-frontend
após R "mine":    B-frontend
```

O Franco cadastra `VAPID_*` e `CRON_SECRET` no Render e o `CRON_SECRET` nos segredos do GitHub quando a frente A pedir.
