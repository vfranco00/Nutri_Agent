# Plano de resposta a incidentes de segurança (Art. 48 da LGPD; Res. CD/ANPD 15/2024)

> **Rascunho para revisão jurídica.** Fazer uma simulação antes de depender dele.

- **Controlador:** [[CONTROLADOR]], CNPJ [[CNPJ]]
- **Encarregado:** [[ENCARREGADO_NOME]], [[ENCARREGADO_EMAIL]]
- **Responsável técnico de plantão:** [[RESPONSAVEL_TECNICO]]
- **Versão:** 1.0, 2026-11-05

## 1. O que é incidente

Qualquer evento que afete confidencialidade, integridade ou disponibilidade de dado pessoal. Exemplos no Nuvi: banco exposto, endpoint sem autenticação devolvendo dados, conta de admin invadida, chave do Gemini ou do Supabase vazada, log com dado pessoal exposto, falha do Render ou do Supabase que perde dados, exclusão indevida.

## 2. Quando notificar (Art. 5º da Res. 15/2024, cumulativo)

Notificar a ANPD **e** os titulares se houver:
- **A.** risco ou dano relevante aos titulares; **e**
- **B.** pelo menos uma categoria: dado sensível; dado de criança, adolescente ou idoso; dado financeiro; dado de autenticação; dado sob sigilo; dado em larga escala.

No Nuvi, dado de saúde é sensível. **Quase todo incidente que expõe diário, peso ou perfil cumpre o B.** Vazamento de e-mail e hash de senha também pode cumprir (autenticação). Decisão de não notificar é escrita, assinada pelo encarregado e arquivada.

## 3. Prazos

| Ação | Prazo |
|---|---|
| Notificar ANPD | **3 dias úteis** a partir do conhecimento de que dado pessoal foi afetado |
| Notificar titulares | **3 dias úteis**, mesmo marco |
| Complementar a comunicação | até 20 dias úteis |
| Guardar o registro | **5 anos** |
| Se for agente de pequeno porte | prazo em dobro (6 dias úteis); confirmar enquadramento |

## 4. Passo a passo

**T+0: detecção.** Anote data e hora exatas do conhecimento. Avise o encarregado na hora. Abra um registro `INC-AAAA-NNN`.

**T+0 a T+4h: conter.**
- Isole o que for afetado; preserve logs (Render, Vercel, Supabase) sem apagar nada.
- Revogue credenciais: `SECRET_KEY` (invalida sessões), chave do Gemini, chaves do Supabase, do Brevo, do Mercado Pago, VAPID e `CRON_SECRET`.
- Bloqueie a rota afetada ou coloque o app em manutenção.
- Fale com o provedor (operador) e peça o relatório dele.

**T+4h a T+24h: avaliar.** Quais dados, quantos titulares, vetor, causa provável, se há menor, se os dados estavam cifrados. Aplicar o teste da seção 2. Decidir por escrito.

**Até 3 dias úteis: comunicar.**

*À ANPD (12 itens, Art. 6º, §2º):*
1. natureza e categoria dos dados afetados;
2. número de titulares, separando crianças, adolescentes e idosos;
3. medidas técnicas e de segurança antes e depois;
4. riscos e impactos aos titulares;
5. motivos da demora, se houve;
6. medidas para reverter ou mitigar;
7. data do incidente e data do conhecimento;
8. dados do encarregado;
9. identificação do controlador (e declaração de pequeno porte, se for o caso);
10. identificação do operador;
11. descrição do incidente e causa principal;
12. total de titulares cujos dados são tratados nas atividades afetadas.

Canal: portal eletrônico da ANPD (www.gov.br/anpd).

*Aos titulares (7 itens, Art. 9º), em linguagem simples e individual (e-mail pelo Brevo e aviso no app):*
1. natureza e categoria dos dados;
2. medidas de segurança técnicas;
3. riscos;
4. motivos da demora, se houve;
5. o que está sendo feito para reverter ou mitigar;
6. data do conhecimento;
7. contato do encarregado.

Se o contato individual for inviável, aviso coletivo no site e no app por no mínimo 3 meses.

**Depois.** Forense, causa raiz, plano de correção com dono e prazo, complemento à ANPD, lições aprendidas, atualização deste plano e do ROPA/RIPD.

## 5. Quem faz o quê

| Papel | Responsabilidade |
|---|---|
| Quem detectou | avisa o encarregado e o responsável técnico na hora |
| Responsável técnico | contenção, evidências, causa |
| Encarregado | decisão de notificar, comunicação à ANPD e aos titulares, registro |
| [[CONTROLADOR]] (diretoria) | aprova a comunicação pública e acionamento jurídico |
| Advogado | revisão das comunicações: [[ADVOGADO_CONTATO]] |

## 6. Contatos de operadores (preencher)

| Operador | Canal de segurança |
|---|---|
| Supabase | [[A_CONFIRMAR]] |
| Render | [[A_CONFIRMAR]] |
| Vercel | [[A_CONFIRMAR]] |
| Google (Gemini) | [[A_CONFIRMAR]] |
| Brevo | [[A_CONFIRMAR]] |
| Mercado Pago | [[A_CONFIRMAR]] |

## 7. Registro de incidentes (guardar 5 anos)

Manter em `docs/lgpd/incidentes-registro.md` (ou local privado: o registro pode conter dado pessoal, então **não** versionar detalhes de titulares). Modelo:

```
## INC-AAAA-NNN
- Detecção:
- Conhecimento da afetação a dado pessoal:
- Tipo:
- Dados e titulares afetados:
- Categoria do Art. 5º (A e B):
- Decisão (notificar ou não, e por quê):
- Notificação ANPD (data e protocolo):
- Notificação titulares (data e meio):
- Medidas adotadas:
- Causa raiz:
- Plano de correção:
- Guardar até:
```

Todo incidente é registrado, mesmo o que não foi notificado.

## 8. Simulação anual

Cenários para o Nuvi: (1) endpoint devolvendo dados de outro usuário; (2) chave do Supabase ou do Gemini publicada no GitHub; (3) conta de admin invadida; (4) provedor de nuvem comprometido; (5) log de produção com e-mail e diário exposto. Cronometrar até a decisão e a comunicação. Se passar de 3 dias úteis, o processo está quebrado.

Data da primeira simulação: [[DATA_DA_SIMULACAO]].
