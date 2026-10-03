"""
Feed and auth regression tests for the January 2026 Swipedia scope:
- Admin login flow
- /api/feed publication/visibility filtering behavior
- Non-repeating batches in same session
- Category filtering (Bilim)
- Guest/login-register regression endpoints
"""

import os
import re
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient


def _read_env_value(path: Path, key: str) -> str | None:
    if not path.exists():
        return None
    pattern = re.compile(rf"^{re.escape(key)}=(.*)$")
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = pattern.match(line)
        if match:
            value = match.group(1).strip().strip('"').strip("'")
            return value
    return None


def _public_base_url() -> str:
    base = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not base:
        base = _read_env_value(Path("/app/frontend/.env"), "EXPO_PUBLIC_BACKEND_URL")
    if not base:
        base = _read_env_value(Path("/app/frontend/.env"), "EXPO_BACKEND_URL")
    if not base:
        raise RuntimeError("EXPO_PUBLIC_BACKEND_URL / EXPO_BACKEND_URL is required")
    return base.rstrip("/")


def _read_admin_credentials() -> tuple[str, str]:
    creds_file = Path("/app/memory/test_credentials.md")
    text = creds_file.read_text(encoding="utf-8") if creds_file.exists() else ""
    match = re.search(r"Giriş:\s*`([^`]+)`\s*/\s*`([^`]+)`", text)
    if not match:
        raise RuntimeError("Admin credentials not found in /app/memory/test_credentials.md")
    return match.group(1).strip(), match.group(2).strip()


BASE_URL = _public_base_url()
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api_client():
    # Shared API client for feed/auth checks
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def admin_session(api_client):
    # Admin auth flow for protected-session feed behavior
    admin_email, admin_password = _read_admin_credentials()
    response = api_client.post(
        f"{API}/auth/login",
        json={"identifier": admin_email, "password": admin_password},
        timeout=30,
    )
    assert response.status_code == 200, f"admin login failed: {response.status_code} {response.text}"
    data = response.json()
    assert data.get("session_token")
    assert data.get("user", {}).get("is_admin") is True
    return data


@pytest.fixture(scope="module")
def excluded_question_ids_from_db():
    # DB-level visibility candidates to verify they never leak to /feed
    mongo_url = _read_env_value(Path("/app/backend/.env"), "MONGO_URL")
    db_name = _read_env_value(Path("/app/backend/.env"), "DB_NAME")
    if not mongo_url or not db_name:
        pytest.skip("Backend Mongo env values are missing")

    client = MongoClient(mongo_url)
    db = client[db_name]
    docs = list(
        db.questions.find(
            {
                "$or": [
                    {"is_published": {"$ne": True}},
                    {"is_active": {"$ne": True}},
                    {"is_hidden": True},
                    {"is_deleted": True},
                ]
            },
            {"_id": 0, "question_id": 1},
        )
    )
    client.close()
    return {doc["question_id"] for doc in docs if doc.get("question_id")}


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _fetch_feed(api_client, limit: int, token: str | None = None, category: str | None = None):
    params = {"limit": str(limit)}
    if category:
        params["category"] = category
    headers = _auth_headers(token) if token else None

    response = api_client.get(f"{API}/feed", params=params, headers=headers, timeout=30)
    if response.status_code != 200:
        response = api_client.get(f"{API}/feed", params=params, headers=headers, timeout=30)
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body, list)
    return body


class TestFeedAndAuthJanuaryScope:
    def test_admin_login_then_feed_access_opens(self, api_client, admin_session):
        token = admin_session["session_token"]
        batch = _fetch_feed(api_client, limit=6, token=token)
        assert len(batch) > 0
        assert all("question_id" in q for q in batch)

    def test_feed_never_returns_hidden_inactive_deleted_unpublished(self, api_client, excluded_question_ids_from_db):
        if not excluded_question_ids_from_db:
            pytest.skip("No excluded questions in DB to validate against")

        seen_ids = set()
        for _ in range(4):
            batch = _fetch_feed(api_client, limit=20)
            seen_ids.update({item.get("question_id") for item in batch if item.get("question_id")})

        leaked = seen_ids.intersection(excluded_question_ids_from_db)
        assert leaked == set(), f"Excluded questions leaked to feed: {sorted(leaked)}"

    def test_three_consecutive_batches_have_no_repeated_ids_same_session(self, api_client):
        # Fresh session to avoid prior feed_seen history from other tests.
        guest_login = api_client.post(f"{API}/auth/guest", json={"name": "TEST_batch_guest_v8"}, timeout=30)
        assert guest_login.status_code == 200, guest_login.text
        token = guest_login.json()["session_token"]
        b1 = _fetch_feed(api_client, limit=6, token=token)
        b2 = _fetch_feed(api_client, limit=6, token=token)
        b3 = _fetch_feed(api_client, limit=6, token=token)

        ids1 = [q["question_id"] for q in b1]
        ids2 = [q["question_id"] for q in b2]
        ids3 = [q["question_id"] for q in b3]

        assert len(set(ids1)) == len(ids1)
        assert len(set(ids2)) == len(ids2)
        assert len(set(ids3)) == len(ids3)

        assert set(ids1).isdisjoint(set(ids2)), f"Batch1↔Batch2 overlaps: {set(ids1).intersection(ids2)}"
        assert set(ids1).isdisjoint(set(ids3)), f"Batch1↔Batch3 overlaps: {set(ids1).intersection(ids3)}"
        assert set(ids2).isdisjoint(set(ids3)), f"Batch2↔Batch3 overlaps: {set(ids2).intersection(ids3)}"

    def test_category_bilim_returns_only_bilim(self, api_client, admin_session):
        token = admin_session["session_token"]
        batch = _fetch_feed(api_client, limit=12, token=token, category="Bilim")
        assert len(batch) > 0
        assert all(item.get("category") == "Bilim" for item in batch)

    def test_guest_login_endpoint_regression(self, api_client):
        response = api_client.post(f"{API}/auth/guest", json={"name": "TEST_guest_v8"}, timeout=30)
        assert response.status_code == 200, response.text
        body = response.json()
        assert body.get("session_token")
        assert body.get("user", {}).get("is_guest") is True

    def test_register_request_code_contract_regression(self, api_client):
        # Register screen API contract: missing mandatory fields must return validation error.
        response = api_client.post(
            f"{API}/auth/register/request-code",
            json={"name": "TEST", "email": "invalid@example.com", "password": "Abc123!@#"},
            timeout=30,
        )
        assert response.status_code == 422, response.text
