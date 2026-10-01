"""
Swipedia v6 — Verified registration + settings account editing tests.

Covers:
- Registration flow (request-code / verify) incl. 409 + 422 errors
- Login still works with new fields (is_guest, phone, email_verified)
- Guest auth returns is_guest=true
- Answer endpoint returns answered_count (guest increments)
- Password change (403 wrong, 200 correct, restored to secret123)
- Contact change request/confirm (email taken 409, guest 400, wrong code 400)
- PATCH /users/me with avatar
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

TEST_EMAIL = "swipedia-test@example.com"
TEST_PASSWORD = "secret123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def test_user_token(session):
    r = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["session_token"], r.json()["user"]


@pytest.fixture(scope="session")
def guest_token(session):
    r = session.post(f"{API}/auth/guest", json={})
    assert r.status_code == 200
    data = r.json()
    return data["session_token"], data["user"]


# -------- Register: request-code --------
class TestRegisterRequestCode:
    def test_duplicate_email_409(self, session):
        r = session.post(f"{API}/auth/register/request-code", json={
            "email": TEST_EMAIL, "phone": "+905551112233", "password": "pass1234"
        })
        assert r.status_code == 409, r.text
        assert "zaten" in r.json()["detail"].lower()

    def test_missing_phone_422(self, session):
        r = session.post(f"{API}/auth/register/request-code", json={
            "email": f"TEST_newuser_{uuid.uuid4().hex[:8]}@example.com",
            "password": "pass1234"
        })
        assert r.status_code == 422

    def test_short_password_422(self, session):
        r = session.post(f"{API}/auth/register/request-code", json={
            "email": f"TEST_newuser_{uuid.uuid4().hex[:8]}@example.com",
            "phone": "+905551112233",
            "password": "abc"
        })
        assert r.status_code == 422

    def test_short_phone_422(self, session):
        r = session.post(f"{API}/auth/register/request-code", json={
            "email": f"TEST_newuser_{uuid.uuid4().hex[:8]}@example.com",
            "phone": "12345",
            "password": "pass1234"
        })
        assert r.status_code == 422

    def test_unused_email_ok(self, session):
        """Request a code for a brand-new email. Should return {ok:true}.
        We cannot read the actual OTP so cannot complete registration."""
        email = f"TEST_newuser_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{API}/auth/register/request-code", json={
            "email": email, "phone": "+905551112233", "password": "pass1234"
        })
        # Email send may fail in test env due to missing EMERGENT_EMAIL_KEY etc.
        # In that case the endpoint will raise; capture to flag but accept 200.
        if r.status_code != 200:
            pytest.skip(f"email send unavailable in test env: {r.status_code} {r.text[:200]}")
        assert r.json() == {"ok": True}


# -------- Register: verify --------
class TestRegisterVerify:
    def test_wrong_code_400(self, session):
        # Random email with no pending code, or wrong code -> 400, no user created.
        email = f"TEST_verify_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{API}/auth/register/verify", json={"email": email, "code": "000000"})
        assert r.status_code == 400, r.text

        # Verify user NOT created: attempt login should fail
        login = session.post(f"{API}/auth/login", json={"email": email, "password": "whatever"})
        assert login.status_code == 401


# -------- Login + new fields --------
class TestLoginFields:
    def test_login_has_new_fields(self, test_user_token):
        _, user = test_user_token
        assert user["is_guest"] is False
        assert "phone" in user
        assert "email_verified" in user
        # phone may be '' if the test account was created before phone field; just ensure the key exists
        assert isinstance(user.get("phone", ""), str)
        assert isinstance(user.get("email_verified", False), bool)


# -------- Guest --------
class TestGuest:
    def test_guest_is_guest_true(self, guest_token):
        _, user = guest_token
        assert user["is_guest"] is True


# -------- Answer: answered_count --------
class TestAnswerCount:
    def test_guest_answer_increments_count(self, session, guest_token):
        token, _ = guest_token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        feed = session.get(f"{API}/feed", headers=headers)
        assert feed.status_code == 200
        questions = feed.json()
        if not questions:
            pytest.skip("No questions in feed")
        qid = questions[0]["question_id"]

        r1 = session.post(f"{API}/questions/{qid}/answer", json={"option_index": 0}, headers=headers)
        assert r1.status_code == 200, r1.text
        body1 = r1.json()
        assert "answered_count" in body1
        assert isinstance(body1["answered_count"], int)
        assert body1["answered_count"] >= 1

        # answering another question (if exists) should further increment
        if len(questions) > 1:
            qid2 = questions[1]["question_id"]
            r2 = session.post(f"{API}/questions/{qid2}/answer", json={"option_index": 0}, headers=headers)
            assert r2.status_code == 200
            body2 = r2.json()
            assert body2["answered_count"] >= body1["answered_count"] + 1


# -------- Password change --------
class TestPasswordChange:
    def test_wrong_current_password_403(self, session, test_user_token):
        token, _ = test_user_token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = session.post(f"{API}/users/me/password",
                         json={"current_password": "WRONG_PASS", "new_password": "newpass1"},
                         headers=headers)
        assert r.status_code == 403, r.text

    def test_correct_password_change_and_restore(self, session, test_user_token):
        token, _ = test_user_token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        new_pw = "tempPass_" + uuid.uuid4().hex[:6]
        r = session.post(f"{API}/users/me/password",
                         json={"current_password": TEST_PASSWORD, "new_password": new_pw},
                         headers=headers)
        assert r.status_code == 200, r.text
        assert r.json() == {"ok": True}

        # Login with new password works
        l = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": new_pw})
        assert l.status_code == 200

        # Restore
        restore = session.post(f"{API}/users/me/password",
                               json={"current_password": new_pw, "new_password": TEST_PASSWORD},
                               headers=headers)
        assert restore.status_code == 200
        # Verify restored
        l2 = session.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert l2.status_code == 200


# -------- Request contact-change-code --------
class TestRequestChangeCode:
    def test_request_change_email_ok(self, session, test_user_token):
        token, _ = test_user_token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        unique = f"TEST_newmail_{uuid.uuid4().hex[:8]}@example.com"
        r = session.post(f"{API}/users/me/request-change-code",
                         json={"field": "email", "value": unique},
                         headers=headers)
        if r.status_code != 200:
            pytest.skip(f"email send unavailable in test env: {r.status_code} {r.text[:200]}")
        assert r.json() == {"ok": True}

    def test_request_change_email_taken_409(self, session, test_user_token):
        token, _ = test_user_token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        # Create a second user whose email we will try to steal.
        taken_email = f"TEST_taken_{uuid.uuid4().hex[:8]}@example.com"
        reg = session.post(f"{API}/auth/register", json={
            "email": taken_email, "password": "pass1234", "name": "TEST Taken"
        })
        assert reg.status_code == 200

        r = session.post(f"{API}/users/me/request-change-code",
                         json={"field": "email", "value": taken_email},
                         headers=headers)
        assert r.status_code == 409, r.text

    def test_request_change_email_as_guest_400(self, session, guest_token):
        token, _ = guest_token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = session.post(f"{API}/users/me/request-change-code",
                         json={"field": "email", "value": "any@example.com"},
                         headers=headers)
        assert r.status_code == 400, r.text


# -------- Confirm contact change (wrong code) --------
class TestConfirmChange:
    def test_wrong_code_400(self, session, test_user_token):
        token, _ = test_user_token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        r = session.post(f"{API}/users/me/confirm-change",
                         json={"field": "email", "code": "000000"},
                         headers=headers)
        assert r.status_code == 400, r.text


# -------- PATCH /users/me avatar --------
class TestPatchAvatar:
    def test_patch_avatar(self, session, test_user_token):
        token, _ = test_user_token
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        avatar_path = f"some/path/avatar_{uuid.uuid4().hex[:6]}.jpg"
        r = session.patch(f"{API}/users/me", json={"avatar": avatar_path}, headers=headers)
        assert r.status_code == 200, r.text
        user = r.json()["user"]
        assert user["avatar"] == avatar_path

        # Confirm persistence via /auth/me
        me = session.get(f"{API}/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["user"]["avatar"] == avatar_path
