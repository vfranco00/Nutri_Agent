import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app  # importa todos os routers/models, registra tudo no Base.metadata
from app.db.base import Base
from app.db.session import get_db
from app.core.limiter import limiter
from app.models.user import User

# Banco isolado em memória — nunca toca no Postgres/Supabase real que o app usa fora dos testes.
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(autouse=True)
def _fresh_db():
    """Cada teste começa com um schema limpo — sem precisar de cleanup manual."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _disable_rate_limit():
    """Rate limit fica desligado por padrão; só o teste de rate limit propriamente
    dito reativa (senão os outros testes tomam 429 de bater o limite entre si)."""
    limiter.enabled = False
    yield
    limiter.enabled = True


@pytest.fixture(autouse=True)
def _mock_email_sending(monkeypatch):
    """Nunca dispara SMTP/Resend de verdade durante os testes."""
    monkeypatch.setattr("app.routers.users.send_verification_email", lambda email: True)
    monkeypatch.setattr("app.routers.auth.send_verification_email", lambda email: True)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db_session():
    """Acesso direto ao banco de teste, útil pra setup/assertions que a API não expõe."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def make_user(client, db_session):
    """Registra um usuário via API, marca como verificado direto no banco de teste
    (sem precisar decodificar token) e devolve um TestClient já autenticado."""

    def _make(email="user@example.com", password="strongpassword123", full_name="Test User", superuser=False):
        res = client.post(
            "/users/",
            json={"email": email, "password": password, "full_name": full_name},
        )
        assert res.status_code == 200, res.text

        user = db_session.query(User).filter(User.email == email).first()
        user.is_verified = True
        if superuser:
            user.is_superuser = True
        db_session.commit()

        login_res = client.post("/auth/login", data={"username": email, "password": password})
        assert login_res.status_code == 200, login_res.text
        token = login_res.json()["access_token"]

        auth_client = TestClient(app)
        auth_client.headers.update({"Authorization": f"Bearer {token}"})
        return auth_client

    return _make
