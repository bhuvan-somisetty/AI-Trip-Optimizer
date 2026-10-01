from jose import jwt

from app.config import JWT_ALGORITHM, JWT_SECRET


def test_register_creates_member(client):
    response = client.post("/auth/register", json={"email": "new@example.com", "password": "Trip@2026"})
    assert response.status_code == 201
    assert response.json()["role"] == "member"


def test_register_ignores_requested_admin_role(client):
    # A client must not be able to make itself an admin by sending a role.
    response = client.post(
        "/auth/register", json={"email": "sneaky@example.com", "password": "Trip@2026", "role": "admin"}
    )
    assert response.status_code == 201
    assert response.json()["role"] == "member"

    token = client.post(
        "/auth/login", json={"email": "sneaky@example.com", "password": "Trip@2026"}
    ).json()["access_token"]
    assert jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])["role"] == "member"


def test_register_duplicate_email_is_409(client):
    client.post("/auth/register", json={"email": "dup@example.com", "password": "Trip@2026"})
    response = client.post("/auth/register", json={"email": "dup@example.com", "password": "Trip@2026"})
    assert response.status_code == 409


def test_login_wrong_password_is_401(client):
    client.post("/auth/register", json={"email": "user@example.com", "password": "Trip@2026"})
    response = client.post("/auth/login", json={"email": "user@example.com", "password": "wrong"})
    assert response.status_code == 401
