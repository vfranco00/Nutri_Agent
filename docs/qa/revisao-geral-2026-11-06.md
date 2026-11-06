# Revisão geral de QA, 2026-11-06 (main @ 07d896a)

## Suítes
- Backend: 611 passaram, 3 puladas (pytest, 130 s, num venv novo com `requirements.txt`).
- `alembic heads`: uma cabeça só (`c3f7e9a1d523`). `alembic upgrade head` roda limpo no Postgres 16.
- Frontend: `tsc --noEmit` limpo; `npm run build` ok (bundle principal 1,15 MB, aviso de chunk grande).
- Testes do frontend: 247 passam, 1 flaky (`AlertContext` "auto-dismisses" falhou uma vez sob carga, passa isolado).
  Com Node 26 (o do Mac) 11 testes falham por `localStorage`; no Node 22 do `.nvmrc` ficam verdes. O `node_modules` local estava sem `@base-ui/react` (`npm ci` resolveu; não é bug do repositório).
- Lint: 30 problemas no projeto, 20 em arquivos alterados desde `25f5f7a` (a maioria `no-explicit-any` antigo; novos: `CommandPalette.tsx` `set-state-in-effect` x2, `AuthShell.tsx` `only-export-components` x2).
- CI na main: último run verde (docs landing); os dois anteriores foram cancelados pela fila (`concurrency`), não falharam.

## Achados
| Gravidade | Tela/fluxo | O que aconteceu | Esperado | Arquivo provável |
|---|---|---|---|---|
| Bloqueia | Primeiro login (usuário sem perfil) | Loop infinito de redirecionamento: `/perfil` vira `/profile?onboarding=1`, que redireciona de volta para `/perfil`. Tela em branco, centenas de requisições, "Maximum update depth exceeded". Todo usuário novo fica preso. | Cair em `/perfil?onboarding=1` e preencher o perfil. | `frontend/src/components/OnboardingGate.tsx` (linhas 110-111 usam `/profile`; rota agora é `ROUTES.perfil`) |
| Importante | Código de barras (`7891000100103`) | Produto achado (200, salvo no cache), navega para `/registrar/alimento/cache:1`, mas nada trata essa rota: abre a folha Registrar vazia, sem porção nem adicionar. | Folha de porção do produto com "Adicionar" (spec: `/registrar/alimento/:ref`). | `frontend/src/pages/registrar/Registrar.tsx` / `RegistrarOutlet.tsx` (falta ler o `:ref` e abrir `PorcaoSheet`) |
| Menor | Idade 16 | Só testado pela API (PUT `/profiles/me` rejeita: "maiores de 18"). A tela não pôde ser exercitada por causa do loop acima. | Erro amigável na tela. | `pages/Profile.tsx` (a verificar após corrigir o loop) |
| Menor | Tour de onboarding (Hoje) | Abre sobre o estado vazio com a primeira etapa "Minhas Receitas", botão verde, fora da paleta Nuvi. | Tour no visual Nuvi. | `components/OnboardingGate.tsx` |
| Menor | Receitas | Receita criada com calorias "Auto" mostra "0 kcal"; selo da categoria "ALMOCO" sem acento; seção "Escolhidas para você" repete a mesma receita. | "—" ou cálculo; "Almoço". | `pages/Recipes.tsx`, `components/recipes/RecipeCard.tsx` |
| Menor | Comunidade | Receita recém-criada já aparece para todos. Confirmar se é intencional frente ao consentimento "Aparecer na comunidade". | Opt-in explícito. | `pages/NewRecipe.tsx` / backend `recipes` |
| Menor | Mobile | Botão de ajuda (bolinha verde) cobre o texto dos cartões "Próximo passo" e o canto dos cartões de Água. | Sem sobreposição. | `FeedbackWidget.tsx` |
| Menor | Desfazer | Cliques repetidos em "Desfazer" geram `DELETE /diary/N` 404 em série (visível no console). | Botão desabilitado após o primeiro clique. | `components/diary/apagarComDesfazer.ts` |
| Menor | Jurídico | `/privacidade` e `/termos` abrem, mas com placeholders `[[CONTROLADOR]]`, `[[CNPJ]]`, `[[ENCARREGADO_*]]`, `[[DATA_DE_PUBLICACAO]]` e aviso de rascunho. | Preencher antes de publicar. | `frontend/src/legal/*.md` |

## O que passou
Cadastro com caixas (backend recusa sem consentimento), verificação de e-mail (link no log; marquei `is_verified` pelo banco), login, Hoje (medidor com "kcal que ainda cabem", água +250, números batem), folha Registrar (buscar "arroz", porção 150 g, carrinho 314 kcal, salvar, desfazer), Diário (datas, arrastar para apagar, copiar refeição para amanhã, menu do dia), Meus alimentos (criar e registrar), Agente (pedido de consentimento de IA e falha amigável com chave falsa), Cardápios, Gerar, Compras (bloqueada no Starter; liberada com assinatura), Receitas (criar e abrir), Chef, Comunidade, Progresso (registrar peso), Privacidade (switch de IA grava consentimento, exportar 200, excluir conta com senha apagou tudo no banco), Lembretes (pedido de push), Assinatura, redirecionos `/dashboard`, `/meal-plans`, `/recipes`, Política e Termos. Console sem erro de CSP; rede só com 4xx esperados (403 consentimento/plano, 503 Gemini falso). CSP do `vercel.json` sem script inline no `dist`.
Visual: botões laranja `#E8590C` com texto `#1C1712`, nenhum gradiente, DM Sans, barra inferior Hoje·Diário·+·Cardápio·Agente a 375 px, menu lateral agrupado a 1280 px, tema claro e escuro ok.

## Não testado
- Câmera do código de barras e foto no Agente: câmera bloqueada no navegador interno.
- Resposta real do Gemini, e-mail real (Brevo), Mercado Pago, push real (VAPID), cron de retenção.
- Validação de idade 16 na tela (impedida pelo loop de onboarding).
- Sem 1280 px em todas as telas: cobri Hoje (claro/escuro), Privacidade e a landing; as demais só a 375 px.
- Toque "Ceia"/"Lanche da manhã" com `+`: a folha só tem 4 refeições (`ceia` na URL abre em Almoço); não confirmei o destino.
- Docker indisponível: usei Postgres 16 do Homebrew na porta 5599.
