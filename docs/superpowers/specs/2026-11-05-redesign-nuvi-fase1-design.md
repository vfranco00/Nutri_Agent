# Redesign Nuvi + Fase 1: documento de design

Data: 05/11/2026 · Autor da decisão: Franco · Situação: revisado por um construtor; perguntas respondidas pelo Franco em 05/11/2026

## 1. Intenção e porquê

O NutriAgent vai ser vendido. Para alguém trocar o MyFitnessPal por ele, o app precisa de duas coisas ao mesmo tempo:

1. **Parecer um produto**, não um projeto. Isso inclui uma marca própria (**Nuvi**), um visual único e coerente, e uso pensado primeiro para o celular, como app instalado (PWA).
2. **Ter o básico que todo concorrente tem** e que hoje falta. Esta é a **Fase 1** da pesquisa de concorrentes (`docs/produto/pesquisa-concorrentes-2026-11.md`):
   - alimento personalizado e receita própria no diário;
   - código de barras;
   - registro rápido;
   - água e lembretes.

O Franco pediu o design completo antes de qualquer código. Este documento junta o que ele aprovou ao longo do brainstorming, para que alguém consiga planejar a implementação sem ter que perguntar a ele.

## 2. Objetivos, não objetivos e antiobjetivos

**Objetivos**
- Trocar a marca do app inteiro para **Nuvi**: nome, ícone, cores, logo, abertura, mascote do Agente e textos.
- Aplicar a direção visual aprovada (Tempero com as cores Nuvi) em todas as telas do usuário: Hoje, Diário, Registrar, Cardápio, Receitas, Chef, Compras, Comunidade, Agente, Conta, Assinatura e Progresso.
- Mudar a navegação para celular primeiro: barra inferior com o botão central de registrar, menu lateral agrupado no computador e rotas em português.
- Entregar os recursos da Fase 1.
- PWA instalável, com os ícones e a abertura da marca.
- Animações conforme a seção 8.

**Não objetivos (ficam para depois)**
- Fase 2 em diante: bot de WhatsApp, micronutrientes, meta adaptativa, relatórios, GLP-1, jejum e integrações.
- Painel de administração (`/admin/*`): fica como está, só troca o nome e o logo.
- App nativo.

**Antiobjetivos (o redesign seria um fracasso se...)**
- Botões com texto branco sobre laranja, ou qualquer gradiente em botões e medidores.
- Mais de uma fonte no app (fora o logotipo).
- Movimento que deixa lento o que se faz várias vezes ao dia (trocar de aba, buscar, passar de dia).
- Cobrar pelo código de barras. Ele é grátis em todos os planos.
- Links antigos quebrados. Toda rota antiga redireciona para a nova.

## 3. Restrições

- **Stack atual**:
  - frontend em React 19, Vite (rolldown), TypeScript, react-router 7 e lucide-react;
  - backend em FastAPI, SQLAlchemy, Alembic e Postgres (Supabase);
  - deploy na Vercel (frontend) e no Render (backend).
- O diário segue o **ADR-0001**: `food_ref`, `food_cache` separado por origem (`taco`, `curated`, `openfoodfacts`, `llm`) e `diary_plan_bindings`. O código de barras usa a origem `openfoodfacts`, já prevista e isolada por usuário.
- Os limites de plano ficam em `plan_limits.py`: Starter, Plus (R$ 29,90) e Pro (R$ 59,90).
- **Contraste AA (4,5:1) em todo texto.**
- **Movimento reduzido** (`prefers-reduced-motion`) é respeitado em todas as animações.
- O repositório é pessoal. Commit e push só com o pedido do Franco.

## 4. Marca (decidida)

A fonte da verdade é o kit em `docs/marca/kit/` (`README.md`, `cores.css`, `cores.json`, `svg/` e `png/`). A marca aplicada está em `docs/marca/nuvi-fatia.html`.

- **Nome:** Nuvi, sempre "nuvi" em minúsculas no logotipo (Nunito Black 900, espaçamento −0,04em).
- **Símbolo:** fatia de laranja com casca `#E8590C`, parte branca e oito gomos `#FF9A52` separados e iguais.
- **Mascote do Agente:** a própria fatia com olhos e sorriso no miolo. Substitui o 🥑 e o nome "Agente Nutri", que passa a ser **Agente Nuvi**.
- **Cores:**

