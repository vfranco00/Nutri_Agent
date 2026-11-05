# RIPD: Diário alimentar, perfil de saúde e foto do prato (Art. 38 da LGPD)

> **Rascunho para revisão jurídica.** Precisa de aprovação do encarregado antes de valer.

## 1. Identificação

- **Atividades:** ROPA A2 a A8 (perfil, diário, água, peso, cardápio por IA, Agente com foto ou texto, código de barras)
- **Controlador:** [[CONTROLADOR]], CNPJ [[CNPJ]]
- **Encarregado:** [[ENCARREGADO_NOME]], [[ENCARREGADO_EMAIL]]
- **Equipe:** [[EQUIPE_ENVOLVIDA]]
- **Versão / data:** 1.0 / 2026-11-05
- **Próxima revisão:** 2027-05 ou quando mudar a IA, o operador de IA, a finalidade ou a faixa etária

## 2. Por que é obrigatório

Teste da Res. CD/ANPD 2/2022, Art. 4º, cumulativo:
- **Critério específico:** dado sensível (saúde) **e** tecnologia inovadora (IA com foto) **e** tratamento automatizado (metas e cardápios).
- **Critério geral:** afeta direitos fundamentais (saúde, não discriminação). "Larga escala" não se aplica hoje, mas pode vir com o crescimento.

Conclusão: tratar como **alto risco e obrigatório**.

## 3. Contexto e objetivo

O Nuvi calcula metas calóricas e registra refeições, água e peso. Opcionalmente, usa o Google Gemini para sugerir cardápios, resolver alimentos e ler texto ou foto do prato. Justificativa: ajudar o usuário a acompanhar a alimentação com pouco esforço de digitação.

## 4. Descrição do tratamento

**Fluxo.**
1. **Coleta:** o titular digita no perfil e no diário, fotografa um prato ou lê um código de barras.
2. **Armazenamento:** Postgres no Supabase, isolado por `user_id`. Foto e texto do Agente **não são gravados** (só memória).
3. **Uso:** cálculo de meta (TMB e atividade), totais do dia, cardápios.
4. **Compartilhamento:** com `ia` ligada, Google Gemini recebe perfil (objetivo, dieta, alergias, gostos, meta), ingredientes, nome do alimento, texto ou foto. Sem e-mail, nome ou `user_id`. Open Food Facts recebe só o código de barras, a partir do servidor.
5. **Eliminação:** exclusão da conta apaga tudo em cascata. Cache de IA e Open Food Facts expira em 90 dias sem uso.

**Sistemas e operadores:** Render (API), Supabase (banco), Vercel (site), Google (IA), Open Food Facts (consulta pública). Ver `operadores.md`.

## 5. Necessidade e proporcionalidade

- Idade em anos, não data de nascimento. Não coletamos CPF, localização ou biometria.
- Prompt do `resolve` leva só o nome e a unidade do alimento.
- A IA é opcional; sem ela o app segue funcionando.
- A foto não persiste; texto e foto não vão para log.
- **Alternativas consideradas:** processar a IA em modelo próprio no Brasil (custo e prazo altos, não adotado por ora: [[A_DECIDIR]]); remover alergias do envio ao Gemini (reduz o risco, mas piora a segurança do cardápio para quem tem alergia).

## 6. Princípios do Art. 6º

| Princípio | Como é atendido |
|---|---|
| Finalidade | 5 finalidades separadas e informadas na política |
| Adequação | só dados que servem às metas e ao diário |
| Necessidade | idade em anos; sem CPF nem localização; prompt mínimo |
| Livre acesso | exportação em JSON e telas do app |
| Qualidade | edição de perfil e de diário pelo titular |
| Transparência | política em linguagem simples; aviso antes de enviar ao Gemini |
| Segurança | ver seção 9 |
| Prevenção | logs sem conteúdo; testes de isolamento |
| Não discriminação | aviso de que a IA pode errar; sem uso para precificar ou excluir |
| Responsabilização | ROPA, este RIPD, registro de consentimentos com versão |

## 7. Base legal

