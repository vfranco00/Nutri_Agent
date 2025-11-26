# 🗺️ Roadmap de Desenvolvimento - NutriAgent

> **Status do Projeto:** Backend da Sprint 4 Finalizado (Core Domain).
> **Versão Atual:** 0.4.0 (MVP Backend Complete)

---

## ✅ Sprint 1 — Infraestrutura & DevOps (Foundation)
**Objetivo:** Estabelecer um ambiente de desenvolvimento isolado, replicável e containerizado.

- [x] **Docker:** Configuração do `Dockerfile` para a API.
- [x] **Orquestração:** Criação do `docker-compose.yml` para gerenciar múltiplos serviços.
- [x] **Database:** Instância do PostgreSQL 16 rodando em container.
- [x] **Backend Setup:** Estrutura inicial do FastAPI (Hello World).
- [x] **Config:** Gerenciamento de variáveis de ambiente sensíveis (`.env`).

---

## ✅ Sprint 2 — Identidade & Segurança (Auth)
**Objetivo:** Implementar gestão de usuários e segurança de ponta a ponta.

- [x] **ORM:** Configuração do SQLAlchemy e Alembic para Versionamento de Banco de Dados.
- [x] **User Model:** Modelagem da tabela `users`.
- [x] **Criptografia:** Implementação de Hashing de Senha com **Argon2** (Padrão ouro de segurança).
- [x] **Autenticação:** Sistema de Login via **OAuth2** com geração de Token **JWT**.
- [x] **Documentação:** Swagger UI configurado e protegido por autenticação.

---

## ✅ Sprint 3 — Frontend Foundation (Client-Side)
**Objetivo:** Levantar a aplicação Web e integrar ao ecossistema Docker.

- [x] **Tech Stack:** Setup do projeto com React, Vite e TypeScript.
- [x] **Styling:** Configuração do Design System com TailwindCSS.
- [x] **Containerização:** Criação do `Dockerfile` otimizado para Node/React.
- [x] **Integração:** Orquestração Fullstack (Frontend conectando na mesma rede do Backend/DB).
- [x] **Smoke Test:** Validação de Hot-Reload e renderização inicial.

---

## ✅ Sprint 4 — Regras de Negócio & Domínio (Backend API)
**Objetivo:** Implementar a lógica central de Nutrição (Perfis, Receitas e Ingredientes).

### 👤 Perfil do Usuário
- [x] **Modelagem:** Tabela `profiles` (Relacionamento 1:1 com User).
- [x] **Validação:** Schemas Pydantic com regras de negócio (ex: peso > 0).
- [x] **API:** Rotas para criar, editar e ler perfil logado (`/profiles/me`).

### 🍳 Receitas (Recipes)
- [x] **Modelagem:** Tabela `recipes` (Relacionamento 1:N com User).
- [x] **API:** CRUD completo de receitas.
- [x] **Segurança:** Regra de negócio onde o usuário só edita suas próprias receitas.

### 🥕 Ingredientes (Ingredients)
- [x] **Modelagem:** Tabela `ingredients` (Relacionamento 1:N com Recipe e Cascade Delete).
- [x] **Lógica Aninhada:** Adição de ingredientes vinculados a uma receita pai.
- [x] **API:** Rota para listar ingredientes de uma receita específica.

---

## ⏳ Sprint 5 — Interface do Usuário (Em Breve)
**Objetivo:** Construir as telas para consumir a API desenvolvida na Sprint 4.

- [ ] **Auth Pages:** Telas de Login e Cadastro.
- [ ] **Onboarding:** Formulário de criação de Perfil Nutricional.
- [ ] **Dashboard:** Visualização das receitas do usuário.
- [ ] **Forms:** Telas para adicionar receitas e ingredientes dinamicamente.

## 🔮 Sprint 6 — Inteligência Artificial (Futuro)
**Objetivo:** Integração com LLM para gerar valor ao usuário.

- [ ] **AI Integration:** Conexão com OpenAI API ou Gemini API.
- [ ] **Feature:** "Gerar Cardápio Semanal" baseado no Perfil e Receitas.
- [ ] **Chat:** Assistente nutricional interativo.