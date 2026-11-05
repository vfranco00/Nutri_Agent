# Redesign Nuvi + Fase 1: continuação (passagem para sessões mais baratas)

> Para quem executa: este documento diz **o que falta** e **em que ordem**. O "como" está nos planos detalhados de cada frente, listados abaixo. Leia sempre, nesta ordem:
> 1. este documento;
> 2. o plano-mãe `docs/superpowers/plans/2026-11-05-redesign-nuvi-fase1.md`, pelo menos "Restrições globais" e "Regras de trabalho em paralelo";
> 3. o plano da sua frente.
>
> Execute com superpowers:executing-plans, em TDD.

**Spec:** `docs/superpowers/specs/2026-11-05-redesign-nuvi-fase1-design.md`
**Referências visuais:** `docs/design/13-prototipo-nuvi.html` (é a especificação), `docs/design/12-animacoes.html` e `docs/marca/kit/`.

## Situação em 05/11/2026 (tudo na `main`)

| Frente | Feito | Falta | Plano |
|---|---|---|---|
| Fundação | F1 Tailwind v4 e tokens (`37c6d2a`); F2 kit, PWA e nome Nuvi (`48a4b39`) | **F3** componentes da marca, **F4** casca e rotas, **F5** abertura, **F6** componentes base | plano-mãe, seção "Fundação" |
| R: registro | T1 `user_foods` e `/diary/foods/mine` (`f3bbec7`) | T2 receita no diário, T3 recentes e frequentes, T4 copiar, repetir e lote, T5 refeições prontas, T6 frontend | `2026-11-05-nuvi-registro.md` |
| B: código de barras | T1 a T3, backend inteiro (`8465fe5`, `caf05c1`, `bd216ca`) | T4 tela `CodigoDeBarras.tsx` | `2026-11-05-nuvi-codigo-barras.md` |
| A: água e lembretes | T1 água (`e946742`); correção do SQLAlchemy (`b85d22a`) | T2 lembretes, T3 push VAPID, T4 dispatch e cron, T5 frontend | `2026-11-05-nuvi-agua-lembretes.md` |
| G: Agente | G1 e G2, backend `/agent/parse` (`baeb57f`) | G3 tela `/agente` | `2026-11-05-nuvi-agente.md` |
| T: telas | nada | tudo | `2026-11-05-nuvi-telas.md` (T-a e T-b) |

## Ondas de execução

**Onda 1 (agora, em paralelo):**
- Fundação F3 a F6;
- R, tarefas T2 a T5 (backend);
- A, tarefas T2 a T4 (backend).

**Onda 2 (quando o commit da F6 estiver em `git log origin/main`):**
- T-a: Hoje, Diário e Cardápio;
- T-b: Receitas, Chef, Comunidade, Conta, Assinatura, Landing e login;
- R, tarefa T6 (frontend do registro);
- uma sessão para os frontends pequenos: B T4, G G3 e A T5.

## Regras que não podem ser quebradas (resumo; o plano-mãe manda)

1. **Mexa só nos arquivos da posse da sua frente.** Se precisar tocar em outro, faça a mudança mínima e diga isso no commit.
2. **A cada tarefa verificada:**
   - `git fetch origin && git rebase origin/main`;
   - testes do backend (`cd backend && python -m pytest -q`) e do frontend (`cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run lint`);
   - `git push origin HEAD:main`.
   - Nunca use `--force`. Se o push for recusado, refaça o rebase e os testes.
3. **Alembic em linha:** antes de subir, rode `alembic heads`. Se houver duas cabeças, aponte o seu `down_revision` para a cabeça da `main`.
4. **Visual:**
   - botão laranja `#E8590C` com texto `#1C1712`, nunca branco;
   - sem gradiente;
   - DM Sans em tudo, e Nunito 900 só no logotipo "nuvi";
   - contraste AA nos temas claro e escuro.
5. **Movimento:**
   - só CSS e Web Animations API, sem `motion` nem `framer-motion`;
   - indicador de carregamento só depois de 300 ms;
   - trocar de aba, buscar, passar de dia e mudar os números de macros acontece **sem** animação;
   - `prefers-reduced-motion` deixa só opacidade e cor.
6. **Antes de dizer que terminou**, confira cada tela no navegador interno a 375 px e a 1280 px, nos temas claro e escuro, comparando com a função correspondente do protótipo.
7. **Commit** com o rodapé `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
8. **Segredos:** nunca cadastre segredos. Liste no `.env.example` e na mensagem final o que o Franco precisa cadastrar.

## Se travar

Não invente regra de produto. Se o plano e o protótipo não respondem a dúvida, escolha a opção mais simples que siga o protótipo, registre a escolha no commit e na mensagem final, e siga em frente.
