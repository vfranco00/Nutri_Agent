import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging_config import setup_logging
from app.core.scheduler import start_scheduler, stop_scheduler
from app.db.session import get_db
from app.routers import users, auth, profiles, recipes, ingredients, admin, ai, shopping, meal_plans, subscriptions, feedback

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.FRONTEND_URL == "http://localhost:5173":
        # Aviso alto no log — se isso aparecer em produção, os links de email
        # (verificação, vencimento de assinatura) estão indo pra localhost.
        logger.warning("FRONTEND_URL não configurado — usando o padrão de localhost.")
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="NutriAgent API",
    description="Backend com agente de IA para planejamento alimentar.",
    version="0.1.0",
    lifespan=lifespan,
    # Em produção a documentação interativa some. /openapi.json publica o mapa completo
    # da API — incluindo cada rota de /admin, os nomes dos campos e os formatos aceitos —
    # de graça, sem autenticação. É o primeiro lugar onde se procura superfície de ataque.
    # Em dev continua ligada.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

# Lista vinda do ambiente (CORS_ORIGINS). Antes era fixa no código, o que significava
# que a produção aceitava requisição com credencial vinda de http://localhost:5173 —
# uma origem que qualquer pessoa consegue servir na própria máquina.
origins = settings.cors_origin_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin"],
    max_age=600,
)


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Registrado por último de propósito: o middleware adicionado depois fica por fora na
# pilha do Starlette, então este envelopa também as respostas geradas pelo SlowAPI
# (429) e pelos handlers de exceção — que também vão pro navegador.
# Swagger/ReDoc (só existem fora de produção) carregam script e CSS de CDN e ficam de
# fora da CSP restritiva; o resto dos headers continua valendo pra eles.
_DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")


@app.middleware("http")
async def security_headers(request, call_next):
    """Headers de segurança em toda resposta.

    A API é consumida por XHR, mas também devolve respostas que um navegador abre
    direto (erros, JSON navegado na barra de endereço). Sem esses headers, um JSON com
    conteúdo controlado pelo usuário pode ser reinterpretado como HTML pelo navegador
    (MIME sniffing), e a origem da API pode ser embutida em iframe pra clickjacking.
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault(
        "Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()"
    )
    if not request.url.path.startswith(_DOCS_PATHS):
        # A API não tem interface própria: nada deve ser carregado ou embutido a partir dela.
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        )
    if settings.is_production:
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response

app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
app.include_router(recipes.router, prefix="/recipes", tags=["recipes"])
app.include_router(ingredients.router, prefix="/ingredients", tags=["ingredients"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])
app.include_router(shopping.router, prefix="/shopping", tags=["shopping"])
app.include_router(meal_plans.router, prefix="/meal-plans", tags=["meal-plans"])
app.include_router(subscriptions.router, prefix="/subscriptions", tags=["subscriptions"])
app.include_router(feedback.router, prefix="/feedback", tags=["feedback"])

@app.get("/")
def read_root():
    return {
        "project": "NutriAgent",
        "status": "online",
        "version": "0.1.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check(response: Response, db: Session = Depends(get_db)):
    """Health check que efetivamente toca o banco.

    Antes retornava `{"status": "ok"}` fixo: respondia OK com o Postgres fora do ar.
    Um health check que não pode falhar não é health check — o orquestrador segue
    mandando tráfego pra uma instância que não consegue atender nenhum request útil.

    Responde 503 quando o banco não responde, que é o sinal que load balancer e
    monitoração entendem. O SELECT 1 é barato e não vira vetor de carga.

    Usa a dependency `get_db` em vez do `engine` direto de propósito: é o mesmo caminho
    de conexão que os requests reais percorrem (então mede o que importa), e é
    sobrescrevível — com o engine direto, rodar este endpoint em teste abriria conexão
    no banco de produção.
    """
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        # Sem stack trace no corpo da resposta: /health é público.
        logger.error("Health check falhou ao consultar o banco: %s", exc)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unavailable", "database": "down"}

    return {"status": "ok", "database": "up"}