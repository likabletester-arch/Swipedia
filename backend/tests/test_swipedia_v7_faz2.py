"""
Faz 2 backend tests for Swipedia:
- Like toggle
- Follow toggle
- Bio update
- Regression (feed liked field, guest, save toggle, profile)
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://micro-genius-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

STANDARD_IDENT = "swipedia-test@example.com"
STANDARD_PASS = "secret123"
ADMIN_IDENT = "official@swipedia.app"
ADMIN_PASS = "swipedia123"


@pytest.fixture(scope="module")
def standard_session():
    r = requests.post(f"{API}/auth/login", json={"identifier": STANDARD_IDENT, "password": STANDARD_PASS}, timeout=20)
    assert r.status_code == 200, f"standard login failed: {r.status_code} {r.text}"
    body = r.json()
    return {"token": body["session_token"], "user": body["user"]}


@pytest.fixture(scope="module")
def admin_session():
    r = requests.post(f"{API}/auth/login", json={"identifier": ADMIN_IDENT, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    body = r.json()
    return {"token": body["session_token"], "user": body["user"]}


def auth_h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Like toggle ----------

class TestLikeToggle:
    def test_feed_has_liked_field_unauth(self):
        r = requests.get(f"{API}/feed", timeout=20)
        assert r.status_code == 200
        feed = r.json()
        assert isinstance(feed, list) and len(feed) > 0
        q0 = feed[0]
        assert "liked" in q0, "Feed item missing 'liked' field"
        assert q0["liked"] is False, "Unauth feed should have liked=False"
        assert "likes" in q0

    def test_like_toggle_cycle(self, standard_session):
        token = standard_session["token"]
        # pick a question not authored by self (any editorial question)
        feed = requests.get(f"{API}/feed", timeout=20).json()
        assert len(feed) > 0
        qid = feed[0]["question_id"]
        start_likes = int(feed[0]["likes"])
        start_liked = feed[0]["liked"]  # may be False

        # Ensure a known starting state: if liked, unlike first
        if feed[0]["liked"] is False:
            # first call -> like
            r1 = requests.post(f"{API}/questions/{qid}/like", headers=auth_h(token), timeout=20)
            assert r1.status_code == 200, r1.text
            b1 = r1.json()
            assert b1["liked"] is True
            assert b1["likes"] == start_likes + 1

            # second call -> unlike
            r2 = requests.post(f"{API}/questions/{qid}/like", headers=auth_h(token), timeout=20)
            assert r2.status_code == 200, r2.text
            b2 = r2.json()
            assert b2["liked"] is False
            assert b2["likes"] == start_likes
        else:
            # already liked, unlike then like
            r1 = requests.post(f"{API}/questions/{qid}/like", headers=auth_h(token), timeout=20)
            assert r1.status_code == 200
            assert r1.json()["liked"] is False
            r2 = requests.post(f"{API}/questions/{qid}/like", headers=auth_h(token), timeout=20)
            assert r2.status_code == 200
            assert r2.json()["liked"] is True

    def test_feed_reflects_liked_state_authed(self, standard_session):
        token = standard_session["token"]
        feed = requests.get(f"{API}/feed", timeout=20).json()
        qid = feed[0]["question_id"]
        # Like it
        r1 = requests.post(f"{API}/questions/{qid}/like", headers=auth_h(token), timeout=20)
        assert r1.status_code == 200
        liked_after = r1.json()["liked"]
        likes_after = r1.json()["likes"]

        # Re-fetch feed with auth
        r2 = requests.get(f"{API}/feed", headers=auth_h(token), timeout=20)
        assert r2.status_code == 200
        feed2 = r2.json()
        match = next((q for q in feed2 if q["question_id"] == qid), None)
        assert match is not None
        assert match["liked"] is liked_after
        assert match["likes"] == likes_after

        # Toggle back to clean state
        requests.post(f"{API}/questions/{qid}/like", headers=auth_h(token), timeout=20)

    def test_like_nonexistent_returns_404(self, standard_session):
        token = standard_session["token"]
        r = requests.post(f"{API}/questions/nonexistent_q_zzz/like", headers=auth_h(token), timeout=20)
        assert r.status_code == 404, r.text

    def test_like_own_question_no_crash(self, standard_session):
        """Create a question as the standard user and like it (self-like must not error)."""
        token = standard_session["token"]
        payload = {
            "category": "Bilim",
            "text": "TEST_selflike_v7 Faz2 kendi sorusu kontrolü nedir?",
            "options": ["A", "B", "C", "D"],
            "correct_index": 0,
            "explanation": "TEST_selflike_v7",
            "difficulty": "kolay",
        }
        rc = requests.post(f"{API}/questions", headers=auth_h(token), json=payload, timeout=20)
        assert rc.status_code == 200, rc.text
        qid = rc.json()["question_id"]
        rl = requests.post(f"{API}/questions/{qid}/like", headers=auth_h(token), timeout=20)
        assert rl.status_code == 200, rl.text
        assert rl.json()["liked"] is True
        # toggle off
        rl2 = requests.post(f"{API}/questions/{qid}/like", headers=auth_h(token), timeout=20)
        assert rl2.status_code == 200
        assert rl2.json()["liked"] is False


# ---------- Follow toggle ----------

class TestFollowToggle:
    def test_follow_cycle_and_profile_sync(self, standard_session, admin_session):
        token = standard_session["token"]
        admin_id = admin_session["user"]["user_id"]
        own_id = standard_session["user"]["user_id"]

        # determine initial state by checking profile first
        p0 = requests.get(f"{API}/users/{admin_id}/profile", headers=auth_h(token), timeout=20)
        assert p0.status_code == 200
        initial_following = p0.json()["user"]["is_following"]
        initial_followers = p0.json()["user"]["followers_count"]

        # Normalize to not-following
        if initial_following:
            r_un = requests.post(f"{API}/users/{admin_id}/follow", headers=auth_h(token), timeout=20)
            assert r_un.status_code == 200 and r_un.json()["following"] is False
            initial_followers -= 1

        # First call -> follow
        r1 = requests.post(f"{API}/users/{admin_id}/follow", headers=auth_h(token), timeout=20)
        assert r1.status_code == 200, r1.text
        b1 = r1.json()
        assert b1["following"] is True
        assert b1["is_following"] is True
        assert b1["followers_count"] == initial_followers + 1
        assert "following_count" in b1

        # Profile reflects it, plus questions list present
        p1 = requests.get(f"{API}/users/{admin_id}/profile", headers=auth_h(token), timeout=20)
        assert p1.status_code == 200
        pbody = p1.json()
        assert pbody["user"]["is_following"] is True
        assert pbody["user"]["followers_count"] == initial_followers + 1
        assert "questions" in pbody and isinstance(pbody["questions"], list)
        # Admin seeded 750 official questions; sanity: at least a few
        assert len(pbody["questions"]) >= 10, f"expected admin to have shared questions, got {len(pbody['questions'])}"

        # /auth/me reflects following_count increase
        me = requests.get(f"{API}/auth/me", headers=auth_h(token), timeout=20)
        assert me.status_code == 200
        me_user = me.json()["user"]
        assert "following_count" in me_user
        assert me_user["following_count"] >= 1

        # Second call -> unfollow
        r2 = requests.post(f"{API}/users/{admin_id}/follow", headers=auth_h(token), timeout=20)
        assert r2.status_code == 200
        assert r2.json()["following"] is False
        assert r2.json()["followers_count"] == initial_followers

        # Restore if the test started as following
        if initial_following:
            requests.post(f"{API}/users/{admin_id}/follow", headers=auth_h(token), timeout=20)

    def test_follow_creates_notification(self, standard_session, admin_session):
        """After follow, target user should get a 'follow' type notification.
        We follow from standard user to admin user, then login as admin and check /api/notifications.
        """
        std_token = standard_session["token"]
        admin_token = admin_session["token"]
        admin_id = admin_session["user"]["user_id"]

        # Ensure not following first (normalize)
        p0 = requests.get(f"{API}/users/{admin_id}/profile", headers=auth_h(std_token), timeout=20).json()
        if p0["user"]["is_following"]:
            requests.post(f"{API}/users/{admin_id}/follow", headers=auth_h(std_token), timeout=20)

        # Follow
        r = requests.post(f"{API}/users/{admin_id}/follow", headers=auth_h(std_token), timeout=20)
        assert r.status_code == 200 and r.json()["following"] is True

        # Admin fetches notifications
        n = requests.get(f"{API}/notifications", headers=auth_h(admin_token), timeout=20)
        assert n.status_code == 200
        notifs = n.json()
        follow_notifs = [x for x in notifs if x.get("type") == "follow"]
        assert len(follow_notifs) > 0, "No follow notification created for target"

        # Cleanup unfollow
        requests.post(f"{API}/users/{admin_id}/follow", headers=auth_h(std_token), timeout=20)

    def test_follow_self_returns_400(self, standard_session):
        token = standard_session["token"]
        own_id = standard_session["user"]["user_id"]
        r = requests.post(f"{API}/users/{own_id}/follow", headers=auth_h(token), timeout=20)
        assert r.status_code == 400, r.text

    def test_follow_nonexistent_returns_404(self, standard_session):
        token = standard_session["token"]
        r = requests.post(f"{API}/users/nonexistent_user_zzz/follow", headers=auth_h(token), timeout=20)
        assert r.status_code == 404, r.text


# ---------- Bio update ----------

class TestBioUpdate:
    def test_update_bio_and_persist(self, standard_session):
        token = standard_session["token"]
        own_id = standard_session["user"]["user_id"]
        new_bio = "Merhaba 👋 #merak"
        r = requests.patch(f"{API}/users/me", headers=auth_h(token), json={"bio": new_bio}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["bio"] == new_bio

        me = requests.get(f"{API}/auth/me", headers=auth_h(token), timeout=20)
        assert me.status_code == 200
        assert me.json()["user"]["bio"] == new_bio

        prof = requests.get(f"{API}/users/{own_id}/profile", timeout=20)
        assert prof.status_code == 200
        assert prof.json()["user"]["bio"] == new_bio


# ---------- Regression ----------

class TestRegression:
    def test_guest_login_works(self):
        r = requests.post(f"{API}/auth/guest", json={"name": "TEST_guest_v7"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "session_token" in body and "user" in body
        assert body["user"]["is_guest"] is True

    def test_save_toggle_still_works(self, standard_session):
        token = standard_session["token"]
        feed = requests.get(f"{API}/feed", timeout=20).json()
        qid = feed[0]["question_id"]
        r1 = requests.post(f"{API}/questions/{qid}/save", headers=auth_h(token), timeout=20)
        assert r1.status_code == 200
        s1 = r1.json()["saved"]
        r2 = requests.post(f"{API}/questions/{qid}/save", headers=auth_h(token), timeout=20)
        assert r2.status_code == 200
        assert r2.json()["saved"] is (not s1)

    def test_admin_profile_has_follow_fields_and_questions(self, admin_session, standard_session):
        admin_id = admin_session["user"]["user_id"]
        token = standard_session["token"]
        r = requests.get(f"{API}/users/{admin_id}/profile", headers=auth_h(token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        for key in ("followers_count", "following_count", "is_following", "bio", "questions_count"):
            assert key in body["user"], f"missing {key} on profile.user"
        assert "questions" in body and isinstance(body["questions"], list)
        # questions_count should match len(questions) (admin seeded 750)
        assert body["user"]["questions_count"] >= 10

    def test_auth_me_has_faz2_fields(self, standard_session):
        token = standard_session["token"]
        r = requests.get(f"{API}/auth/me", headers=auth_h(token), timeout=20)
        assert r.status_code == 200
        u = r.json()["user"]
        for key in ("followers_count", "following_count", "questions_count", "bio"):
            assert key in u, f"missing {key} on /auth/me.user"
        assert isinstance(u["followers_count"], int)
        assert isinstance(u["following_count"], int)
        assert isinstance(u["questions_count"], int)

    def test_comment_flow_regression(self, standard_session):
        token = standard_session["token"]
        feed = requests.get(f"{API}/feed", timeout=20).json()
        qid = feed[0]["question_id"]
        payload = {"text": "TEST_v7_comment yorumu"}
        r = requests.post(f"{API}/questions/{qid}/comments", headers=auth_h(token), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["text"] == payload["text"]
        # List comments
        rl = requests.get(f"{API}/questions/{qid}/comments", timeout=20)
        assert rl.status_code == 200
        assert any(c["text"] == payload["text"] for c in rl.json())
