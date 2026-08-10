from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "NutriAgent"
    DATABASE_URL: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    GEMINI_API_KEY: str

    # Envio de email (confirmação de cadastro). Ordem de prioridade em
    # services/email.py: SMTP (Gmail) -> Brevo -> Resend -> fallback que só loga
    # o link no console (dev local). SMTP na prática nunca funciona em produção
    # porque o Render bloqueia conexão de saída na porta 587 ("Network is
    # unreachable"); Resend sem domínio verificado só manda pro próprio email da
    # conta; Brevo com sender único verificado (sem precisar de domínio) é o que
    # sobra funcionando de graça pra qualquer destinatário real.
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    BREVO_API_KEY: str = ""
    BREVO_FROM_EMAIL: str = ""

    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "NutriAgent <onboarding@resend.dev>"
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