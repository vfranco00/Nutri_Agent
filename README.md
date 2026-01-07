# 🍎 NutriAgent — AI Nutrition Planner

> Plataforma inteligente para planejamento alimentar personalizado,
> powered by Google Gemini LLM.

![Status](https://img.shields.io/badge/Status-Versão_0.6.0-green)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688)
![React](https://img.shields.io/badge/React-Vite-61DAFB)
![AI](https://img.shields.io/badge/AI-Gemini_Flash-8E75B2)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

## 📋 Sobre o Projeto

O **NutriAgent** é uma aplicação Fullstack que utiliza Inteligência Artificial (Google Gemini) para revolucionar a gestão nutricional pessoal. O sistema não apenas armazena receitas, mas entende ingredientes, calcula calorias automaticamente e gamifica a experiência de cozinhar.

O diferencial do projeto é seu **sistema híbrido de cálculo nutricional**, que utiliza IA para estimativas gerais e um sistema de *fallback* robusto para produtos brasileiros específicos (ex: Rap10, Requeijão, Tapioca), garantindo precisão onde LLMs costumam alucinar.

---

## 🌟 Funcionalidades Principais

### 🧠 Inteligência Artificial (Gemini Powered)
* **Cálculo Automático:** Ao adicionar um ingrediente, a IA estima as calorias em tempo real.
* **Sistema "Blindado":** Cache inteligente e correções manuais (Hardcoded fixes) para alimentos comerciais brasileiros que a IA costuma errar.
* **Geração de Cardápios:** Criação de planos alimentares semanais baseados no perfil do usuário.
* **Lista de Compras:** Geração automática com base no plano alimentar.

### 🍳 Gestão de Receitas Avançada
* **Unidades Padronizadas:** Sistema de seleção (g, kg, ml, colher de sopa, etc.) para evitar erros de digitação e cálculo.
* **Privacidade:** Controle granular — você escolhe se sua receita é **Privada** (só você vê) ou **Pública** (aparece na comunidade).
* **Edição Inteligente:** Recálculo automático de calorias totais ao editar ingredientes ou quantidades.

### 🏆 Gamificação & Comunidade
* **Leaderboard Semanal:** Ranking dos "Top Chefs" que mais contribuem com a comunidade.
* **Sistema de XP:** Usuários ganham pontos ao tornar receitas públicas.
* **Explorar:** Aba de comunidade para descobrir receitas de outros usuários.

---

## 🛠️ Tech Stack

### Backend (API)
* **Linguagem:** Python 3.11+
* **Framework:** FastAPI
* **Banco de Dados:** PostgreSQL 16
* **ORM:** SQLAlchemy 2.0 (Async) + Alembic (Migrations)
* **AI:** Google Generative AI (Gemini Flash Model)
* **Segurança:** OAuth2 + JWT + Argon2

### Frontend (Client)
* **Framework:** React + Vite
* **Linguagem:** TypeScript
* **Estilização:** Tailwind CSS (Dark/Light Mode)
* **Ícones:** Lucide React
* **Integração:** Axios

### Infraestrutura
* **Containerização:** Docker & Docker Compose

---

## 🚀 Como Rodar o Projeto

### ✔ Pré-requisitos
* Docker & Docker Compose
* Chave de API do Google Gemini (`GEMINI_API_KEY`)

### 1️⃣ Clonar e Configurar

```bash
git clone <URL_DO_REPO>
cd nutriagent

# Copie o arquivo de exemplo
cp .env.example .env
```

------------------------------------------------------------------------

### 3️⃣ Executar Migrations

``` bash
docker compose exec api alembic upgrade head
```

------------------------------------------------------------------------

### 4️⃣ Acessar

Frontend (Aplicação): http://localhost:3000

Backend (Swagger UI): http://localhost:8000/docs

------------------------------------------------------------------------

## 📚 Documentação da API

Após subir o container:

👉 **Swagger UI:** http://localhost:8000/docs

------------------------------------------------------------------------

## 🔌 Endpoints Principais

 Método,Rota,Descrição,Status
AUTH,,,
POST,/auth/login,Autenticação e token JWT,✅
RECIPES,,,
GET,/recipes/,Lista receitas do usuário (Privadas + Públicas dele),✅
GET,/recipes/public,Lista receitas da comunidade,✅
POST,/recipes/,Cria nova receita (com suporte a IA e Privacy),✅
AI,,,
POST,/ai/calculate-calories,Calcula calorias de um ingrediente específico,✅
POST,/ai/generate-plan,Gera cardápio semanal completo,✅
USERS,,,
GET,/users/leaderboard,Ranking de usuários por XP,✅

------------------------------------------------------------------------

## 🧪 Rodar Testes

``` bash
docker compose exec api python -m pytest
```

------------------------------------------------------------------------

# 🗺️ Roadmap de Desenvolvimento - NutriAgent

Versão Atual: 0.6.0 (AI & Gamification Integrated)

✅ Sprint 1 — Infraestrutura (Foundation)
[x] Docker & Docker Compose setup.

[x] Configuração inicial do FastAPI e PostgreSQL.

✅ Sprint 2 — Segurança (Auth)
[x] Hashing de senhas com Argon2.

[x] Login JWT e OAuth2.

✅ Sprint 3 — Frontend Foundation
[x] Setup React, TypeScript e Tailwind.

[x] Roteamento e Dark Mode.

✅ Sprint 4 — Core Domain (Backend)
[x] CRUD de Receitas e Ingredientes.

[x] Modelagem de Perfil Nutricional.

✅ Sprint 5 — Interface do Usuário (UI)
[x] Dashboard interativo.

[x] Formulários dinâmicos de Receitas.

[x] Feature: Toggle de Receita Pública/Privada.

[x] Feature: Select padronizado de unidades de medida.

✅ Sprint 6 — AI & Gamification (Finalizado)
[x] Integração com Google Gemini.

[x] Cálculo automático de calorias por ingrediente.

[x] Sistema de Cache de Alimentos (food_cache).

[x] Feature: Leaderboard e Sistema de XP.

[x] Correções específicas para produtos brasileiros (Fix do Rap10).

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
# Database
POSTGRES_USER=nutri_user
POSTGRES_PASSWORD=nutri_password
POSTGRES_DB=nutri_db
POSTGRES_PORT=5432
POSTGRES_HOST=db
DATABASE_URL=postgresql+psycopg://nutri_user:nutri_password@db:5432/nutri_db

# Security
SECRET_KEY=sua_chave_secreta_aqui
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# AI Configuration
GEMINI_API_KEY=cole_sua_chave_do_google_aqui

# Environment
ENVIRONMENT=development
```
