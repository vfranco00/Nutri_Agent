# Política de Privacidade do Nuvi

> **Rascunho para revisão jurídica.** Este texto ainda não foi aprovado por advogado e não deve ser tratado como versão final.

- **Versão:** `2026-11-v1`
- **Vigência:** a partir de [[DATA_DE_PUBLICACAO]]
- **Controlador:** [[CONTROLADOR]], CNPJ [[CNPJ]]
- **Encarregado pela proteção de dados:** [[ENCARREGADO_NOME]], [[ENCARREGADO_EMAIL]]

## Resumo em um minuto

- O Nuvi é um app de diário alimentar, peso e metas. Ele é **para maiores de 18 anos**.
- Peso, medidas, alergias, o que você come e quanto bebe de água são **dados de saúde**. A lei os chama de dados sensíveis. Só os tratamos com o seu consentimento, dado no cadastro.
- A inteligência artificial (Google Gemini) e os lembretes por notificação são **opcionais**. Cada um tem o seu próprio "permitir". Sem eles, o resto do app continua funcionando.
- A IA roda no Google, **fora do Brasil**. Se você permitir, o texto, a foto do prato e partes do seu perfil vão para lá.
- Você pode ver, baixar e corrigir seus dados, mudar suas permissões e **excluir a conta** quando quiser, na tela **Perfil → Privacidade**.
- Não vendemos seus dados, não usamos anúncios e não usamos rastreadores de publicidade.
- O Nuvi **não substitui** médico nem nutricionista.

## 1. Quem é o controlador

O controlador, responsável pelas decisões sobre os seus dados, é [[CONTROLADOR]], CNPJ [[CNPJ]], endereço [[ENDERECO_DO_CONTROLADOR]].

O encarregado pela proteção de dados é [[ENCARREGADO_NOME]]. Fale com ele em [[ENCARREGADO_EMAIL]] para dúvidas, reclamações e pedidos sobre os seus dados.

## 2. Quais dados coletamos, para quê e com que base legal

Usamos as mesmas cinco finalidades que você vê nas permissões do app: `saude`, `ia`, `push`, `ranking` e `marketing`.

| Finalidade | O que tratamos | Para quê | Base legal (LGPD) |
|---|---|---|---|
| **Conta** (sem permissão extra) | e-mail, nome, senha (guardada só como hash), data de criação, último acesso, se o e-mail foi verificado | criar e manter sua conta, entrar, verificar e-mail, recuperar senha | Art. 7º, V (execução do contrato) |
| **`saude`** (obrigatória para usar o app) | idade, peso, altura, sexo, nível de atividade, objetivo, dieta, alergias, gostos e aversões, histórico de peso, diário alimentar, água, alimentos pessoais, refeições prontas, cardápios, receitas e listas de compras | calcular metas, registrar refeições e peso, acompanhar sua evolução | Art. 11, I (consentimento específico e destacado) |
| **`ia`** (opcional) | objetivo, dieta, alergias, gostos, meta calórica, ingredientes, nome de alimento, texto livre e foto do prato | gerar cardápios, receitas, reconhecer alimentos e interpretar o que você escreve ou fotografa | Art. 11, I, e Art. 33, VIII (consentimento específico para envio ao exterior) |
| **`push`** (opcional) | assinatura de notificação do seu aparelho, horários e tipos de lembrete | avisar na hora de registrar refeição, beber água ou pesar | Art. 7º, I (consentimento) |
| **`ranking`** (opcional, desligado por padrão) | primeiro nome e pontuação | aparecer no ranking da comunidade | Art. 7º, I (consentimento) |
| **`marketing`** (opcional) | e-mail e nome | enviar novidades e ofertas. **Hoje não enviamos.** Se um dia enviarmos, só com a sua permissão | Art. 7º, I (consentimento) |
| **Assinatura e cobrança** | plano, status, valor, datas e identificadores de pagamento. O e-mail vai ao Mercado Pago. Não vemos o número do cartão | cobrar e manter sua assinatura; guardar o histórico fiscal | Art. 7º, V e Art. 7º, II (obrigação legal) |
| **Uso do plano** | contagem de uso de recursos com limite (por exemplo, Chef IA) e data | respeitar a cota do seu plano | Art. 7º, V |
| **Atendimento** | nome, e-mail, categoria e mensagem do chamado | responder a você | Art. 7º, V (usuário) e Art. 7º, IX (visitante) |
| **Segurança** | IP, tipo de navegador e URL acessada, em registros técnicos dos provedores | evitar abuso e fraude, investigar falhas | Art. 7º, IX (legítimo interesse) |