| Token | Hex | Uso |
|---|---|---|
| laranja | `#E8590C` | ações, medidor, marca |
| laranja-texto | `#C2410C` | palavra em destaque sobre fundo claro |
| gomo | `#FF9A52` | só no desenho do símbolo |
| verde / verde-texto | `#3FA34D` / `#2F7A33` | positivo: meta batida, "no plano" |
| creme | `#FFF6EC` | fundo claro |
| branco | `#FFFFFF` | cartões no claro |
| tinta | `#1C1712` | texto principal **e texto do botão laranja** |
| secundário | `#7A6A58` | texto secundário |
| escuro | `#1A120B` | fundo do tema escuro |
| texto-escuro | `#F3EFE9` | texto no tema escuro |

- **Pendências jurídicas (do Franco, não bloqueiam o código):** consultar o INPI (classes 9 e 42) e os domínios `nuvi.app` e `nuvi.com.br`.

## 5. Direção visual (decidida)

A referência viva é o protótipo `docs/design/13-prototipo-nuvi.html`. Ele é clicável e tem tema claro e escuro.

- **Uma fonte só: DM Sans**, de 400 a 900. Títulos em 800, com a palavra de destaque em laranja-texto. Números grandes em 900. O logotipo é a única exceção (Nunito 900).
- **Claro:** fundo creme, cartões brancos com cantos grandes (20–28 px), fotos de comida nos cartões de refeição e de receita.
- **Escuro:** fundo `#1A120B` com cartões `#261B13`.
- **Cor sólida** em botões, medidores e barras. Nada de gradiente.
- **Botão de ação:** laranja com texto tinta.
- **Medidor de meia-lua** no Hoje: o número de kcal que ainda cabem fica no centro, e o rótulo "kcal que ainda cabem" fica alinhado à base do arco. Não há ícone de fogo.
- **Ícones:** Lucide, os mesmos de hoje.
- **Componentes:** coss ui e Cult UI. Os dois pedem o **Tailwind v4**, e o projeto está no v3, então a **migração para o v4 entra neste trabalho**.

## 6. Navegação e rotas (decidida)

**Celular (até 767 px):** barra inferior com **Hoje · Diário · [+] · Cardápio · Agente**.
- O **+** abre a folha de Registrar, com a refeição pré-escolhida pelo horário.
- Perfil, progresso, meus alimentos, lembretes e assinatura ficam no **avatar**, no topo do Hoje.
- Os atalhos do Cardápio (Compras, Gerar novo, Chef, Receitas, Comunidade, Meus cardápios) ficam no topo da aba Cardápio.

**Computador:** menu lateral em quatro grupos, com **"+ Registrar" fixo no topo**:
- **Acompanhar:** Hoje, Diário, Progresso.
- **Planejar:** Cardápios, Gerar cardápio, Lista de compras.
- **Cozinhar:** Minhas receitas, Meus alimentos, Chef, Comunidade.
- **Conta:** Perfil e metas, Lembretes, Assinatura.

O Agente aparece como item próprio no topo do grupo Acompanhar.

**Rotas:** as antigas redirecionam com `replace`, sem quebrar links salvos.

| Nova | Tela | Antes |
|---|---|---|
| `/hoje` | resumo do dia, água, atalhos | `/dashboard` |
| `/diario?data=AAAA-MM-DD` | dia por refeição | mantém |
| `/registrar?refeicao=…&data=…` | Registrar: Buscar · Recentes · Frequentes · Meus · Receitas | nova |
| `/registrar/codigo-de-barras` | câmera | nova |
| `/registrar/alimento/:ref` | porção e confirmar | nova |
| `/alimentos`, `/alimentos/novo`, `/alimentos/:id` | meus alimentos | nova |
| `/agente` | chat que registra | nova (tela) |
| `/progresso` | peso (só peso na Fase 1) | nova |
| `/cardapios`, `/cardapios/novo`, `/cardapios/gerar`, `/cardapios/:id` | cardápios | `/meal-plans*`, `/ai-plan` |
| `/compras` | lista de compras | `/shopping` |
| `/receitas`, `/receitas/nova`, `/receitas/:id` | receitas | `/recipes*` |
| `/chef`, `/comunidade` | Chef IA, receitas públicas | `/ai-chef`; a comunidade sai de Receitas |
| `/perfil`, `/perfil/lembretes` | perfil e metas, lembretes | `/profile` |
| `/assinatura` | planos | `/planos` |

