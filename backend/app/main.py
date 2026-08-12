import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from app.data.seed_food_catalog import sync_food_catalog
from app.db.session import SessionLocal, get_db
from app.routers import users, auth, profiles, recipes, ingredients, admin, ai, shopping, meal_plans, subscriptions, feedback, diary, diary_foods

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.FRONTEND_URL == "http://localhost:5173":
        # Aviso alto no log — se isso aparecer em produção, os links de email
        # (verificação, vencimento de assinatura) estão indo pra localhost.
        logger.warning("FRONTEND_URL não configurado — usando o padrão de localhost.")

    # Catálogo de alimentos sincronizado a partir de app/data/taco_foods.py. No caminho
    # normal custa um COUNT e volta. Não fica na migration de propósito: migration que
    # importa código de aplicação quebra retroativamente quando o código muda, e este
    # dado muda por curadoria, não por schema.
    db = SessionLocal()
    try:
        sync_food_catalog(db)
    except Exception:
        # Falhar aqui não pode impedir a API de subir: sem catálogo a busca devolve
        # vazio (degradação visível), com a API fora do ar nada funciona.
        logger.exception("Falha ao sincronizar o catálogo de alimentos")
    finally:
        db.close()

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

@app.middleware("http")
async def erro_interno_com_cors(request: Request, call_next):
    """Converte exceção não tratada em 500 DENTRO da pilha de CORS.

    Sem isto, exceção não tratada sobe até o `ServerErrorMiddleware` do Starlette, que
    é o middleware mais externo de todos — por fora do `CORSMiddleware`. O 500 sai sem
    `Access-Control-Allow-Origin`, e o navegador não mostra o erro: mostra
    "blocked by CORS policy". Quem depura vai investigar CORS, que está correto, em vez
    do erro que de fato aconteceu.

    Custou um diagnóstico inteiro: uma tabela ausente em produção apareceu no console
    como problema de CORS.

    REGISTRO ANTES DO CORS DE PROPÓSITO. No Starlette o middleware adicionado depois
    fica por FORA, então registrar aqui coloca este por DENTRO do `CORSMiddleware` — a
    resposta que ele devolve ainda atravessa o CORS na volta e recebe os cabeçalhos.
    Registrado depois, não resolveria nada.

    Não intercepta `HTTPException` nem `RateLimitExceeded`: ambos são tratados pelo
    `ExceptionMiddleware`, que fica mais interno, e nunca chegam aqui.
    """
    try:
        return await call_next(request)
    except Exception:
        # Traceback completo no log do servidor; para o cliente, nada além de que falhou.
        # Mensagem de erro é canal de vazamento: em um diário alimentar o texto da exceção
        # pode carregar nome de alimento, que é dado de saúde.
        logger.exception(
            "Erro não tratado em %s %s", request.method, request.url.path
        )
        return JSONResponse(status_code=500, content={"detail": "Erro interno."})


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


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Handler global de erro de validação. Resolve DOIS problemas de uma vez.

    (a) Corrige um 500 que existe hoje. O handler padrão do FastAPI devolve o valor
    recebido no campo `input` do corpo do erro, e `json.dumps` não serializa `inf`/`nan`.
    Como o parser de JSON do Python ACEITA os literais `Infinity`, `-Infinity`, `NaN` e
    `1e400`, o valor chega à validação, é corretamente rejeitado pelo `le=`, e a
    RENDERIZAÇÃO da resposta de erro estoura. Atenção ao conserto errado:
    `Field(allow_inf_nan=False)` NÃO resolve — o `inf` volta pelo campo `input` do mesmo
    jeito. O handler é o conserto.

    (b) Para de devolver dado sensível na mensagem de erro. Num diário alimentar, esse
    `input` é o nome do alimento — dado de saúde — viajando no corpo de uma resposta de
    erro, que é justamente o que proxy, APM e agregador de log capturam por padrão.

    É global e muda o corpo do 422 de TODA a API: `detail` continua sendo uma lista, mas
    sem `input`, `ctx` e `url`.
    """
    limpo = [
        {k: v for k, v in err.items() if k not in ("input", "ctx", "url")}
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content=jsonable_encoder({"detail": limpo}))

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
# A ORDEM importa e quebra silenciosamente: invertida, GET /diary/foods/search casa
# GET /diary/{entry_id}, o FastAPI tenta converter "foods" para int e devolve 422 em vez
# do resultado da busca.
app.include_router(diary_foods.router, prefix="/diary/foods", tags=["diary"])
app.include_router(diary.router, prefix="/diary", tags=["diary"])

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