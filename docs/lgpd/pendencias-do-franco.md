# Pendências do Franco (o que só você pode fazer)

> **Rascunho para revisão jurídica.** Os documentos de `docs/lgpd/` e `frontend/src/legal/` estão prontos como rascunho. Falta o que depende de decisão, de painel ou de contrato.

## Decisões

- [ ] **Quem é o controlador** (Nevus Digital, você ou outra empresa). Preencher `[[CONTROLADOR]]`, `[[CNPJ]]` e `[[ENDERECO_DO_CONTROLADOR]]` nos documentos.
- [ ] **Designar o encarregado** e publicar o canal. Preencher `[[ENCARREGADO_NOME]]` e `[[ENCARREGADO_EMAIL]]`. Minuta em `encarregado.md`.
- [ ] **Confirmar "18+"** como regra do produto (a política e os termos já dizem isso).
- [ ] **Planos, preços e reembolso** (termos de uso: `[[A_DEFINIR_PLANOS_E_PRECOS]]` e `[[A_DEFINIR_POLITICA_DE_REEMBOLSO]]`).
- [ ] **Prazo de conta inativa** (sugestão: aviso aos 12 meses e exclusão aos 24).

## Consultas em painel e contrato

- [ ] **G-04, Gemini:** a chave é AI Studio gratuito ou Cloud faturado? Migrar para plano pago com termos de dados restritos e anotar o país/região.
- [ ] **G-04, regiões:** Supabase (região do projeto e do pooler), Render (região de `nutri-agent-api`), Vercel.
- [ ] **G-14, DPAs:** pedir/baixar e arquivar o DPA de Supabase, Render, Vercel, Google, Brevo e Mercado Pago; registrar em `operadores.md`.
- [ ] **G-18, backups e logs:** retenção de backup do Supabase e de logs do Render e do Vercel; preencher `[[A_CONFIRMAR_RETENCAO_DE_BACKUP]]` e `[[A_CONFIRMAR_PRAZO_DE_LOGS]]`.
- [ ] Confirmar `ENVIRONMENT=production` e `TRUSTED_PROXY_COUNT=1` no Render.
- [ ] Contatos de segurança de cada operador (para `incidentes.md`).

## Jurídico e contábil

- [ ] **Revisão jurídica** da política, dos termos, do ROPA, do RIPD, do plano de incidentes e da retenção, por advogado de proteção de dados.
- [ ] **Contador:** prazo de guarda dos pagamentos (o rascunho usa 5 anos) e o enquadramento no Marco Civil (registros de acesso).
- [ ] **Agente de pequeno porte:** confirmar o enquadramento (Res. 2/2022). O RIPD está tratado como obrigatório.
- [ ] **LIA** (teste de legítimo interesse) para segurança/log e atendimento a visitantes.
- [ ] **Venda do Nuvi (Art. 11, §4º e Art. 9º, §2º):** a transferência de uma base de dados de saúde exige revisão jurídica específica. O comprador vira controlador e precisa informar os titulares. Preparar o texto de aviso antes da transação.

## Operação

- [ ] Aprovar o RIPD (encarregado) e decidir sobre os riscos que seguem altos: criptografia de coluna e 2FA no admin.
- [ ] Fazer a primeira **simulação de incidente** (`incidentes.md`, seção 8).
- [ ] Marcar a **revisão semestral** do ROPA.
- [ ] Publicar a política e os termos só depois da revisão jurídica, e trocar as datas `[[DATA_DE_PUBLICACAO]]`.
- [ ] Depois que o código da L1 e da L3 estiver na `main`: pedir a **reauditoria** (a política precisa descrever o que o código faz).

## Marcadores a preencher

`[[CONTROLADOR]]`, `[[CNPJ]]`, `[[ENCARREGADO_NOME]]`, `[[ENCARREGADO_EMAIL]]`, além dos marcadores `[[A_CONFIRMAR_*]]` e `[[A_DEFINIR_*]]`. Para localizar:

```bash
grep -rn "\[\[" docs/lgpd frontend/src/legal
```
