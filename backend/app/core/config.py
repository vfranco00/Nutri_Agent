from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "NutriAgent"
    DATABASE_URL: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    GEMINI_API_KEY: str

    # Envio de email (confirmação de cadastro). Ordem de prioridade em
    # services/email.py: SMTP (Gmail, grátis, manda pra qualquer destinatário)
    # -> Resend (só manda pro próprio email da conta enquanto não tiver domínio
    # verificado) -> fallback que só loga o link no console (dev local).
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "NutriAgent <onboarding@resend.dev>"
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()