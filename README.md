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

## 🗺️ Roadmap de Desenvolvimento

### ✅ **Sprint 1 --- Fundação (Concluído)**

-   [x] Setup FastAPI + Docker
-   [x] Configuração PostgreSQL + Alembic
-   [x] Modelagem de Usuário
-   [x] Registro com validação de email
-   [x] JWT + Argon2

### ⏳ **Sprint 2 --- Core Domain (Em andamento)**

-   [ ] Perfil Nutricional (peso, altura, metas)
-   [ ] CRUD de Receitas e Ingredientes
-   [ ] Frontend inicial (React)

### 🔮 **Sprint 3 --- IA & Planejamento (Futuro)**

-   [ ] Integração com LLMs (OpenAI / Gemini)
-   [ ] Geração automática de cardápios
-   [ ] Chat interativo NutriAgent

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
