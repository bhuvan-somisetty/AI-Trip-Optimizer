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


def fake_google(monkeypatch, info=None, error=None):
    # Stands in for Google's token check so tests never reach Google.
    from app import config
    from app.routers import auth

    monkeypatch.setattr(config, "GOOGLE_CLIENT_ID", "test-client-id.apps.googleusercontent.com")

    def verify(credential, request, audience):
        assert audience == config.GOOGLE_CLIENT_ID
        if error:
            raise error
        return info

    monkeypatch.setattr(auth.id_token, "verify_oauth2_token", verify)


def test_google_login_creates_member(client, monkeypatch):
    fake_google(monkeypatch, {"email": "traveler@gmail.com", "email_verified": True})
    response = client.post("/auth/google", json={"credential": "google-id-token"})
    assert response.status_code == 200
    payload = jwt.decode(response.json()["access_token"], JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert payload["role"] == "member"

    # Signing in again reuses the same account.
    again = client.post("/auth/google", json={"credential": "google-id-token"}).json()["access_token"]
    assert jwt.decode(again, JWT_SECRET, algorithms=[JWT_ALGORITHM])["sub"] == payload["sub"]


def test_google_login_signs_into_existing_password_account(client, monkeypatch):
    client.post("/auth/register", json={"email": "both@example.com", "password": "Trip@2026"})
    password_token = client.post(
        "/auth/login", json={"email": "both@example.com", "password": "Trip@2026"}
    ).json()["access_token"]

    fake_google(monkeypatch, {"email": "both@example.com", "email_verified": True})
    google_token = client.post("/auth/google", json={"credential": "google-id-token"}).json()["access_token"]
    assert (
        jwt.decode(google_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])["sub"]
        == jwt.decode(password_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])["sub"]
    )


def test_google_account_has_no_password_login(client, monkeypatch):
    fake_google(monkeypatch, {"email": "google-only@gmail.com", "email_verified": True})
    client.post("/auth/google", json={"credential": "google-id-token"})
    response = client.post("/auth/login", json={"email": "google-only@gmail.com", "password": "anything"})
    assert response.status_code == 401


def test_google_login_invalid_token_is_401(client, monkeypatch):
    fake_google(monkeypatch, error=ValueError("Wrong audience"))
    response = client.post("/auth/google", json={"credential": "forged"})
    assert response.status_code == 401


def test_google_login_unverified_email_is_401(client, monkeypatch):
    fake_google(monkeypatch, {"email": "unverified@example.com", "email_verified": False})
    response = client.post("/auth/google", json={"credential": "google-id-token"})
    assert response.status_code == 401


def test_google_login_without_client_id_is_503(client, monkeypatch):
    from app import config

    monkeypatch.setattr(config, "GOOGLE_CLIENT_ID", "")
    response = client.post("/auth/google", json={"credential": "google-id-token"})
    assert response.status_code == 503
