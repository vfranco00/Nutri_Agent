# Pesquisa de concorrentes — apps de acompanhamento nutricional

- **Data**: 2026-11-05
- **Objetivo**: comparar o Nuvi com os apps do ramo (MyFitnessPal e outros) e decidir o que falta para ele ficar completo e vendável.
- **Ressalva sobre as fontes**: boa parte dos comparativos de 2026 é publicada por apps concorrentes (Nutrola, NutriScan, Fitia, MyNetDiary) e puxa a sardinha para si. Os números de preço, precisão e receita abaixo são indicativos; os **temas** (o que os usuários pedem e do que reclamam) se repetem em fontes independentes e são o que vale.

---

## 1. Onde o Nuvi está hoje

| Já tem | Não tem |
|---|---|
| Diário alimentar por refeição, com meta calórica do perfil | Leitura de **código de barras** |
| Base **TACO** (alimentos brasileiros) + IA de fallback marcada como estimativa | **Alimento personalizado** e **receita própria como item do diário** (fora do escopo do ADR-0001) |
| Macros (proteína/carbo/gordura) quando a base tem | **Registro por foto, voz ou texto livre** ("comi 2 ovos e um pão") |
| Cardápio semanal gerado por IA, troca de refeição, lista de compras | **Micronutrientes** (fibra, sódio, ferro, vitaminas) |
| Chef IA (receitas), comunidade, ranking com XP | **Água**, **exercício**, **jejum** |
| Histórico de peso no dashboard | **Meta adaptativa** (recalcular a meta pelo peso real) |
| Planos Starter / Plus R$ 29,90 / Pro R$ 59,90 | Lembretes/notificações, sequência de dias (streak) |
| | Integrações (Apple Saúde, Health Connect, Garmin, Strava) |
| | App nativo (hoje é web) |
| | Canal com nutricionista |

**Diferenciais reais que os gringos não têm**: base TACO brasileira, cardápio + lista de compras em português pensados para comida daqui, e preço em reais. É isso que se vende — não "mais um contador de calorias".

---

## 2. Os concorrentes, um a um

### MyFitnessPal (referência do mercado)
- **Forte em**: maior base de alimentos do mundo, ótima para produto embalado e rede de restaurante; código de barras; integrações com quase tudo.
- **Movimentos recentes**: comprou o **Cal AI** (app de caloria por foto que saiu do zero para dezenas de milhões de dólares por ano em ~18 meses); lançou registro por foto (Meal Scan) e por voz no Premium; em fev/2026 lançou o "Winter Release" com upload de foto; criou **acompanhamento de GLP-1** (Ozempic/Mounjaro: sintomas, efeitos colaterais, lembrete de dose) no Premium+.
- **Preço**: Premium ≈ US$ 80/ano, Premium+ ≈ US$ 100/ano.
- **Do que os usuários reclamam** (o tema mais consistente de toda a pesquisa):
  1. **Anúncio demais**, inclusive para quem paga.
  2. **Código de barras foi para trás do paywall** em 2023 — virou o marco da insatisfação.
  3. **Base cheia de erro**: entradas enviadas por usuários com macros errados.
  4. Redesign de 2026 colocou **mais toques** na tarefa principal (registrar comida); travamentos e logouts.

> Lição: o Nuvi ganha cliente do MFP sendo **rápido para registrar, sem anúncio e com dado confiável**. A partição do `food_cache` por procedência (ADR-0001, D-1) já é exatamente a defesa contra o problema nº 3 deles — isso é argumento de venda.

### Cronometer
- **Forte em**: precisão. Base curada (sem entrada livre de usuário), **~80 micronutrientes**, apontado nos comparativos como o mais preciso.
- **Público**: quem leva a sério (atletas, dietas terapêuticas, veganos acompanhando B12/ferro).
- **Lição**: micronutriente vira diferencial barato para quem já tem a TACO — **a TACO tem fibra, sódio, cálcio, ferro, vitamina C etc.** e hoje o Nuvi só usa kcal + macros.