**Não coletamos** CPF, data de nascimento, localização, biometria nem dados de contatos do aparelho.

**Dados sensíveis.** Peso, medidas, alergias, diário, água e o que você fotografa são dados de saúde. Alimentos juntos podem revelar condições de saúde ou crenças. Por isso, tratamos tudo isso como sensível.

**Receitas públicas.** Se você marcar uma receita como pública, ela fica visível a outras pessoas. Só o que você marcou é exibido.

## 3. Inteligência artificial (Google Gemini)

Quando você permite a finalidade `ia` e usa um recurso de IA, enviamos ao Google, por meio da API do Gemini:

- **Cardápios e receitas:** objetivo, dieta, alergias, gostos, meta calórica e ingredientes.
- **Alimento desconhecido:** apenas o nome do alimento e a unidade.
- **Agente (texto ou foto do prato):** o texto que você escreveu ou a foto.

Sem o seu e-mail, nome ou identificador de conta. A foto **não é guardada** pelo Nuvi: ela é lida na memória e descartada. Evite fotografar rostos, documentos ou o ambiente da sua casa.

O Google está fora do Brasil (a confirmar o país exato), então isso é uma **transferência internacional**. Ela só acontece com o seu consentimento específico. Como o Google trata esse conteúdo depende do plano contratado pelo Nuvi: [[A_CONFIRMAR_PLANO_GEMINI]].

As sugestões da IA são geradas automaticamente. Você pode ajustar qualquer meta, cardápio ou registro à mão, e pode pedir revisão (veja o item 8).

**Se você não permitir:** o diário, o peso, a água e as metas continuam funcionando. Só os recursos de IA ficam indisponíveis.

## 4. Com quem compartilhamos (operadores e terceiros)

Contratamos empresas que tratam dados em nosso nome, sob nossas instruções. Estes são os operadores atuais:

| Empresa | Para quê | Que dados | País |
|---|---|---|---|
| Google (Gemini) | IA | ver item 3 | EUA ou outro (a confirmar) |
| Supabase | banco de dados | todos os dados da conta | [[A_CONFIRMAR_REGIAO_SUPABASE]] |
| Render | servidor da API | tráfego e registros técnicos | [[A_CONFIRMAR_REGIAO_RENDER]] |
| Vercel | hospedagem do site e do app | IP e navegador dos visitantes | rede global (EUA) |
| Brevo | e-mails de verificação, recuperação de senha e avisos | e-mail, nome e link do e-mail | UE (a confirmar) |
| Mercado Pago | cobrança da assinatura | e-mail do pagador, plano e valor | Brasil |
| Open Food Facts | consulta de código de barras | o código lido (vem do nosso servidor, não do seu aparelho) | UE (França) |
| FCM (Google), Mozilla ou Apple | entrega de notificações push, conforme o navegador | endereço da assinatura e metadados de entrega, **sem texto de saúde** | EUA e outros |

A Open Food Facts é um terceiro público, não um operador nosso. O Mercado Pago também tem responsabilidade própria pelos dados de pagamento.

Podemos ainda compartilhar dados com autoridades quando a lei exigir. **Não vendemos nem alugamos seus dados.**

Em caso de venda, fusão ou transferência do Nuvi para outra empresa, **informaremos você antes** e explicaremos o que muda, pois a nova empresa passará a ser a controladora (LGPD, Art. 9º, §2º). Dados de saúde só seguem nessa operação nas hipóteses que a lei permite.

## 5. Transferência internacional

Alguns operadores ficam fora do Brasil. Para eles usamos, conforme o caso: cláusulas-padrão contratuais aprovadas pela ANPD (Resolução CD/ANPD 19/2024) ou o seu consentimento específico (LGPD, Art. 33, VIII). Status por operador: **a confirmar** (ver [[LINK_DA_MATRIZ_DE_OPERADORES]]).

## 6. Por quanto tempo guardamos

