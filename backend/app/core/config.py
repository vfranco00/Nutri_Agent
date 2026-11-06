from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nuvi"
    DATABASE_URL: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    GEMINI_API_KEY: str

    # Envio de email (confirmação de cadastro, reset de senha, avisos): só Brevo, com
    # sender único verificado. Sem as duas chaves, o envio só loga o link em dev.
    BREVO_API_KEY: str = ""
    BREVO_FROM_EMAIL: str = ""

    FRONTEND_URL: str = "http://localhost:5173"

    # Assinaturas via Mercado Pago. Sem essa chave, o checkout cai num 501
    # ("em breve") em vez de quebrar — mesmo padrão do serviço de email.
    MERCADO_PAGO_ACCESS_TOKEN: str = ""

    # --- Segurança / borda ---

    # "production" liga o modo estrito: /docs, /redoc e /openapi.json deixam de ser
    # servidos e o HSTS é enviado. Fora de produção nada muda.
    ENVIRONMENT: str = "development"

    # Origens permitidas no CORS, separadas por vírgula. O default carrega os hosts de
    # dev; em produção, defina explicitamente e tire o localhost da lista.
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://localhost:5173,https://nutri-agent-topaz.vercel.app"
    )

    # Quantos proxies confiáveis existem na frente da aplicação (Render/Vercel = 1).
    # Com 0, o rate limit usa o IP da conexão — que atrás de um proxy é SEMPRE o IP do
    # proxy, ou seja: todos os usuários do mundo caem no MESMO balde de 5 logins/minuto.
    # Deixar >0 sem proxy real na frente é pior: o atacante passa a escolher o próprio
    # IP via X-Forwarded-For e o limite deixa de valer. Por isso o default é 0 e o
    # valor correto é de deploy — ver core/limiter.py.
    TRUSTED_PROXY_COUNT: int = 0

    # --- Lembretes (push Web) ---
    # Vazias = a API sobe, mas push responde 503 e o dispatch fica fechado.
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = ""
    # Segredo do cron externo (GitHub Actions) que chama /internal/reminders/dispatch.
    CRON_SECRET: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() in ("production", "prod")

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()