### MacroFactor
- **Forte em**: **gasto calórico adaptativo**. Com o peso registrado e o que a pessoa comeu, o algoritmo estima o gasto real e **reajusta a meta toda semana** (check-in semanal). Funciona mesmo se a pessoa não seguir a meta à risca — não pune.
- **Outros**: diário em linha do tempo (sem número fixo de refeições), base verificada, código de barras, leitura de rótulo por IA, criação de alimento por IA.
- **Modelo**: sem plano gratuito; só assinatura.
- **Lição**: o Nuvi já tem os dois ingredientes (histórico de peso + diário). Falta a conta. É a feature com mais cara de "coach" e justifica o plano Pro.

### Lose It!
- **Forte em**: simplicidade para iniciante; registro rápido; foto (Snap It); precisão melhor que o MFP nos testes.
- **Lição**: onboarding e registro em poucos toques importam mais que quantidade de recurso.

### YAZIO (muito forte no Brasil)
- **Forte em**: contador + diário + **jejum intermitente** num app só; dezenas de milhões de downloads, dezenas de milhares de avaliações na App Store brasileira; receitas.
- **Lição**: jejum intermitente é recurso barato de fazer e muito procurado no Brasil.

### FatSecret
- **Forte em**: plano **gratuito generoso** (código de barras e diário de graça); comunidade.
- **Lição**: no Brasil, o plano grátis precisa ser útil de verdade, ou a pessoa vai para o FatSecret.

### Tecnonutri (brasileiro)
- **Forte em**: registro de refeição em tempo real, **controle de água**, relatórios de evolução, foco em emagrecimento, comunidade com fotos de prato.

### Fitia (América Latina, YC)
- **Forte em**: registro por **foto, voz, texto e código de barras**; plano alimentar e lista de compras no Premium; equipe de nutrição que confere marcas contra a embalagem; base de órgãos governamentais para genéricos; integração com Apple Saúde, Health Connect, Strava, Garmin, Fitbit, Oura, WHOOP.
- **Lição**: é o concorrente **mais parecido** com o Nuvi (cardápio + lista de compras + IA + América Latina). Precisa ser estudado de perto.

### Cal AI e os apps de "caloria por foto"
- Cal AI: crescimento explosivo com marketing de influenciador, comprado pelo MFP. Dezenas de apps brasileiros iguais na App Store (Olho no Prato, Dieta.ai, Kaloria...).
- **Ponto fraco conhecido**: foto erra em prato misturado, porção escondida e modo de preparo (óleo, molho). Precisão anunciada ≈ 90%, sem validação independente.
- **Lição**: foto é **porta de entrada** (reduz atrito), não fonte da verdade. O bom desenho é: foto → IA propõe itens da TACO com porção → usuário confirma/ajusta. Isso usa o diferencial (TACO) em vez de competir só em IA.

### Apps focados em GLP-1 (MyNetDiary GLP-1 Companion, MeAgain, CalTrak+)
- Tendência forte de 2026: quem usa Ozempic/Mounjaro precisa bater **proteína, fibra e água** (comem pouco e perdem massa magra), e quer lembrete de aplicação e registro de efeito colateral. A MyNetDiary disse que esses usuários usavam **dois apps** (medicação + caloria).
- **Lição**: nicho crescente e disposto a pagar, também no Brasil.

### Plataformas para nutricionista (Dietbox, WebDiet)
- Vendem para o **profissional**; o paciente usa um app grátis com plano alimentar, diário, lembrete de água e chat.
- **Lição**: é um segundo mercado (B2B2C). O Nuvi poderia ter um modo "nutricionista acompanha o paciente" — o diário dele já é o dado que o profissional quer ver.

### WhatsApp
- Não achei produto brasileiro consolidado de "registrar refeição pelo WhatsApp com IA"; há demanda (vagas de freelancer pedindo exatamente isso, e-books de nutricionistas usando foto no WhatsApp manualmente).
- **Lição**: **espaço vazio no Brasil**. Mandar "almocei arroz, feijão e um bife" ou uma foto no WhatsApp e cair no diário é um diferencial que nenhum dos grandes tem.

---

## 3. Matriz de recursos

✅ tem · 💰 só no pago · ❌ não tem

