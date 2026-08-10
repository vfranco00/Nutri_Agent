from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings


def client_ip_key(request: Request) -> str:
    """Chave de rate limit: o IP real do cliente.

    `get_remote_address` devolve o IP da conexão TCP. Em produção o app roda atrás do
    proxy do Render, então esse IP é o do PROXY — o mesmo pra todo mundo. Resultado: o
    limite de "5 logins por minuto" passa a valer pra soma de todos os usuários (qualquer
    um derruba o login de todos gastando 5 tentativas), e força bruta distribuída não é
    contida em lugar nenhum.

    A correção é ler X-Forwarded-For — mas o header é escrito pelo cliente, e só os
    últimos N saltos, acrescentados pelos proxies que realmente controlamos, são
    confiáveis. TRUSTED_PROXY_COUNT diz quantos são, e a contagem parte do FIM da lista:
    o que vem antes é texto que o atacante escolheu e serviria pra ele trocar de balde
    a cada requisição, desligando o rate limit por completo.

    Default 0 = comportamento atual (IP da conexão). Definir o valor certo é tarefa de
    deploy: Render/Vercel na frente = 1.
    """
    trusted = settings.TRUSTED_PROXY_COUNT
    if trusted > 0:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            hops = [h.strip() for h in forwarded.split(",") if h.strip()]
            # Com 1 proxy confiável, o IP que ELE observou é o último da lista.
            if len(hops) >= trusted:
                return hops[-trusted]

    return get_remote_address(request)


# Instância única, importada tanto pelo main.py (registro do middleware)
# quanto pelos routers (decorator @limiter.limit(...)) — evita import circular.
limiter = Limiter(key_func=client_ip_key)
