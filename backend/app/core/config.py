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

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()