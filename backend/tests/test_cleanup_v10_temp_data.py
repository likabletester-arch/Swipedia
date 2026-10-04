"""Cleanup-only test to remove temporary moderation UI questions created during testing."""

from __future__ import annotations

import os
import re
from pathlib import Path

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
        raise RuntimeError("Missing admin/normal credentials")
    return {
        "admin_identifier": admin.group(1).strip(),
        "admin_password": admin.group(2).strip(),
        "normal_identifier": normal.group(1).strip(),
        "normal_password": normal.group(2).strip(),
    }


BASE_URL = _public_base_url()
API = f"{BASE_URL}/api"


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_cleanup_ui_temp_questions():
    # Cleanup scope: remove questions created by this test agent with TEST UI prefix
    creds = _read_credentials()
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})

    normal_login = s.post(
        f"{API}/auth/login",
        json={"identifier": creds["normal_identifier"], "password": creds["normal_password"]},
        timeout=30,
    )
    assert normal_login.status_code == 200, normal_login.text
    normal_token = normal_login.json()["session_token"]

    my_q = s.get(f"{API}/my-questions", headers=_auth_headers(normal_token), timeout=30)
    assert my_q.status_code == 200, my_q.text
    mine = my_q.json()

    target_ids = [
        q.get("question_id")
        for q in mine
        if isinstance(q.get("text"), str)
        and q["text"].startswith("TEST UI moderation question")
        and q.get("question_id")
    ]

    for qid in target_ids:
        delete_response = s.delete(f"{API}/questions/{qid}", headers=_auth_headers(normal_token), timeout=30)
        assert delete_response.status_code == 200, delete_response.text
