"""Swipedia resmî soru kütüphanesi tohumlama scripti.

- "swipedia" kullanıcı adlı hesabı bulur (yoksa oluşturur), resmî/admin olarak işaretler
  (uygulama ikonu avatar, doğrulanmış rozet, puan muafiyeti).
- Mevcut TÜM soruları ve bağımlı verileri (yanıtlar, kayıtlar, yorumlar) temizler.
- seed_data/official_questions.json içindeki soruları swipedia hesabı adına ekler.

Çalıştırma:  python seed_questions.py
Tekrar çalıştırılabilir (idempotent).
"""
import asyncio
import json
import os
import random
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

DATA_FILE = ROOT / "seed_data" / "official_questions.json"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_admin(db) -> dict:
    user = await db.users.find_one({"username": "swipedia"})
    patch = {
        "name": "Swipedia",
        "avatar": "app_logo",
        "verified": True,
        "is_admin": True,
    }
    if user:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": patch})
        user.update(patch)
        print(f"Admin güncellendi: {user['user_id']} (@swipedia)")
        return user
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "username": "swipedia",
        "email": "official@swipedia.app",
        "provider": "password",
        "bio": "Resmî Swipedia hesabı.",
        "points": 0.0,
        "point_progress": 0,
        "correct_count": 0,
        "saved_count": 0,
        "created_at": now_utc(),
        **patch,
    }
    await db.users.insert_one(user.copy())
    print(f"Admin oluşturuldu: {user['user_id']} (@swipedia)")
    return user


async def main() -> None:
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    admin = await ensure_admin(db)

    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    print(f"Yüklenecek soru sayısı: {len(data)}")

    # Mevcut tüm soruları ve bağımlı verileri temizle
    await db.questions.delete_many({})
    await db.answers.delete_many({})
    await db.saved_questions.delete_many({})
    await db.comments.delete_many({})
    await db.users.update_many({}, {"$set": {"saved_count": 0}})
    print("Eski sorular ve bağımlı veriler (yanıt/kayıt/yorum) temizlendi.")

    # Karıştır ki akışın ilk 100'ü kategoriler arası karışık olsun
    random.shuffle(data)
    base = now_utc()

    docs = []
    for index, q in enumerate(data):
        docs.append({
            "question_id": f"q_{uuid.uuid4().hex[:12]}",
            "category": q["category"],
            "text": q["text"],
            "options": q["options"],
            "correct_index": q["correct_index"],
            "explanation": "",
            "difficulty": q.get("difficulty", "orta"),
            "background": None,
            "author_id": admin["user_id"],
            "author_name": "Swipedia",
            "author_username": "swipedia",
            "author_avatar": "app_logo",
            "author_verified": True,
            "likes": 0,
            "saves_count": 0,
            "shares_count": 0,
            "comments_count": 0,
            "created_at": base - timedelta(seconds=index),
        })

    await db.questions.insert_many(docs)
    total = await db.questions.count_documents({})
    print(f"Tamamlandı. Toplam soru: {total}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
