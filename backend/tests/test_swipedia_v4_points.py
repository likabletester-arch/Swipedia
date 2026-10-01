"""Swipedia backend tests - v4: integer rank-rate points system.

Covers: answer API returns earned(0|1)/point_progress/point_rate, progress increments
per correct answer, point awarded exactly when progress reaches the rank rate
(progress resets to 0, points +1 integer), /auth/me exposes integer points +
point_progress + point_rate, point_rate tiers per rank, Apple auth 401 regression.
DB seeding via pymongo only to fast-forward point_progress (avoids 50 API calls).
"""
import os
import uuid

import pytest
import requests
from pymongo import MongoClient


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
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

TEST_EMAIL = "swipedia-test@example.com"
TEST_PASSWORD = "secret123"

_created_questions = []


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


@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session", autouse=True)
def cleanup(mongo):
    yield
    # teardown: remove questions + answers created by this suite
    if _created_questions:
        mongo.questions.delete_many({"question_id": {"$in": _created_questions}})
        mongo.answers.delete_many({"question_id": {"$in": _created_questions}})


def register_user(client, name):
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(f"{API}/auth/register", json={"email": email, "password": "testpass123", "name": name})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {data['session_token']}"})
    return session, data["user"]


def make_question(client):
    payload = {
        "category": "Genel Kültür",
        "text": f"TEST v4 puan sorusu {uuid.uuid4().hex[:6]}?",
        "options": ["Doğru", "Yanlış1", "Yanlış2", "Yanlış3"],
        "correct_index": 0,
        "explanation": "İlk seçenek doğrudur.",
        "difficulty": "kolay",
    }
    r = client.post(f"{API}/questions", json=payload)
    assert r.status_code == 200, r.text
    qid = r.json()["question_id"]
    _created_questions.append(qid)
    return qid


# ---------- /auth/me integer points fields ----------
class TestMePointsFields:
    def test_me_returns_integer_points_progress_rate(self, authed):
        me = authed.get(f"{API}/auth/me").json()["user"]
        assert isinstance(me["points"], int), f"points must be int, got {type(me['points'])}"
        assert "point_progress" in me and isinstance(me["point_progress"], int)
        assert "point_rate" in me
        # low-points user is on Citizen rate of 50
        if me["points"] < 50:
            assert me["point_rate"] == 50
        assert 0 <= me["point_progress"] < me["point_rate"]


# ---------- Answer API: progress increments, integer points ----------
class TestAnswerProgress:
    def test_correct_answer_returns_progress_fields(self, api_client, authed):
        fresh, user = register_user(api_client, "TEST V4 Progress")
        assert user["points"] == 0 and isinstance(user["points"], int)
        qid = make_question(authed)
        r = fresh.post(f"{API}/questions/{qid}/answer", json={"option_index": 0})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["correct"] is True
        assert data["already_answered"] is False
        assert data["earned"] in (0, 1)
        assert data["point_rate"] == 50
        assert data["point_progress"] == 1  # incremented by exactly 1
        assert isinstance(data["user"]["points"], int)
        assert data["user"]["points"] == 0  # 1/50 correct -> no point yet
        assert data["user"]["correct_count"] == 1
        # persisted
        me = fresh.get(f"{API}/auth/me").json()["user"]
        assert me["point_progress"] == 1 and me["points"] == 0

    def test_progress_increments_each_correct(self, api_client, authed):
        fresh, _ = register_user(api_client, "TEST V4 Multi")
        for expected_progress in (1, 2, 3):
            qid = make_question(authed)
            data = fresh.post(f"{API}/questions/{qid}/answer", json={"option_index": 0}).json()
            assert data["point_progress"] == expected_progress
            assert data["earned"] == 0
            assert isinstance(data["user"]["points"], int) and data["user"]["points"] == 0

    def test_wrong_answer_no_progress_no_points(self, api_client, authed):
        fresh, _ = register_user(api_client, "TEST V4 Wrong")
        qid = make_question(authed)
        data = fresh.post(f"{API}/questions/{qid}/answer", json={"option_index": 1}).json()
        assert data["correct"] is False
        assert data["earned"] == 0
        assert data["point_progress"] == 0
        assert data["user"]["points"] == 0
        assert data["user"]["correct_count"] == 0

    def test_duplicate_answer_no_double_progress(self, api_client, authed):
        fresh, _ = register_user(api_client, "TEST V4 Dup")
        qid = make_question(authed)
        fresh.post(f"{API}/questions/{qid}/answer", json={"option_index": 0})
        data = fresh.post(f"{API}/questions/{qid}/answer", json={"option_index": 0}).json()
        assert data["already_answered"] is True
        assert data["earned"] == 0
        me = fresh.get(f"{API}/auth/me").json()["user"]
        assert me["point_progress"] == 1  # not incremented twice