`/registrar*` abre como folha sobre a tela atual no celular e como painel no computador. A URL existe para poder linkar e para o botão Voltar fechar a folha.

## 7. Fase 1: recursos

Todos estão desenhados no protótipo (`docs/design/06-fluxo-registro-f1.html` e `docs/design/13-prototipo-nuvi.html`).

1. **Alimento personalizado:** o usuário cria um alimento com nome, porção, kcal e macros, edita e usa no diário. Na lista aparece com o selo "meu".
2. **Receita no diário:** registrar "N porções da minha receita X". Os valores por porção vêm da receita.
3. **Código de barras:** câmera no navegador, consulta ao Open Food Facts e, achando o produto, a folha de porção. Se não achar, o usuário pode cadastrar como alimento personalizado. O produto lido fica salvo em `food_cache` com a origem `openfoodfacts` e isolado por usuário. **Grátis em todos os planos.**
4. **Registro rápido:**
   - abas Recentes e Frequentes no Registrar;
   - no menu de cada refeição: "Copiar para amanhã" e "Copiar de outro dia";
   - no menu do dia: "Copiar este dia para amanhã" e "Repetir dia".
   - Vários itens podem ir para o carrinho e ser salvos de uma vez.
5. **Água:** meta calculada pelo peso, botão "+250 ml" no Hoje e uma folha para escolher outra quantidade.
6. **Lembretes:** liga e desliga lembretes de refeições, água e peso. A notificação é push no PWA instalado.
   - **Disparo (decisão do Franco):** um cron grátis externo (GitHub Actions ou cron-job.org) chama um endpoint protegido do backend a cada 5 minutos, e o backend envia os pushes da janela. Aceita até 5 minutos de atraso, e a chamada também acorda o Render.
   - Os horários são por usuário, no fuso dele (padrão `America/Sao_Paulo`). As chaves VAPID ficam em variáveis de ambiente.
7. **Agente que registra (decisão do Franco: entra na Fase 1):** na aba `/agente`, o usuário escreve ("comi 2 ovos e pão francês") ou manda uma foto.
   - O Gemini separa os itens, e cada um é casado com a TACO, com porção sugerida.
   - O usuário confirma ou ajusta, e só então os itens entram no diário.
   - Usa a cota `diary_food_resolve` que já existe em `plan_limits.py`.
8. **O protótipo é a especificação (decisão do Franco):** tudo o que está clicável em `docs/design/13-prototipo-nuvi.html` entra na Fase 1, inclusive:
   - salvar uma refeição pronta (aparece em Meus);
   - arrastar para apagar, com desfazer;
   - ligar um código de barras a um alimento pessoal;
   - o cartão "Repetir café de ontem".

## 8. Animações (aprovadas)

A referência é `docs/design/12-animacoes.html`. Tudo sai da **onda dos oito gomos**: um gomo depois do outro, a 120 ms de distância, com ciclo de 960 ms. A opacidade vai de 1 a 0,35 e a escala de 1 a 0,84, encolhendo para o centro.

