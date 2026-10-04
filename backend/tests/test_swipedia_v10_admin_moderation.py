"""
Admin moderation authorization and suspension workflow tests:
- moderation summary visibility by role
- admin-only question deletion for target user
- suspension/unsuspension effects on question creation
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import pytest
import requests


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
            return match.group(1).strip().strip('"').strip("'")
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


def _read_credentials() -> dict:
    text = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")

    admin = re.search(r"Gerçek başlangıç admin hesabı\s*- Giriş:\s*`([^`]+)`\s*/\s*`([^`]+)`", text, re.S)
    normal = re.search(r"Geçici moderasyon testi[^\n]*\n- Giriş:\s*`([^`]+)`\s*/\s*`([^`]+)`", text)

    if not admin or not normal:
        raise RuntimeError("Required admin/normal credentials are missing in /app/memory/test_credentials.md")

    return {
        "admin_identifier": admin.group(1).strip(),
        "admin_password": admin.group(2).strip(),
        "normal_identifier": normal.group(1).strip(),
        "normal_password": normal.group(2).strip(),
    }


BASE_URL = _public_base_url()
API = f"{BASE_URL}/api"
TARGET_USER_ID = os.environ.get("TARGET_NORMAL_USER_ID", "user_f7d75d8d46fc")


@pytest.fixture(scope="module")
def api_client():
    # Shared HTTP session for moderation API checks
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def creds():
    # Parse test credentials file for admin + temporary normal account
    return _read_credentials()


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_session(api_client, creds):
    # Admin login session for protected moderation endpoints
    response = api_client.post(
        f"{API}/auth/login",
        json={"identifier": creds["admin_identifier"], "password": creds["admin_password"]},
        timeout=30,
    )
    assert response.status_code == 200, f"admin login failed: {response.status_code} {response.text}"
    payload = response.json()
    assert payload.get("session_token")
    assert payload.get("user", {}).get("is_admin") is True
    return payload


@pytest.fixture(scope="module")
def normal_session(api_client, creds):
    # Normal learner login session for forbidden-path checks
    response = api_client.post(
        f"{API}/auth/login",
        json={"identifier": creds["normal_identifier"], "password": creds["normal_password"]},
        timeout=30,
    )
    if response.status_code != 200:
        pytest.skip(f"normal login failed, skipping moderation tests: {response.status_code} {response.text}")
    payload = response.json()
    assert payload.get("session_token")
    assert payload.get("user", {}).get("is_admin") is False
    return payload


@pytest.fixture(scope="module")
def guest_session(api_client):
    # Guest session for forbidden moderation access checks
    response = api_client.post(f"{API}/auth/guest", json={"name": "TEST_mod_guest_v10"}, timeout=30)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload.get("user", {}).get("is_guest") is True
    return payload


@pytest.fixture(scope="module")
def created_question_ids():
    # Track temporary created questions for explicit cleanup/assertions
    return []


class TestAdminModeration:
    def test_admin_get_moderation_200(self, api_client, admin_session):
        response = api_client.get(
            f"{API}/admin/users/{TARGET_USER_ID}/moderation",
            headers=_auth_headers(admin_session["session_token"]),
            timeout=30,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body.get("user", {}).get("user_id") == TARGET_USER_ID
        assert isinstance(body.get("questions"), list)

    def test_normal_get_moderation_forbidden(self, api_client, normal_session):
        response = api_client.get(
            f"{API}/admin/users/{TARGET_USER_ID}/moderation",
            headers=_auth_headers(normal_session["session_token"]),
            timeout=30,
        )
        assert response.status_code == 403, response.text

    def test_guest_get_moderation_forbidden(self, api_client, guest_session):
        response = api_client.get(
            f"{API}/admin/users/{TARGET_USER_ID}/moderation",
            headers=_auth_headers(guest_session["session_token"]),
            timeout=30,
        )
        assert response.status_code == 403, response.text

    def test_normal_cannot_delete_other_users_question_403(self, api_client, normal_session, admin_session):
        moderation = api_client.get(
            f"{API}/admin/users/{TARGET_USER_ID}/moderation",
            headers=_auth_headers(normal_session["session_token"]),
            timeout=30,
        )
        assert moderation.status_code == 403

        admin_question_payload = {
            "category": "Bilim",
            "text": "TEST_v10 admin owned question for forbidden delete",
            "options": ["A", "B", "C", "D"],
            "correct_index": 0,
            "explanation": "test",
            "difficulty": "kolay",
        }
        created = api_client.post(
            f"{API}/questions",
            headers=_auth_headers(admin_session["session_token"]),
            json=admin_question_payload,
            timeout=30,
        )
        assert created.status_code == 200, created.text
        qid = created.json().get("question_id")
        assert qid

        response = api_client.delete(
            f"{API}/questions/{qid}",
            headers=_auth_headers(normal_session["session_token"]),
            timeout=30,
        )
        assert response.status_code == 403, response.text

        cleanup = api_client.delete(
            f"{API}/questions/{qid}",
            headers=_auth_headers(admin_session["session_token"]),
            timeout=30,
        )
        assert cleanup.status_code == 200, cleanup.text

    def test_suspend_blocks_question_create_then_unsuspend(self, api_client, admin_session, normal_session, created_question_ids):
        suspend = api_client.patch(
            f"{API}/admin/users/{TARGET_USER_ID}/suspension",
            headers=_auth_headers(admin_session["session_token"]),
            json={"suspended": True},
            timeout=30,
        )
        assert suspend.status_code == 200, suspend.text
        assert suspend.json().get("account_status") == "suspended"

        create_payload = {
            "category": "Bilim",
            "text": "TEST_v10 askıdayken soru olusturma engeli",
            "options": ["A", "B", "C", "D"],
            "correct_index": 0,
            "explanation": "test",
            "difficulty": "kolay",
        }
        blocked = api_client.post(
            f"{API}/questions",
            headers=_auth_headers(normal_session["session_token"]),
            json=create_payload,
            timeout=30,
        )
        assert blocked.status_code == 403, blocked.text

        unsuspend = api_client.patch(
            f"{API}/admin/users/{TARGET_USER_ID}/suspension",
            headers=_auth_headers(admin_session["session_token"]),
            json={"suspended": False},
            timeout=30,
        )
        assert unsuspend.status_code == 200, unsuspend.text
        assert unsuspend.json().get("account_status") == "active"

        allowed = api_client.post(
            f"{API}/questions",
            headers=_auth_headers(normal_session["session_token"]),
            json={
                "category": "Bilim",
                "text": "TEST_v10 moderation delete cleanup question",
                "options": ["A", "B", "C", "D"],
                "correct_index": 1,
                "explanation": "test cleanup",
                "difficulty": "kolay",
            },
            timeout=30,
        )
        assert allowed.status_code == 200, allowed.text
        qid = allowed.json().get("question_id")
        assert qid
        created_question_ids.append(qid)

    def test_admin_delete_target_question_200(self, api_client, admin_session, created_question_ids):
        if not created_question_ids:
            pytest.skip("No temporary target question available for admin delete")
        qid = created_question_ids[-1]
        response = api_client.delete(
            f"{API}/admin/users/{TARGET_USER_ID}/questions/{qid}",
            headers=_auth_headers(admin_session["session_token"]),
            timeout=30,
        )
        assert response.status_code == 200, response.text
        assert response.json().get("ok") is True

        verify = api_client.get(
            f"{API}/users/{TARGET_USER_ID}/profile",
            timeout=30,
        )
        assert verify.status_code == 200, verify.text
        ids = {q.get("question_id") for q in verify.json().get("questions", [])}
        assert qid not in ids

    def test_admin_self_suspension_forbidden(self, api_client, admin_session):
        admin_id = admin_session["user"]["user_id"]
        response = api_client.patch(
            f"{API}/admin/users/{admin_id}/suspension",
            headers=_auth_headers(admin_session["session_token"]),
            json={"suspended": True},
            timeout=30,
        )
        assert response.status_code == 403, response.text
