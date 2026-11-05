# Matriz de operadores e transferência internacional (Arts. 33 a 36 e 39; Res. CD/ANPD 19/2024)

> **Rascunho para revisão jurídica.** Nada aqui foi lido em contrato ou painel. Região, plano e DPA estão **"a confirmar"** porque não aparecem no código.

- **Controlador:** [[CONTROLADOR]], CNPJ [[CNPJ]]
- **Encarregado:** [[ENCARREGADO_NOME]], [[ENCARREGADO_EMAIL]]
- **Versão:** 1.0, 2026-11-05
- **Revisão:** crítico trimestral; alto semestral; demais anual
- Os DPAs assinados vão em `docs/lgpd/operadores/<nome>.md` (ou PDF fora do repositório, com link)

## 1. Matriz

Tier: **Crítico** = dado sensível ou volume grande; **Alto** = dado pessoal comum em escala; **Médio**; **Baixo**.

| Operador | Papel | Finalidade | Dados | País / região | Mecanismo de transferência (Art. 33) | DPA | Tier | Situação |
|---|---|---|---|---|---|---|---|---|
| **Supabase** | operador | banco de dados | tudo (D1 a D17), inclusive saúde | a confirmar (se `sa-east-1`, não há transferência) | se fora do Brasil: cláusulas-padrão, II "b" | a confirmar | **Crítico** | verificar região do projeto e do pooler |
| **Google (Gemini API)** | operador | IA: cardápio, Agente, resolução de alimento | perfil (objetivo, dieta, alergias, gostos, meta), ingredientes, nome de alimento, texto, foto | EUA ou global (a confirmar) | consentimento específico, VIII, enquanto não houver cláusula-padrão; depois II "b" | a confirmar | **Crítico** | confirmar se a chave é AI Studio gratuito ou Cloud faturado, pois muda o uso do conteúdo pelo Google |
| **Render** | operador | servidor da API, logs, variáveis | tráfego, logs técnicos | a confirmar (costuma ser EUA) | cláusulas-padrão, II "b" | a confirmar | Alto | mudar de região não elimina a transferência |
| **Vercel** | operador | hospedagem do site e do app | IP e User-Agent, logs de borda | rede global (EUA) | cláusulas-padrão, II "b" | a confirmar | Alto | |
| **Brevo** | operador | e-mails transacionais | e-mail, nome, mensagem de chamado, links | UE (França) | a confirmar se a UE tem adequação reconhecida; sem ela, cláusulas-padrão | a confirmar | Alto | confirmar com advogado |
| **Mercado Pago** | controlador próprio dos dados de pagamento e operador da cobrança | cobrança recorrente | e-mail do pagador, plano, valor | Brasil | dispensa Art. 33 | a confirmar | Alto | citar na política como controlador próprio |
| **FCM (Google), Mozilla, Apple** | terceiros de entrega de push | notificações | endereço da assinatura, metadados; texto genérico, sem dado de saúde | EUA e outros | consentimento ao ativar push (hoje a finalidade `push`) | não há contrato direto | Médio | só quando a Frente A estiver na `main`; reauditar |
| **Open Food Facts** | terceiro independente | consulta de código de barras | código de barras e IP do servidor do Render | UE (França) | não recebe dado do titular | não há | Baixo | citar na política |
| **GitHub (Actions)** | operador técnico | CI e cron externo | código; `CRON_SECRET` | EUA | fora do escopo de dado do titular | a confirmar | Baixo | o log do workflow não deve imprimir payload |
| **Google Fonts** | terceiro | fontes | IP do visitante | EUA | — | — | — | **sai do app** com as fontes locais (L3) |
| **Resend, SMTP Gmail** | — | e-mail (código legado) | — | — | — | — | — | **remover** do código (L1.5) |

## 2. Critérios eliminatórios (vendor audit)

Não pode ser usado: operador que não assina DPA; que está em país sem cláusulas-padrão ou outra base do Art. 33; com incidente recente não comunicado. Hoje **todos os DPAs estão "a confirmar"**, então a regra bloqueia a venda até serem arquivados (G-14).

## 3. Checklist por operador (preencher)

- [ ] Razão social e país: 
- [ ] DPA assinado e arquivado
- [ ] Cláusulas-padrão da Res. 19/2024 (sem alteração) se houver transferência
- [ ] Lista de sub-operadores
- [ ] Prazo de notificação de incidente ao Nuvi
- [ ] Região dos dados e backup
- [ ] Certificações (SOC 2, ISO 27001, ISO 27701): a confirmar
- [ ] Forma de exclusão ao fim do contrato
- [ ] Próxima revisão

## 4. Plano

1. Levantar região e plano de cada serviço (Franco).
2. Arquivar os DPAs.
3. Migrar o Gemini para plano pago com termos de dados restritos.
4. Publicar a lista de operadores e países na política (já no rascunho).
5. Manter o consentimento específico (Art. 33, VIII) enquanto a cláusula-padrão não estiver assinada.

## Changelog

| Versão | Data | Mudança |
|---|---|---|
| 1.0 | 2026-11-05 | primeira versão, a partir da auditoria |
