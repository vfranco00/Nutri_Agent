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
        "password": "123",
        "full_name": "User One"
    }
    client.post("/users/", json=payload)
    
    # Tenta criar o segundo igual
    response = client.post("/users/", json=payload)
    
    # Deve falhar
    assert response.status_code == 400
    assert response.json()["detail"] == "Email already registered"