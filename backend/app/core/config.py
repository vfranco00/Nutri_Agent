from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "NutriAgent"
    DATABASE_URL: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    GEMINI_API_KEY: str

    # Envio de email (confirmação de cadastro) via Resend. Se RESEND_API_KEY
    # ficar vazia, o serviço de email cai num fallback que só loga o link
    # de verificação no console — não quebra o cadastro nem exige configurar
    # isso pra rodar o projeto localmente.
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "NutriAgent <onboarding@resend.dev>"
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()