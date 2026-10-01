"""Swipedia backend tests - v5: PATCH /users/me profile update, register/guest
return new username/point_progress/point_rate fields, Apple endpoint shape."""
import os
import uuid

import pytest
import requests


def _load_base_url() -> str:
    env_url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if env_url:
        return env_url.rstrip("/")
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", ".env")
    with open(env_path) as fh:
        for line in fh:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL=") or line.startswith("EXPO_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("EXPO_BACKEND_URL not configured")


BASE_URL = _load_base_url()
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


def register_user(client, name="TEST V5"):
    email = f"TEST_v5_{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(f"{API}/auth/register", json={"email": email, "password": "testpass123", "name": name})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {data['session_token']}"})
    return s, data


# ---------- Register/Guest expose new fields ----------
class TestAuthReturnFields:
    def test_register_returns_integer_points_and_rate_fields(self, api_client):
        _, data = register_user(api_client, "TEST V5 Register")
        user = data["user"]
        for key in ("points", "point_progress", "point_rate", "username"):
            assert key in user, f"missing {key}: {user}"
        assert isinstance(user["points"], int) and user["points"] == 0
        assert isinstance(user["point_progress"], int) and user["point_progress"] == 0
        assert user["point_rate"] == 50  # Citizen tier at 0 points
        assert user["username"], "username must be auto-generated and non-empty"
        # slugified: lowercase, no @, spaces, special chars
        assert user["username"].lower() == user["username"]
        assert "@" not in user["username"] and " " not in user["username"]

    def test_guest_returns_integer_points_and_rate_fields(self, api_client):
        r = api_client.post(f"{API}/auth/guest", json={"name": "TEST V5 Guest"})
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        assert isinstance(user["points"], int) and user["points"] == 0
        assert user["point_progress"] == 0 and user["point_rate"] == 50
        assert user["username"]

    def test_login_returns_integer_points_and_rate_fields(self, api_client):
        r = api_client.post(f"{API}/auth/login", json={"email": "swipedia-test@example.com", "password": "secret123"})
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        assert isinstance(user["points"], int)
        assert "point_progress" in user and "point_rate" in user and user["username"]


# ---------- PATCH /users/me ----------
class TestProfileUpdate:
    def test_update_name_only(self, api_client):
        auth, data = register_user(api_client, "Old Name")
        new_name = f"TEST New {uuid.uuid4().hex[:4]}"
        r = auth.patch(f"{API}/users/me", json={"name": new_name})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["name"] == new_name
        # persisted
        me = auth.get(f"{API}/auth/me").json()["user"]
        assert me["name"] == new_name

    def test_update_username_slugified(self, api_client):
        auth, _ = register_user(api_client, "TEST slug")
        target = f"Test User{uuid.uuid4().hex[:4]}"  # contains uppercase + space
        r = auth.patch(f"{API}/users/me", json={"username": target})
        assert r.status_code == 200, r.text
        slug = r.json()["user"]["username"]
        assert slug.lower() == slug
        assert "@" not in slug and " " not in slug
        # must only contain a-z, 0-9, _
        assert all(c.isalnum() or c == "_" for c in slug)

    def test_update_username_turkish_chars_slugified(self, api_client):
        auth, _ = register_user(api_client, "TEST tr")
        target = f"Şöförüm_{uuid.uuid4().hex[:4]}"
        r = auth.patch(f"{API}/users/me", json={"username": target})
        assert r.status_code == 200, r.text
        slug = r.json()["user"]["username"]
        # Turkish chars should be transliterated (ş->s, ö->o, ü->u)
        assert "ş" not in slug and "ö" not in slug and "ü" not in slug
        assert slug.startswith("soforum_")

    def test_duplicate_username_409(self, api_client):
        auth_a, data_a = register_user(api_client, "TEST dup A")
        auth_b, _ = register_user(api_client, "TEST dup B")
        existing = data_a["user"]["username"]
        r = auth_b.patch(f"{API}/users/me", json={"username": existing})
        assert r.status_code == 409, r.text
        assert "alın" in r.json()["detail"].lower() or "taken" in r.json()["detail"].lower()

    def test_too_short_username_422(self, api_client):
        auth, _ = register_user(api_client, "TEST short")
        r = auth.patch(f"{API}/users/me", json={"username": "ab"})  # min_length=3
        assert r.status_code == 422

    def test_patch_requires_auth(self, api_client):
        r = api_client.patch(f"{API}/users/me", json={"name": "Nope"})
        assert r.status_code == 401

    def test_update_both_name_and_username(self, api_client):
        auth, _ = register_user(api_client, "TEST both")
        name = f"TEST Both {uuid.uuid4().hex[:4]}"
        uname = f"both_{uuid.uuid4().hex[:6]}"
        r = auth.patch(f"{API}/users/me", json={"name": name, "username": uname})
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        assert user["name"] == name and user["username"] == uname


# ---------- Apple endpoint shape ----------
class TestAppleEndpoint:
    def test_apple_missing_token_422(self, api_client):
        r = api_client.post(f"{API}/auth/apple", json={})
        assert r.status_code == 422  # missing required identity_token

    def test_apple_malformed_token_401(self, api_client):
        r = api_client.post(f"{API}/auth/apple", json={"identity_token": "not-a-jwt"})
        assert r.status_code == 401

    def test_apple_garbage_jwt_401(self, api_client):
        r = api_client.post(f"{API}/auth/apple", json={"identity_token": "aaa.bbb.ccc"})
        assert r.status_code == 401
        assert "Apple" in r.json().get("detail", "")
