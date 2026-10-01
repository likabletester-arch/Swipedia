"""Swipedia backend API tests - v3.

Covers new features: unique usernames (auto-gen on register/guest, migration backfill),
PATCH /api/users/me (name/username, 409 taken, 422 invalid, propagation to questions),
POST /api/auth/apple rejects garbage token with 401, feed includes author_username.
"""
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

TEST_EMAIL = "swipedia-test@example.com"
TEST_PASSWORD = "secret123"
TAKEN_USERNAME = "test_meraklisi"  # already owned by the seed test user


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def authed(api_client):
    resp = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {resp.json()['session_token']}"})
    return session


def register_user(client, name):
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(f"{API}/auth/register", json={"email": email, "password": "testpass123", "name": name})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {data['session_token']}"})
    return session, data["user"]


# ---------- Username auto-generation on auth ----------
class TestUsernameGeneration:
    def test_register_creates_unique_username(self, api_client):
        _, user = register_user(api_client, "TEST Username Kayıt")
        assert "username" in user
        assert user["username"], "username should be auto-generated"
        assert user["username"] == user["username"].lower()
        assert len(user["username"]) >= 3

    def test_register_two_users_same_email_prefix_get_distinct_usernames(self, api_client):
        _, u1 = register_user(api_client, "TEST Same Prefix")
        _, u2 = register_user(api_client, "TEST Same Prefix")
        assert u1["username"] != u2["username"]

    def test_guest_login_has_username(self, api_client):
        resp = api_client.post(f"{API}/auth/guest", json={"name": "TEST Misafir User"})
        assert resp.status_code == 200, resp.text
        user = resp.json()["user"]
        assert user["username"].startswith("guest_")

    def test_seed_test_user_has_backfilled_username(self, authed):
        me = authed.get(f"{API}/auth/me").json()["user"]
        assert me["username"] == TAKEN_USERNAME


# ---------- PATCH /users/me ----------
class TestProfileUpdate:
    def test_update_name(self, api_client):
        session, user = register_user(api_client, "TEST Profil Eski")
        new_name = f"TEST Profil Yeni {uuid.uuid4().hex[:4]}"
        r = session.patch(f"{API}/users/me", json={"name": new_name})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["name"] == new_name
        # persisted via /auth/me
        me = session.get(f"{API}/auth/me").json()["user"]
        assert me["name"] == new_name

    def test_update_username_and_propagates_to_questions(self, api_client):
        session, user = register_user(api_client, "TEST Soru Yazarı")
        # create a question first
        q_payload = {
            "category": "Bilim",
            "text": f"TEST username propagation sorusu {uuid.uuid4().hex[:4]}?",
            "options": ["Doğru", "Y1", "Y2", "Y3"],
            "correct_index": 0,
            "explanation": "açıklama",
            "difficulty": "kolay",
        }
        q = session.post(f"{API}/questions", json=q_payload)
        assert q.status_code == 200, q.text
        qid = q.json()["question_id"]
        old_username = q.json().get("author_username", "")

        # update username
        new_username = f"test_upd_{uuid.uuid4().hex[:6]}"
        r = session.patch(f"{API}/users/me", json={"username": new_username})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["username"] == new_username
        assert new_username != old_username

        # feed reflects new author_username on the user's question
        feed = session.get(f"{API}/feed").json()
        found = next((item for item in feed if item["question_id"] == qid), None)
        assert found is not None
        assert found["author_username"] == new_username

    def test_username_taken_returns_409(self, api_client):
        session, _ = register_user(api_client, "TEST Çakışma")
        r = session.patch(f"{API}/users/me", json={"username": TAKEN_USERNAME})
        assert r.status_code == 409, r.text

    def test_username_too_short_returns_422(self, api_client):
        session, _ = register_user(api_client, "TEST Kısa")
        r = session.patch(f"{API}/users/me", json={"username": "ab"})
        assert r.status_code == 422, r.text

    def test_username_slugified(self, api_client):
        session, _ = register_user(api_client, "TEST Slug")
        suffix = uuid.uuid4().hex[:4]
        r = session.patch(f"{API}/users/me", json={"username": f"Meraklı Kedi {suffix}!"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["username"] == f"merakli_kedi_{suffix}"

    def test_update_profile_requires_auth(self, api_client):
        assert api_client.patch(f"{API}/users/me", json={"name": "X"}).status_code == 401


# ---------- Apple Sign-In route ----------
class TestAppleAuth:
    def test_apple_garbage_token_returns_401(self, api_client):
        r = api_client.post(f"{API}/auth/apple", json={"identity_token": "garbage.token.value"})
        assert r.status_code == 401, r.text

    def test_apple_empty_token_returns_4xx(self, api_client):
        r = api_client.post(f"{API}/auth/apple", json={"identity_token": ""})
        assert r.status_code in (401, 422), r.text


# ---------- Feed author_username ----------
class TestFeedUsername:
    def test_feed_includes_author_username_field(self, authed):
        feed = authed.get(f"{API}/feed").json()
        assert len(feed) > 0
        for q in feed:
            assert "author_username" in q, "feed item missing author_username"
            assert "_id" not in q

    def test_newly_created_question_has_author_username_in_feed(self, api_client):
        session, user = register_user(api_client, "TEST Feed Yazarı")
        payload = {
            "category": "Genel Kültür",
            "text": f"TEST feed author_username sorusu {uuid.uuid4().hex[:4]}?",
            "options": ["Doğru", "Y1", "Y2", "Y3"],
            "correct_index": 0,
            "explanation": "açıklama",
            "difficulty": "kolay",
        }
        r = session.post(f"{API}/questions", json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["author_username"] == user["username"]
        qid = r.json()["question_id"]
        feed = session.get(f"{API}/feed").json()
        found = next((item for item in feed if item["question_id"] == qid), None)
        assert found is not None
        assert found["author_username"] == user["username"]