**Art. 11, I:** consentimento específico e destacado, registrado em `consents` (versão da política, data, origem, hash de IP). Para a IA: consentimento separado, que também serve de base ao Art. 33, VIII (transferência internacional). Revogação com o mesmo esforço, em Perfil → Privacidade. Revogar `saude` equivale a excluir a conta.

## 8. Direitos do titular

| Direito | Como |
|---|---|
| Confirmação e acesso | telas do app e exportação |
| Correção | edição de perfil e diário |
| Anonimização, bloqueio, eliminação | exclusão de conta; pedido ao encarregado |
| Portabilidade | `GET /privacy/export` (JSON) |
| Informação sobre compartilhamento | política e matriz de operadores |
| Consequência de não consentir | política: IA desligada, app segue |
| Revogação | switches em Privacidade |
| Revisão de decisão automatizada (Art. 20) | ajuste manual de meta e cardápio; pedido ao encarregado |

## 9. Riscos

Escala 1 a 5. Nível = P × I. Alto ≥ 12.

| ID | Risco | P | I | Nível | Controles | P res. | I res. | Residual |
|---|---|---|---|---|---|---|---|---|
| R01 | Vazamento do banco (dado de saúde de todos) | 2 | 5 | 10 | acesso restrito, Argon2, isolamento por usuário; **faltam** criptografia de coluna e 2FA no admin | 2 | 5 | 10, atenção |
| R02 | Envio ao Google sem base ou sem mecanismo de transferência | 4 | 4 | 16 | consentimento `ia`; **falta** DPA e plano pago do Gemini | 2 | 4 | 8 |
| R03 | Google reutilizar conteúdo (plano gratuito) | 3 | 4 | 12 | **a confirmar** o plano da chave; migrar para plano pago | 2 | 4 | 8 |
| R04 | Foto do prato expor rosto, documentos ou ambiente | 3 | 3 | 9 | não persiste; aviso de enquadramento | 2 | 3 | 6 |
| R05 | Cardápio ou meta inadequados a quem tem transtorno alimentar, gravidez ou alergia | 3 | 5 | 15 | aviso "não é aconselhamento médico"; limite mínimo de meta (ADR); edição manual; 18+ | 2 | 5 | 10, atenção |
| R06 | Menor de idade usando o app | 3 | 4 | 12 | bloqueio `age >= 18`; termos. Idade é autodeclarada | 2 | 4 | 8 |
| R07 | Furto de sessão por XSS (JWT em `localStorage`, sem CSP) | 2 | 4 | 8 | **CSP no frontend em andamento** (L3) | 1 | 4 | 4 |
| R08 | Acesso indevido por administrador | 2 | 4 | 8 | **falta** log de leitura e 2FA | 2 | 4 | 8 |
| R09 | E-mail ou conteúdo em log de terceiros | 3 | 2 | 6 | **ajuste em andamento** (L1.5) | 1 | 2 | 2 |
| R10 | Exclusão incompleta (FK, backup, cache) | 3 | 4 | 12 | serviço de exclusão e testes em Postgres (L1.2); retenção de backup **a confirmar** | 2 | 3 | 6 |
| R11 | Inferência sensível (religião, doença) pelo diário | 2 | 4 | 8 | só o titular vê; sem perfilamento de terceiros; sem anúncios | 1 | 4 | 4 |
| R12 | Venda do Nuvi com a base de saúde | 2 | 5 | 10 | revisão jurídica específica (Art. 11, §4º); aviso aos titulares | 2 | 4 | 8 |

## 10. Risco residual e decisão

Riscos que seguem com nível 10 (R01, R05) exigem decisão do encarregado: aceitar, ou implantar criptografia de coluna e 2FA no admin.

- [ ] Prosseguir como planejado
- [ ] Prosseguir com modificações: fechar R02 e R03 (DPA e plano do Gemini) **antes** de liberar a IA em escala
- [ ] Não prosseguir
- [ ] Consultar a ANPD

**Aprovado por:** [[ENCARREGADO_NOME]]  **Data:** [[DATA_DA_APROVACAO]]

## 11. Consulta a partes interessadas

Equipe técnica: auditoria de 2026-11. Jurídico e titulares: [[A_CONSULTAR]].