| Recurso | Nuvi | MFP | Cronometer | MacroFactor | YAZIO | Fitia |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Diário por refeição | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Base de alimentos brasileira (TACO) | ✅ | ❌ | parcial | ❌ | parcial | ✅ |
| Código de barras | ❌ | 💰 | ✅ | ✅ | ✅ | ✅ |
| Alimento/receita própria no diário | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Foto / voz / texto livre | ❌ | 💰 | parcial | ✅ | ✅ | ✅ |
| Micronutrientes | ❌ | 💰 | ✅ | ✅ | parcial | parcial |
| Meta adaptativa semanal | ❌ | ❌ | ❌ | ✅ | ❌ | parcial |
| Cardápio gerado por IA | ✅ | 💰 | ❌ | ❌ | 💰 | 💰 |
| Lista de compras | ✅ | 💰 | ❌ | ❌ | ❌ | 💰 |
| Água | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Jejum intermitente | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Exercício / integrações de saúde | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GLP-1 | ❌ | 💰 | ❌ | ❌ | ❌ | ❌ |
| Comunidade / gamificação | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| App nativo | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WhatsApp | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

(As colunas dos concorrentes vêm de lojas de apps e comparativos; "parcial" quando as fontes divergem.)

---

## 4. Recomendação — o que construir, em ordem

A régua: **primeiro tirar o que faz o cliente desistir no dia 1 (atrito de registro), depois o que faz voltar todo dia (hábito), depois o que justifica pagar (coach)**.

### Fase 1 — Paridade mínima (sem isso, ninguém troca o MFP)
1. **Alimento personalizado e receita própria no diário.** As receitas do usuário já existem no sistema; deixar registrar "1 porção da minha receita X". É a lacuna mais gritante, e o ADR-0001 só deixou de fora por escopo.
2. **Código de barras** (câmera no navegador + Open Food Facts, que tem boa cobertura de produto brasileiro). Já está previsto como `source = openfoodfacts`, isolado por usuário — o desenho de segurança está pronto. **Grátis em todos os planos**: é o recurso cuja cobrança mais irrita o usuário do MFP.
3. **Registro rápido**: "Recentes", "Frequentes", "Copiar refeição de ontem" e **"Repetir dia"**. Barato e é o que mais reduz toques.
4. **Água** (meta pelo peso, botões de +250 ml) e **lembretes** (PWA com notificação push, enquanto não há app nativo).

### Fase 2 — Diferenciais de IA, no jeito brasileiro
5. **Registro por texto livre e foto**: "comi 2 ovos mexidos e um pão francês" ou uma foto → Gemini separa os itens → cada item é casado com a **TACO** com porção sugerida → o usuário confirma. Foto como atalho, TACO como verdade. Conta na cota `diary_food_resolve` que já existe.
6. **Bot de WhatsApp** com o mesmo motor do item 5. Espaço vazio no Brasil e o maior "uau" de venda. Bom para o plano Plus/Pro.
7. **Micronutrientes da TACO** (fibra, sódio, cálcio, ferro, vitamina C...): trazer as colunas que a tabela já tem para o `food_catalog` e mostrar no resumo do dia.

### Fase 3 — Coach (justifica o Pro)
8. **Meta adaptativa semanal** estilo MacroFactor: com peso + consumo das últimas semanas, estimar o gasto real e propor nova meta num check-in semanal. Os dados já existem (`weight_history` + `diary_entries`).
9. **Relatórios**: semana e mês, média de calorias e macros, aderência ao cardápio (o diário já cruza planejado × registrado por slot), tendência de peso.
10. **Modo GLP-1**: metas de proteína/fibra/água em destaque, lembrete de aplicação, registro de sintomas.
11. **Jejum intermitente** com cronômetro.

### Fase 4 — Alcance e segundo mercado
12. **Integrações**: Apple Saúde / Health Connect (passos e exercício somando ao gasto) — exige app nativo ou wrapper (Capacitor).
13. **Modo nutricionista**: o profissional convida o paciente, vê o diário e manda o cardápio. Abre venda B2B (comparável a Dietbox/WebDiet, que cobram do nutricionista).

---

