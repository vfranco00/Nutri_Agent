# Mantenha esta versão igual à de backend/.python-version e à do job de backend em
# .github/workflows/tests.yml. Estava em 3.11 enquanto o CI testava em 3.12: produção
# rodava um runtime que nenhum teste cobria — a divergência que quebra deploy sem aviso.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Diretório de trabalho no container
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# O que este COPY leva pra dentro da imagem é filtrado por backend/.dockerignore —
# sem ele, `backend/.env` (SECRET_KEY, DATABASE_URL, GEMINI_API_KEY, token do Mercado
# Pago) e `backend/.venv` viravam camada da imagem, e camada não se apaga.
COPY . .

# Processo sem privilégio: se alguma falha virar execução de código no container, o
# atacante não começa como root — não instala pacote, não escreve no sistema de arquivos
# da imagem e não escala pelo runtime do container.
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Sem --reload. O reloader é ferramenta de desenvolvimento: ele vigia o sistema de
# arquivos e respawna workers, o que em produção é custo à toa e um caminho a mais pra
# reexecução de código a partir de qualquer escrita no diretório da aplicação.
# O ambiente local não perde nada: docker-compose.yml sobrescreve o command e continua
# subindo com --reload.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]