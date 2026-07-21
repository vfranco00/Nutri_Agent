from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.limiter import limiter
from app.routers import users, auth, profiles, recipes, ingredients, admin, ai, shopping, meal_plans

app = FastAPI(
    title="NutriAgent API",
    description="Backend com agente de IA para planejamento alimentar.",
    version="0.1.0"
)

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://nutri-agent-topaz.vercel.app",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
app.include_router(recipes.router, prefix="/recipes", tags=["recipes"])
app.include_router(ingredients.router, prefix="/ingredients", tags=["ingredients"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(ai.router, prefix="/ai", tags=["ai"])
app.include_router(shopping.router, prefix="/shopping", tags=["shopping"])
app.include_router(meal_plans.router, prefix="/meal-plans", tags=["meal-plans"])

@app.get("/")
def read_root():
    return {
        "project": "NutriAgent",
        "status": "online",
        "version": "0.1.0",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}