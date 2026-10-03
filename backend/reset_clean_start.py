"""Tek seferlik temiz başlangıç komutu.

Çalıştırma: CONFIRM_CLEAN_START=ERASE_TEST_DATA python reset_clean_start.py
Bu komut uygulama başlangıcında ASLA otomatik çalışmaz.
"""
import asyncio
import os

from server import client, db, ensure_bootstrap_admin


COLLECTIONS = (
    "answers", "comments", "conversations", "feed_cycle_state", "feed_seen", "follows",
    "messages", "notifications", "question_likes", "questions", "saved_questions", "uploads",
    "user_sessions", "users", "verification_codes",
)


async def main() -> None:
    if os.environ.get("CONFIRM_CLEAN_START") != "ERASE_TEST_DATA":
        raise SystemExit("Temiz başlangıç onayı eksik")
    for collection in COLLECTIONS:
        await db[collection].delete_many({})
    await ensure_bootstrap_admin()
    users = await db.users.count_documents({})
    admins = await db.users.count_documents({"is_admin": True, "role": "admin"})
    questions = await db.questions.count_documents({})
    if (users, admins, questions) != (1, 1, 0):
        raise RuntimeError(f"Temiz başlangıç doğrulanamadı: users={users}, admins={admins}, questions={questions}")
    print("Temiz başlangıç tamamlandı: 1 admin, 0 normal kullanıcı, 0 soru")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())