## 5. Posicionamento e preço

- **Frase de venda**: "O contador de calorias feito para a comida brasileira: registra em segundos (até pelo WhatsApp), monta o seu cardápio e a lista do mercado, sem anúncio."
- **Contra o MFP**: sem anúncio, código de barras grátis, base que não aceita dado envenenado, preço em reais (Plus R$ 29,90/mês ≈ R$ 359/ano já está na faixa do Premium deles convertido; vale testar **plano anual com desconto**, que é o padrão de todos os concorrentes).
- **Plano grátis**: precisa ter diário + código de barras + água completos (é o que FatSecret dá de graça). Cobrar pela **IA** (foto/texto, cardápio, WhatsApp, coach), que é o que custa dinheiro por chamada — coerente com `plan_limits.py`.

---

## Fontes

- Comparativos 2026: [Fitia](https://fitia.app/en/learn/article/best-food-tracking-app-us-2026-comparison/), [dev.to](https://dev.to/chowdownapp/best-free-calorie-counter-apps-in-2026-honest-rankings-1poa), [BGR](https://www.bgr.com/2246095/best-food-apps-to-track-your-calories/), [Welling](https://www.welling.ai/articles/best-calorie-counting-apps-which-one-is-right-for-you)
- MyFitnessPal: [Winter Release 2026](https://lite.aol.com/sports/other/story/0022/20260224/9659625.htm), [foto no Premium+](https://fitness-apps-review.pages.dev/blog/myfitnesspal-ai-photo-logging-review-2026), [preços](https://nutrola.app/en/blog/how-much-does-myfitnesspal-cost-now-2026), [reclamações (Unstar, pt-BR)](https://unstar.app/pt-BR/blog/is-myfitnesspal-premium-worth-it-paywall-app-reviews-2026), [scorecard MyNetDiary](https://www.mynetdiary.com/diet-app-scorecard-february-2026.html), [Techpoint](https://techpoint.africa/?p=357997)
- Cal AI: [TechCrunch](https://techcrunch.com/?p=2979629), [compra pelo MFP](https://letsdatascience.com/news/cal-ai-sells-to-myfitnesspal-after-rapid-growth-f789c949), [Latka](https://getlatka.com/companies/calai.app), [Appfigures](https://appfigures.com/resources/insights/20250228/4-this-is-where-ai-shines-(and-generates-millions))
- MacroFactor: [App Store](https://apps.apple.com/app/id1553503471)
- Brasil: [Canaltech](https://canaltech.com.br/apps/5-aplicativos-que-ajudam-a-controlar-a-dieta-e-a-perda-de-peso/), [Olhar Digital](https://olhardigital.com.br/2024/10/07/dicas-e-tutoriais/apps-para-contar-calorias/), [TecMundo](https://www.tecmundo.com.br/ciencia/257840-7-aplicativos-calcular-calorias-ajudam-emagrecimento.htm), [YAZIO](https://www.yazio.com/pt/melhor-app-contar-calorias), [FatSecret](https://www.fatsecret.com/br/aplicativo), [Fitia pt-BR](https://fitia.app/pt-br/), [Fitia funcionalidades](https://fitia.app/es/funcionalidades/)
- GLP-1: [MyNetDiary GLP-1 Companion](https://digital-release.kxan.com/business/press-releases/cision/20260505FL48085/mynetdiary-launches-glp-1-companion-for-ozempic-wegovy-and-mounjaro-users), [MeAgain](https://meagain.com/alternatives/myfitnesspal), [calorie-trackers.com](https://calorie-trackers.com/best-calorie-trackers-glp1-ozempic/)
- Nutricionista e WhatsApp: [Dietbox (Capterra)](https://www.capterra.com/p/216141/Dietbox/), [Dietbox App Store](https://apps.apple.com/BR/app/id648610153), [vaga Workana](https://www.workana.com/pt/job/desenvolvimento-de-assistente-fitness-e-nutricional-com-ia-para-whatsapp), [ESPM](https://centraldecases.espm.br/ebook_whatsapp_nutricao_/), [Olho no Prato](https://apps.apple.com/br/app/id6757802677)