| Dado | Prazo |
|---|---|
| Conta, perfil, diário, peso, água, alimentos, cardápios, receitas, listas | enquanto a conta existir; apagados na exclusão |
| Conta com e-mail não verificado | apagada após 30 dias |
| Cache de alimentos vindos da IA ou do Open Food Facts | até 90 dias sem uso; apagado também se ficar sem dono |
| Registro de uso do plano | 12 meses |
| Chamados de atendimento já fechados | 24 meses |
| Assinaturas de notificação sem envio bem-sucedido | 90 dias |
| Pagamentos | 5 anos (obrigação fiscal), depois de **anonimizados** ao excluir a conta |
| Registros técnicos (IP, navegador) | prazo dos provedores: [[A_CONFIRMAR_PRAZO_DE_LOGS]] |
| Cópias de segurança (backup) | [[A_CONFIRMAR_RETENCAO_DE_BACKUP]]; dados excluídos podem permanecer em backup por esse tempo |

Contas inativas: [[A_DEFINIR_PRAZO_DE_CONTA_INATIVA]].

## 7. Cookies e armazenamento no seu aparelho

Não usamos cookies de publicidade nem de análise. Guardamos no navegador (armazenamento local):

- o **token de sessão**, para você continuar logado (dura 30 minutos);
- o **tema** (claro/escuro) e preferências de tela;
- o **último cardápio gerado**, para você ver sem esperar.

Ao sair da conta, apagamos o token e o cardápio. O site não carrega mais fontes do Google: elas ficam no próprio Nuvi.

## 8. Seus direitos (Art. 18 da LGPD)

Você pode, a qualquer momento:

- **confirmar** se tratamos seus dados e **acessá-los**;
- **corrigir** dados incompletos ou errados (no Perfil e no diário);
- **baixar** seus dados em arquivo (**Perfil → Privacidade → Baixar meus dados**);
- **excluir** sua conta e seus dados (**Perfil → Privacidade → Excluir minha conta**; pede a senha);
- pedir **anonimização, bloqueio ou eliminação** de dados desnecessários;
- saber **com quem** compartilhamos (item 4);
- saber **o que acontece se não consentir** (itens 2 e 3);
- **revogar** qualquer permissão, com o mesmo esforço que deu (**Perfil → Privacidade**);
- **pedir revisão** de decisão tomada só por tratamento automatizado (Art. 20);
- **opor-se** a tratamento feito por legítimo interesse;
- **reclamar** à ANPD (www.gov.br/anpd).

Para o que o app não resolver sozinho, escreva a [[ENCARREGADO_EMAIL]]. Respondemos em até **15 dias**.

**Ao excluir a conta:** apagamos perfil, diário, peso, água, lembretes, receitas, cardápios, listas, consentimentos e chamados; cancelamos a assinatura no Mercado Pago; e **anonimizamos** os pagamentos (guardamos só valor, data e identificador do pagamento, que a lei fiscal exige).

**Revogar a finalidade `saude`** equivale a excluir a conta, porque o app não funciona sem esses dados.

## 9. Menores de idade

O Nuvi é para **maiores de 18 anos**. Não aceitamos cadastro de menores. Se soubermos de uma conta de menor, vamos excluí-la.

## 10. Aviso de saúde

O Nuvi é uma ferramenta de apoio e **não é aconselhamento médico ou nutricional**. Metas e cardápios são estimativas gerais. Procure um profissional de saúde antes de mudar sua dieta, principalmente se você estiver grávida, tiver doença, alergia grave ou histórico de transtorno alimentar. Se você se sentir mal, procure atendimento.

## 11. Segurança

Usamos senha com hash Argon2, conexão criptografada (HTTPS), acesso restrito por conta, registros técnicos que não guardam o conteúdo do diário, limite de tentativas de login e revisão periódica. Nenhum sistema é 100% seguro. Se houver um incidente que possa causar risco relevante, avisaremos você e a ANPD nos prazos da lei.

## 12. Mudanças nesta política

Quando mudarmos finalidades, bases legais, operadores ou prazos de modo relevante, publicaremos nova versão, avisaremos você no app ou por e-mail e, se for preciso, pediremos novo consentimento. As versões anteriores ficam disponíveis mediante pedido.

| Versão | Data | O que mudou |
|---|---|---|
| `2026-11-v1` | [[DATA_DE_PUBLICACAO]] | primeira versão |

## 13. Contato

Controlador: [[CONTROLADOR]], CNPJ [[CNPJ]].
Encarregado: [[ENCARREGADO_NOME]], [[ENCARREGADO_EMAIL]].
