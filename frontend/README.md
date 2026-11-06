# 🍊 Nuvi — AI Nutrition Assistant

> Plataforma inteligente de planejamento alimentar, receitas e lista de compras automatizada via Inteligência Artificial.

![React](https://img.shields.io/badge/Frontend-React%20%7C%20Tailwind-blue)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue)
![AI](https://img.shields.io/badge/AI-Google%20Gemini-purple)
![Docker](https://img.shields.io/badge/Infra-Docker-2496ED)

## 📋 Sobre o Projeto
O **Nuvi** não é apenas um CRUD de receitas. É um assistente nutricional completo que utiliza **Generative AI (LLM)** para:
1.  Criar cardápios semanais baseados no metabolismo e preferências do usuário.
2.  Gerar receitas criativas baseadas nos ingredientes que o usuário tem em casa.
3.  Transformar planos alimentares automaticamente em listas de compras consolidadas.

---

## ✨ Funcionalidades Principais

### 🧠 Inteligência Artificial & Automação
-   **Oráculo de Calorias:** Cálculo automático de calorias de ingredientes usando IA + Cache Local (para performance).
-   **Chef IA:** Gera receitas completas a partir de uma lista de ingredientes soltos.
-   **Planejador Semanal:** Cria dietas de 7 dias respeitando alergias, gostos e metas calóricas (com opção de variedade ou praticidade).
-   **Conversor de Compras:** Transforma o cardápio da semana em uma checklist de mercado organizada.

### 👤 Perfil & Saúde
-   **Cálculo Metabólico:** Calcula TMB (Taxa Metabólica Basal) e TDEE (Gasto Energético Total) automaticamente.
-   **Histórico de Peso:** Gráfico interativo para acompanhar a evolução do usuário.
-   **Preferências:** Suporte a dietas (Vegana, Keto, etc.) e restrições alimentares.

### 🍳 Gestão de Receitas
-   **Filtros & Favoritos:** Organização por categoria (Almoço, Jantar, Doce) e sistema de favoritos.
-   **Modo Cozinha:** Leitura de receitas em voz alta (Text-to-Speech) para acessibilidade.
-   **Edição Completa:** Controle total sobre ingredientes e modo de preparo.

---

## 🛠️ Tecnologias Utilizadas

### Backend (API)
-   **Linguagem:** Python 3.11
-   **Framework:** FastAPI
-   **Banco de Dados:** PostgreSQL 16
-   **ORM:** SQLAlchemy 2.0 + Alembic (Migrations)
-   **Segurança:** OAuth2 com JWT e Hashing Argon2
-   **AI:** Integração HTTP REST com Google Gemini 1.5 Flash

### Frontend (Web)
-   **Framework:** React (Vite)
-   **Linguagem:** TypeScript
-   **Estilização:** TailwindCSS
-   **Gráficos:** Recharts
-   **Http Client:** Axios com Interceptors

### Infraestrutura
-   **Containerização:** Docker & Docker Compose (Fullstack)

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
-   Docker e Docker Compose instalados.
-   Chave de API do Google Gemini (Colocar no `.env`).

### Passo a Passo

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/seu-usuario/nutri-agent.git](https://github.com/seu-usuario/nutri-agent.git)
    cd nutri-agent
    ```

2.  **Configure as variáveis:**
    Crie um arquivo `.env` na raiz baseado no `.env.example`:
    ```ini
    POSTGRES_USER=nutri_user
    POSTGRES_PASSWORD=nutri_password
    POSTGRES_DB=nutri_db
    DATABASE_URL=postgresql+psycopg://nutri_user:nutri_password@db:5432/nutri_db
    SECRET_KEY=sua_chave_secreta
    GEMINI_API_KEY=sua_chave_do_google_aistudio
    ```

3.  **Suba a aplicação:**
    ```bash
    docker compose up -d --build
    ```

4.  **Execute as Migrations (Primeira vez):**
    ```bash
    docker compose exec api alembic upgrade head
    ```

5.  **Acesse:**
    -   **Frontend:** http://localhost:3000
    -   **API Docs:** http://localhost:8000/docs

---

## 🧪 Usuário de Teste
Crie uma conta na tela de registro ou use as credenciais (se populadas):
-   **Email:** demo@teste.com
-   **Senha:** senha123

---

**Desenvolvido com 💙 e muita cafeína.**