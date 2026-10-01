"""Swipedia backend API regression tests - v2.

Covers: auth (register/login/guest), feed fields (difficulty/background/author_avatar),
decimal difficulty-based points + accumulation, question creation with difficulty/background,
invalid difficulty 422, uploads + protected file serving, conversations other_name perspective,
leaderboard/people/comments/save regression.
"""
import base64
import os
import uuid

import pytest
import requests


def _load_base_url() -> str:
    env_url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if env_url:
        return env_url.rstrip("/")
    # fallback: parse frontend/.env
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

# 1x1 transparent PNG
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def auth_token(api_client):
    resp = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    assert "session_token" in data and "user" in data
    return data["session_token"]


@pytest.fixture(scope="session")
def authed(auth_token):
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {auth_token}"})
    return session


def register_user(client, name):
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(f"{API}/auth/register", json={"email": email, "password": "testpass123", "name": name})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {data['session_token']}"})
    return session, data["user"]


# ---------- Auth ----------
class TestAuth:
    def test_register_new_user(self, api_client):
        session, user = register_user(api_client, "TEST Kayıt")
        assert user["email"].startswith("test_")
        assert "_id" not in user
        assert user["points"] == 0

    def test_register_duplicate_email_409(self, api_client):
        resp = api_client.post(f"{API}/auth/register", json={"email": TEST_EMAIL, "password": "whatever1"})
        assert resp.status_code == 409

    def test_login_success(self, api_client):
        resp = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == TEST_EMAIL

    def test_login_wrong_password_401(self, api_client):
        resp = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": "wrongpass1"})
        assert resp.status_code == 401

    def test_guest_login(self, api_client):
        resp = api_client.post(f"{API}/auth/guest", json={"name": "TEST Misafir"})
        assert resp.status_code == 200
        assert resp.json()["user"]["user_id"].startswith("guest_")

    def test_auth_me_and_unauthorized(self, authed, api_client):
        assert authed.get(f"{API}/auth/me").status_code == 200
        assert api_client.get(f"{API}/auth/me").status_code == 401


# ---------- Feed fields (difficulty / background / author_avatar) ----------
class TestFeedFields:
    def test_feed_items_include_new_fields(self, authed):
        questions = authed.get(f"{API}/feed").json()
        assert len(questions) > 0
        for q in questions:
            for field in ("question_id", "category", "text", "options", "author_name", "difficulty", "background", "author_avatar", "saved"):
                assert field in q, f"missing field {field}"
            assert q["difficulty"] in ("kolay", "orta", "zor", "uzman")
            assert "_id" not in q
        # at least one seeded question has an http background
        assert any(q["background"] and str(q["background"]).startswith("http") for q in questions)

    def test_feed_no_tikilearn(self, authed):
        blob = str(authed.get(f"{API}/feed").json()).lower()
        assert "tikilearn" not in blob


# ---------- Question creation with difficulty + background ----------
class TestCreateQuestion:
    def test_create_with_difficulty_and_background_persists(self, authed):
        bg = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1080"
        payload = {
            "category": "Bilim",
            "text": f"TEST sorusu: Hangi gezegen Kızıl Gezegen? {uuid.uuid4().hex[:4]}",
            "options": ["Mars", "Venüs", "Jüpiter", "Satürn"],
            "correct_index": 0,
            "explanation": "Mars kızıl görünür.",
            "difficulty": "uzman",
            "background": bg,
        }
        r = authed.post(f"{API}/questions", json=payload)
        assert r.status_code == 200, r.text
        q = r.json()
        assert q["difficulty"] == "uzman"
        assert q["background"] == bg
        assert q["author_avatar"] == ""
        # verify in feed
        feed = authed.get(f"{API}/feed").json()
        found = next((item for item in feed if item["question_id"] == q["question_id"]), None)
        assert found and found["difficulty"] == "uzman" and found["background"] == bg

    def test_invalid_difficulty_returns_422(self, authed):
        payload = {
            "category": "Bilim",
            "text": "TEST geçersiz zorluk sorusu",
            "options": ["a", "b", "c", "d"],
            "correct_index": 0,
            "explanation": "açıklama",
            "difficulty": "extreme",
        }
        r = authed.post(f"{API}/questions", json=payload)
        assert r.status_code == 422, r.text

    def test_create_question_validation_422(self, authed):
        r = authed.post(f"{API}/questions", json={"category": "X", "text": "kısa", "options": ["a"], "correct_index": 0, "explanation": ""})
        assert r.status_code == 422