# ---------- Point awarded exactly at the rate threshold ----------
class TestPointThreshold:
    def test_point_earned_at_50th_correct(self, api_client, authed, mongo):
        fresh, user = register_user(api_client, "TEST V4 Threshold")
        # fast-forward: 49/50 progress, 0 points
        mongo.users.update_one({"user_id": user["user_id"]}, {"$set": {"point_progress": 49, "points": 0, "correct_count": 49}})
        qid = make_question(authed)
        r = fresh.post(f"{API}/questions/{qid}/answer", json={"option_index": 0})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["earned"] == 1, "50th correct answer must earn exactly 1 point"
        assert data["point_progress"] == 0, "progress must reset to 0 after earning"
        assert data["point_rate"] == 50
        assert data["user"]["points"] == 1
        assert isinstance(data["user"]["points"], int)
        # persisted in DB and via /auth/me
        me = fresh.get(f"{API}/auth/me").json()["user"]
        assert me["points"] == 1 and me["point_progress"] == 0
        db_user = mongo.users.find_one({"user_id": user["user_id"]})
        assert db_user["points"] == 1 and isinstance(db_user["points"], int)

    def test_progress_continues_after_threshold(self, api_client, authed, mongo):
        fresh, user = register_user(api_client, "TEST V4 PostBonus")
        mongo.users.update_one({"user_id": user["user_id"]}, {"$set": {"point_progress": 49, "points": 0, "correct_count": 49}})
        qid1 = make_question(authed)
        fresh.post(f"{API}/questions/{qid1}/answer", json={"option_index": 0})  # earns point, resets
        qid2 = make_question(authed)
        data = fresh.post(f"{API}/questions/{qid2}/answer", json={"option_index": 0}).json()
        assert data["earned"] == 0
        assert data["point_progress"] == 1
        assert data["user"]["points"] == 1


# ---------- Rank rate tiers ----------
class TestRateTiers:
    @pytest.mark.parametrize("points,expected_rate", [
        (0, 50), (49, 50), (50, 100), (149, 100), (150, 150), (299, 150),
        (300, 200), (599, 200), (600, 250), (1249, 250), (1250, 300), (5000, 300),
    ])
    def test_rate_for_points(self, api_client, mongo, points, expected_rate):
        fresh, user = register_user(api_client, "TEST V4 Tier")
        mongo.users.update_one({"user_id": user["user_id"]}, {"$set": {"points": points}})
        me = fresh.get(f"{API}/auth/me").json()["user"]
        assert me["points"] == points
        assert me["point_rate"] == expected_rate


# ---------- Apple auth 401 regression ----------
class TestAppleAuth:
    def test_apple_garbage_token_401(self, api_client):
        r = api_client.post(f"{API}/auth/apple", json={"identity_token": "garbage.token.value"})
        assert r.status_code == 401
        assert "Apple" in r.json()["detail"]


# ---------- Leaderboard integer points ----------
class TestLeaderboard:
    def test_leaderboard_points_integer(self, api_client):
        leaders = api_client.get(f"{API}/leaderboard").json()
        assert isinstance(leaders, list)
        for leader in leaders:
            assert isinstance(leader["points"], int), f"leaderboard points must be int: {leader}"
