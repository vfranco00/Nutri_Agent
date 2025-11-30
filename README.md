# 🍎 NutriAgent --- AI Nutrition Planner

> Plataforma inteligente para planejamento alimentar personalizado,
> powered by LLMs.

![Status](https://img.shields.io/badge/Status-Em_Desenvolvimento-yellow)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-green)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

## 📋 Sobre o Projeto

O **NutriAgent** é uma aplicação que utiliza Inteligência Artificial
para gerar cardápios semanais e listas de compras baseadas nas
preferências, restrições e metas do usuário.

Atualmente, o projeto encontra-se na **Fase 1 (Fundação)**, com toda a
infraestrutura de backend, banco de dados e segurança implementada.

------------------------------------------------------------------------

## 🛠️ Tech Stack (Backend)

-   **Linguagem:** Python 3.11+
-   **Framework:** FastAPI
-   **Banco de Dados:** PostgreSQL 16
-   **ORM:** SQLAlchemy 2.0 (async)
-   **Migrations:** Alembic
-   **Segurança:**
    -   OAuth2 + JWT
    -   Argon2 para hashing
    -   Pydantic V2
-   **Infraestrutura:** Docker & Docker Compose
-   **Testes:** Pytest

------------------------------------------------------------------------

## 🚀 Como Rodar o Projeto

### ✔ Pré-requisitos

-   Docker
-   Docker Compose

------------------------------------------------------------------------

### 1️⃣ Clonar e Configurar

``` bash
git clone <URL_DO_REPO>
cd nutriagent
cp .env.example .env
```

------------------------------------------------------------------------

### 2️⃣ Subir a Aplicação

``` bash
docker compose up -d --build
```

------------------------------------------------------------------------

### 3️⃣ Executar Migrations

``` bash
docker compose exec api alembic upgrade head
```

------------------------------------------------------------------------

## 📚 Documentação da API

Após subir o container:

👉 **Swagger UI:** http://localhost:8000/docs

------------------------------------------------------------------------

## 🔌 Endpoints Principais

  ---------------------------------------------------------------------------------
  Método   Rota            Descrição                                       Status
  -------- --------------- ----------------------------------------------- --------
  POST     `/users/`       Cadastro de novos usuários (senha com Argon2)   ✅
                                                                           Pronto

  POST     `/auth/login`   Autenticação OAuth2 (retorna JWT)               ✅
                                                                           Pronto

  GET      `/health`       Checagem da saúde da API                        ✅
                                                                           Pronto
  ---------------------------------------------------------------------------------

------------------------------------------------------------------------

## 🧪 Rodar Testes

``` bash
docker compose exec api python -m pytest
```

------------------------------------------------------------------------

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

- [x] **Auth Pages:** Telas de Login e Cadastro.
- [x] **Onboarding:** Formulário de criação de Perfil Nutricional.
- [x] **Dashboard:** Visualização das receitas do usuário.
- [x] **Forms:** Telas para adicionar receitas e ingredientes dinamicamente.

## 🔮 Sprint 6 — Inteligência Artificial (Futuro)
**Objetivo:** Integração com LLM para gerar valor ao usuário.

- [x] **AI Integration:** Conexão com OpenAI API ou Gemini API.
- [x] **Feature:** "Gerar Cardápio Semanal" baseado no Perfil e Receitas.
- [x] **Chat:** Assistente nutricional interativo.

------------------------------------------------------------------------

## 🤝 Contribuição

1.  Faça um fork
2.  Crie uma branch:

``` bash
git checkout -b feature/minha-feature
```

3.  Commit:

``` bash
git commit -m "feat: adiciona minha feature"
```

4.  Push:

``` bash
git push origin feature/minha-feature
```

5.  Abra um PR 🚀

------------------------------------------------------------------------

# `.env.example`

Crie este arquivo na raiz do projeto:

``` ini
# Configurações do Banco de Dados
POSTGRES_USER=nutri_user
POSTGRES_PASSWORD=nutri_password
POSTGRES_DB=nutri_db
POSTGRES_PORT=5432
POSTGRES_HOST=db

# String de Conexão (SQLAlchemy)
DATABASE_URL=postgresql+psycopg://nutri_user:nutri_password@db:5432/nutri_db

# Segurança
SECRET_KEY=change_this_secret_key_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Ambiente
ENVIRONMENT=development
```
