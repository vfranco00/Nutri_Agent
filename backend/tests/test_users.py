from fastapi.testclient import TestClient
from app.main import app
import random
import string

client = TestClient(app)

# Função auxiliar para gerar email aleatório (para não dar erro de duplicidade nos testes)
def random_email():
    return f"user{random.randint(1000,9999)}@example.com"

def test_create_user():
    email = random_email()
    payload = {
        "email": email,
        "password": "strongpassword123",
        "full_name": "Test User"
    }
    
    response = client.post("/users/", json=payload)
    
    # Validações
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == email
    assert "id" in data
    assert "hashed_password" not in data

def test_create_user_duplicate_email():
    # Cria o primeiro
    email = random_email()
    payload = {
        "email": email,
        "password": "strongpassword123",
        "full_name": "User One"
    }
    client.post("/users/", json=payload)
    
    # Tenta criar o segundo igual
    response = client.post("/users/", json=payload)
    
    # Deve falhar
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"


def test_create_user_ignores_is_superuser_in_payload():
    # Regressão: cadastro público não pode virar admin mandando is_superuser=True.
    email = random_email()
    response = client.post(
        "/users/",
        json={
            "email": email,
            "password": "strongpassword123",
            "full_name": "Tentativa de Escalada",
            "is_superuser": True,
            "is_active": False,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_superuser"] is False
    assert data["is_active"] is True


def test_create_user_rejects_short_password():
    response = client.post(
        "/users/",
        json={"email": random_email(), "password": "123", "full_name": "Senha Curta"},
    )
    assert response.status_code == 422


def test_read_users_me(make_user):
    auth_client = make_user(email="me@example.com")
    res = auth_client.get("/users/me")
    assert res.status_code == 200
    assert res.json()["email"] == "me@example.com"


def test_admin_list_requires_superuser(make_user):
    regular_client = make_user(email="regular@example.com")
    res = regular_client.get("/users/")
    assert res.status_code == 403


def test_admin_list_works_for_superuser(make_user):
    admin_client = make_user(email="admin@example.com", superuser=True)
    make_user(email="another@example.com")
    res = admin_client.get("/users/")
    assert res.status_code == 200
    emails = [u["email"] for u in res.json()]
    assert "another@example.com" in emails


def test_delete_user_requires_superuser(make_user):
    regular_client = make_user(email="notadmin@example.com")
    other_client = make_user(email="victim@example.com")
    victim_id = other_client.get("/users/me").json()["id"]

    res = regular_client.delete(f"/users/{victim_id}")
    assert res.status_code == 403


def test_admin_can_delete_user(make_user):
    admin_client = make_user(email="admin2@example.com", superuser=True)
    other_client = make_user(email="victim2@example.com")
    victim_id = other_client.get("/users/me").json()["id"]

    res = admin_client.delete(f"/users/{victim_id}")
    assert res.status_code == 200


def test_admin_can_toggle_status(make_user):
    admin_client = make_user(email="admin3@example.com", superuser=True)
    other_client = make_user(email="target@example.com")
    target_id = other_client.get("/users/me").json()["id"]

    res = admin_client.put(f"/users/{target_id}/toggle-status")
    assert res.status_code == 200
    assert res.json()["is_active"] is False

    # o usuário banido perde acesso imediatamente com o mesmo token
    res2 = other_client.get("/users/me")
    assert res2.status_code == 403


def test_leaderboard_is_public_and_ordered(make_user):
    make_user(email="board1@example.com")
    res = client.get("/users/leaderboard")
    assert res.status_code == 200
    assert isinstance(res.json(), list)