| Onde | Como |
|---|---|
| **Abertura do PWA** | o app desenha a mesma imagem da abertura do sistema (fatia creme sobre laranja). A onda só roda se a espera passar de 300 ms. Com os dados prontos, a fatia voa até o logo do topo (420 ms, ease-in-out), o fundo some (280 ms) e o conteúdo entra em cascata (260 ms, 40 ms de intervalo). |
| **Abertura na Web** | sem tela de abertura. O logo faz uma onda uma vez por visita, e o esqueleto vira conteúdo em cascata. |
| **Carregando** | a onda no botão, no Agente pensando e na tela inteira. Só depois de 300 ms. |
| **Puxar para atualizar** | um gomo acende a cada pedaço do puxão; com os oito acesos, soltar atualiza. |
| **Registrar** | o arco do medidor anda até o novo valor e o número conta junto (450 ms). |
| **Meta batida** | a fatia do Agente gira 45° (passa a 52° e volta), sorri, e um aviso aparece. Uma vez por meta por dia. |
| **Botões, folhas, avisos** | o botão afunda (escala 0,97, 140 ms); a folha sobe com a curva de gaveta (320 ms); o aviso sobe por transição (260 ms). |
| **Sem animação** | trocar de aba, digitar na busca, passar de dia, números de macros, troca de página na Web. |

- **Curvas:**
  - `--ease-out: cubic-bezier(0.23,1,0.32,1)`;
  - `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`;
  - `--ease-drawer: cubic-bezier(0.32,0.72,0,1)`.
- **Ferramentas:** só CSS e Web Animations API, sem biblioteca de animação.
- **Movimento reduzido:** sem escala nem deslocamento; ficam só as mudanças de opacidade e cor.

## 9. PWA

- Manifesto e `<head>` como em `docs/marca/kit/README.md`, com nome "Nuvi", os ícones `any` e `maskable`, o `apple-touch-icon` e o `og:image`.
- **`background_color` do manifesto: `#E8590C`** (minha decisão, ver o item 12). Assim a abertura do sistema fica laranja, como a animação aprovada. O kit sugere creme, e isso precisa mudar.
- No iPhone, a abertura usa imagens `apple-touch-startup-image` geradas com a fatia creme sobre laranja.
- Para os lembretes, um service worker com push. O Franco já sabe instalar o PWA e não precisa de tutorial.
- Os arquivos do kit vão para `frontend/public/` e substituem os `nutri-agent-*`.

## 9b. Assinatura, Landing e login

Decisão do Franco: **só mudam o visual e o nome.**
- Preços e regras de plano continuam como hoje.
- O plano anual, os lembretes como recurso exclusivo do Plus e o "Coach (em breve)" que aparecem no protótipo **não** entram.
- A Landing e o login ganham o visual Nuvi.

## 10. Troca do nome no código

"NutriAgent" aparece no frontend e no backend (`main.py`, `config.py`, `email.py`, `email_templates.py`, `mercado_pago.py`). Os **textos que o usuário vê** viram "Nuvi": títulos, e-mails, a descrição da cobrança, a landing e o login. Os **identificadores internos** (pastas, nomes de serviço, URLs do Render, variáveis de ambiente) **não mudam** neste trabalho.

## 11. O que fica com quem constrói

- Divisão em PRs e a ordem entre a migração do Tailwind, a navegação, as telas e os recursos.
- Quais componentes do coss ui e do Cult UI usar em cada peça, desde que sigam o visual da seção 5.
- O modelo de dados do alimento personalizado e dos lembretes, e o contrato das rotas da API, desde que respeitem o ADR-0001.
- A biblioteca de leitura de código de barras no navegador.
- Os testes, seguindo os padrões do repositório.

## 12. Decisões que tomei e o Franco deve conferir

- O manifesto usa `background_color: #E8590C` (laranja), e não o creme que o kit sugere, para combinar com a abertura aprovada.
- Copiei para `docs/design/` o protótipo, as animações e o fluxo de registro, para entrarem no git. O resto dos mockups fica em `.superpowers/`, fora do git.
- O Agente entra no menu do computador como item próprio em Acompanhar.
- **Fotos de comida:** imagem fixa por tipo de refeição (café, almoço, lanche, jantar), guardada no frontend. Receitas sem foto usam a mesma imagem. Foto enviada pelo usuário fica para depois, porque pede armazenamento.
- **Componentes:** a base é o coss ui, feito sobre Base UI e sem biblioteca de animação. Do Cult UI só entram componentes que não dependem de `motion` ou de `framer-motion`. A proibição de biblioteca de animação continua valendo.
- Os identificadores internos não mudam de nome (seção 10).