# ---------- Points system ----------
# NOTE: decimal difficulty points (v2) were REPLACED by the integer rank-rate
# system (v4). Coverage lives in test_swipedia_v4_points.py.
class TestAnswerRegression:
    def test_answer_invalid_question_404(self, authed):
        assert authed.post(f"{API}/questions/q_nonexistent123/answer", json={"option_index": 0}).status_code == 404

    def test_answer_requires_auth(self, api_client):
        assert api_client.post(f"{API}/questions/anything/answer", json={"option_index": 0}).status_code == 401


# ---------- Uploads & protected file serving ----------
class TestUploads:
    def test_upload_image_and_fetch_with_token(self, auth_token):
        # multipart requires no manual JSON content-type header
        resp = requests.post(
            f"{API}/uploads",
            headers={"Authorization": f"Bearer {auth_token}"},
            files={"file": ("test.png", PNG_BYTES, "image/png")},
        )
        assert resp.status_code == 200, resp.text
        path = resp.json()["path"]
        assert path.startswith("swipedia/uploads/")
        # GET with token query param returns the image bytes
        get_resp = requests.get(f"{API}/files/{path}?token={auth_token}")
        assert get_resp.status_code == 200, get_resp.text
        assert get_resp.content == PNG_BYTES
        assert "image" in get_resp.headers.get("Content-Type", "")
        # without token -> 401, with invalid token -> 401
        assert requests.get(f"{API}/files/{path}").status_code == 401
        assert requests.get(f"{API}/files/{path}?token=invalidtoken").status_code == 401


# ---------- Conversations other_name perspective ----------
class TestConversationsPerspective:
    def test_other_name_computed_for_both_sides(self, api_client):
        alice, alice_user = register_user(api_client, "TEST Alice")
        bob, bob_user = register_user(api_client, "TEST Bob")
        text = f"TEST merhaba {uuid.uuid4().hex[:6]}"
        r = alice.post(f"{API}/conversations/{bob_user['user_id']}/messages", json={"text": text})
        assert r.status_code == 200, r.text

        # Alice sees Bob's name
        convs_a = alice.get(f"{API}/conversations").json()
        row_a = next((c for c in convs_a if bob_user["user_id"] in c.get("participants", [])), None)
        assert row_a is not None
        assert row_a["other_name"] == "TEST Bob"

        # Bob sees Alice's name (the perspective bug fix)
        convs_b = bob.get(f"{API}/conversations").json()
        row_b = next((c for c in convs_b if alice_user["user_id"] in c.get("participants", [])), None)
        assert row_b is not None
        assert row_b["other_name"] == "TEST Alice"

        # message persisted both ways
        msgs = bob.get(f"{API}/conversations/{alice_user['user_id']}/messages").json()
        assert any(m["text"] == text for m in msgs)


# ---------- Regression: social / save / comments ----------
class TestSocial:
    def test_leaderboard(self, api_client):
        resp = api_client.get(f"{API}/leaderboard")
        assert resp.status_code == 200
        leaders = resp.json()
        if leaders:
            assert "rank" in leaders[0] and isinstance(leaders[0]["points"], (int, float))

    def test_people(self, authed):
        people = authed.get(f"{API}/people").json()
        me = authed.get(f"{API}/auth/me").json()["user"]
        assert all(p["user_id"] != me["user_id"] for p in people)

    def test_post_and_get_comment(self, authed):
        feed = authed.get(f"{API}/feed").json()
        qid = feed[0]["question_id"]
        text = f"TEST yorum {uuid.uuid4().hex[:6]}"
        r = authed.post(f"{API}/questions/{qid}/comments", json={"text": text})
        assert r.status_code == 200, r.text
        assert r.json()["text"] == text
        comments = authed.get(f"{API}/questions/{qid}/comments").json()
        assert any(c["text"] == text for c in comments)

    def test_save_toggle(self, authed):
        feed = authed.get(f"{API}/feed").json()
        qid = feed[0]["question_id"]
        me_before = authed.get(f"{API}/auth/me").json()["user"]
        r1 = authed.post(f"{API}/questions/{qid}/save")
        saved_state = r1.json()["saved"]
        me_after = authed.get(f"{API}/auth/me").json()["user"]
        assert me_after["saved_count"] == me_before["saved_count"] + (1 if saved_state else -1)
        r2 = authed.post(f"{API}/questions/{qid}/save")
        assert r2.json()["saved"] == (not saved_state)

    def test_message_to_unknown_user_404(self, authed):
        r = authed.post(f"{API}/conversations/user_nonexistent/messages", json={"text": "merhaba"})
        assert r.status_code == 404
