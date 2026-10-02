from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
import hashlib
import hmac
import ipaddress
import json
import logging
import os
import re
import secrets
import uuid
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import bcrypt
import httpx
import jwt
import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
SESSION_DAYS = 7

app = FastAPI(title="Swipedia API")
api_router = APIRouter(prefix="/api")
logger = logging.getLogger(__name__)

# --- Emergent Object Storage ---
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "swipedia"
storage_key: Optional[str] = None


def init_storage() -> str:
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> Dict[str, Any]:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# --- Email (Emergent yönetimli Resend) + doğrulama kodları ---
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Swipedia")
APP_SECRET = os.environ.get("APP_SECRET", "swipedia-dev-secret").encode()
CODE_TTL_MINUTES = 10

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def send_email(to: str, subject: str, html: str) -> Optional[str]:
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.post(
            f"{EMAIL_BASE_URL}/api/v1/email/send",
            headers={"X-Email-Key": EMAIL_KEY},
            json=payload,
        )
    resp.raise_for_status()
    return resp.json().get("id")


def _code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _hash_code(code: str) -> str:
    return hmac.new(APP_SECRET, code.encode(), hashlib.sha256).hexdigest()


def _verification_html(code: str, intro: str) -> str:
    return (
        '<table role="presentation" width="100%" style="background:#f4f1ec"><tr><td align="center" style="padding:24px">'
        '<table role="presentation" width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;'
        'font-family:Arial,Helvetica,sans-serif"><tr><td style="padding:28px">'
        '<p style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#FF6B4A;margin:0 0 6px">SWIPEDIA</p>'
        f'<p style="font-size:15px;color:#1f1c18;margin:0 0 14px">{escape(intro)}</p>'
        f'<p style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#1f1c18;margin:0 0 14px">{escape(code)}</p>'
        '<p style="font-size:13px;color:#555;margin:0 0 6px">Bu kod 10 dakika içinde gecerliligini yitirecek. '
        'Kodu kimseyle paylasma.</p>'
        '<p style="font-size:11px;color:#999;margin:14px 0 0">Bu e-posta Swipedia tarafindan gonderildi. '
        'Sifreni ya da kodunu asla e-posta ile geri istemeyiz.</p>'
        '</td></tr></table></td></tr></table>'
    )


async def send_verification_code(to: str, purpose: str, payload: Optional[Dict[str, Any]] = None, key: Optional[str] = None) -> None:
    code = _code()
    ckey = key or to.lower()
    await db.verification_codes.delete_many({"ckey": ckey, "purpose": purpose})
    result = await db.verification_codes.insert_one({
        "ckey": ckey,
        "purpose": purpose,
        "code_hash": _hash_code(code),
        "payload": payload or {},
        "attempts": 0,
        "expires_at": now_utc() + timedelta(minutes=CODE_TTL_MINUTES),
    })
    intros = {
        "register": "Swipedia hesabini olusturmak icin dogrulama kodun:",
        "change_email": "E-posta adresini degistirmek icin dogrulama kodun:",
        "change_phone": "Telefon numarani degistirmek icin dogrulama kodun:",
    }
    subject = "Swipedia dogrulama kodun"
    try:
        await send_email(to, subject, _verification_html(code, intros.get(purpose, "Swipedia dogrulama kodun:")))
    except Exception as exc:
        await db.verification_codes.delete_one({"_id": result.inserted_id})
        logger.warning("Verification email failed for %s: %s", to, exc)
        raise HTTPException(status_code=502, detail="Doğrulama e-postası gönderilemedi. Lütfen e-posta adresini kontrol et.")


async def verify_code(ckey: str, purpose: str, code: str) -> Dict[str, Any]:
    doc = await db.verification_codes.find_one({"ckey": ckey, "purpose": purpose})
    expired = doc and doc["expires_at"].replace(tzinfo=timezone.utc) < now_utc()
    if not doc or expired or doc.get("attempts", 0) >= 5:
        raise HTTPException(status_code=400, detail="Kod geçersiz veya süresi dolmuş. Lütfen yeniden kod iste.")
    if not hmac.compare_digest(doc["code_hash"], _hash_code(code)):
        await db.verification_codes.update_one({"_id": doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Doğrulama kodu hatalı")
    await db.verification_codes.delete_one({"_id": doc["_id"]})
    return doc.get("payload", {})


# --- Points ---
# Rütbe yükseldikçe 1 puan için gereken doğru cevap sayısı artar.
DIFFICULTIES = {"kolay", "orta", "zor", "uzman"}
RANK_RATES = [(1250, 300), (600, 250), (300, 200), (150, 150), (50, 100), (0, 50)]


def rate_for(points: float) -> int:
    for min_points, rate in RANK_RATES:
        if points >= min_points:
            return rate
    return 50

# --- Apple Sign In ---
APPLE_AUDIENCES = [a.strip() for a in os.environ.get("APPLE_AUDIENCES", "").split(",") if a.strip()]
apple_jwks: Optional[Dict[str, Any]] = None

TR_MAP = str.maketrans({"ı": "i", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ç": "c", "İ": "i", "Ş": "s", "Ğ": "g", "Ü": "u", "Ö": "o", "Ç": "c"})


def slugify_username(base: str) -> str:
    slug = re.sub(r"[^a-z0-9_]", "", base.translate(TR_MAP).lower().replace(" ", "_"))
    return slug[:18]


async def unique_username(base: str) -> str:
    slug = slugify_username(base) or "merakli"
    candidate = slug
    while await db.users.find_one({"username": candidate}, {"_id": 0}):
        candidate = f"{slug}{secrets.randbelow(9000) + 1000}"
    return candidate


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "user_id": user["user_id"],
        "name": user.get("name", "Swipedia Öğrencisi"),
        "username": user.get("username", ""),
        "verified": bool(user.get("verified", False)),
        "email": user.get("email", ""),
        "phone": user.get("phone", ""),
        "is_guest": user.get("provider") == "guest",
        "email_verified": bool(user.get("email_verified", False)),
        "avatar": user.get("avatar", ""),
        "bio": user.get("bio", "Curious about everything."),
        "points": int(float(user.get("points", 0))),
        "point_progress": user.get("point_progress", 0),
        "point_rate": rate_for(float(user.get("points", 0))),
        "correct_count": user.get("correct_count", 0),
        "saved_count": user.get("saved_count", 0),
    }


async def create_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": now_utc(),
        "expires_at": now_utc() + timedelta(days=SESSION_DAYS),
    })
    return token


async def get_current_user(request: Request) -> Dict[str, Any]:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = header.removeprefix("Bearer ").strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if expires_at and expires_at.replace(tzinfo=timezone.utc) < now_utc():
        raise HTTPException(status_code=401, detail="Session expired")
    user_id = session["user_id"]
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_optional_user(request: Request) -> Optional[Dict[str, Any]]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=120)
    name: Optional[str] = Field(default=None, max_length=40)


class GoogleSession(BaseModel):
    session_id: str


class AppleSession(BaseModel):
    identity_token: str
    name: Optional[str] = Field(default=None, max_length=80)
    email: Optional[str] = Field(default=None, max_length=120)


class GuestRequest(BaseModel):
    name: Optional[str] = Field(default="Guest Learner", max_length=40)


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=40)
    username: Optional[str] = Field(default=None, min_length=3, max_length=20)
    avatar: Optional[str] = Field(default=None, max_length=300)


class RegisterRequest(BaseModel):
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    password: str = Field(min_length=6, max_length=120)
    name: Optional[str] = Field(default=None, max_length=40)


class RegisterVerify(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=120)


class ContactChangeRequest(BaseModel):
    field: str
    value: str = Field(min_length=3, max_length=120)


class ContactChangeVerify(BaseModel):
    field: str
    code: str = Field(pattern=r"^\d{6}$")


class AnswerRequest(BaseModel):
    option_index: int = Field(ge=0, le=3)


class CommentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)


class QuestionCreate(BaseModel):
    category: str = Field(min_length=2, max_length=30)
    text: str = Field(min_length=5, max_length=240)
    options: List[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str = Field(min_length=2, max_length=320)
    difficulty: str = Field(default="kolay")
    background: Optional[str] = Field(default=None, max_length=500)


class MessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    question_id: Optional[str] = None


STARTER_QUESTIONS = [
    {
        "category": "Tarih",
        "text": "Antik Mısırlılar yazı yazmak için en çok hangi malzemeyi kullandı?",
        "options": ["Papirüs", "İpek", "Kil tablet", "Bambu"],
        "correct_index": 0,
        "explanation": "Papirüs bitkisinden yapılan rulolar, Mısır yazısının ikonik yüzeyiydi.",
        "author_name": "Swipedia Editör",
        "author_username": "swipedia",
        "difficulty": "orta",
        "background": "https://images.unsplash.com/photo-1503177119275-0aa32b3a9368?q=80&w=1080&auto=format&fit=crop",
    },
    {
        "category": "Coğrafya",
        "text": "Muz yetiştiriciliği için aşağıdaki iklimlerden hangisi en uygundur?",
        "options": ["Tropikal", "Kutup", "Çöl", "Tundra"],
        "correct_index": 0,
        "explanation": "Muz; sıcak, nemli ve don riskinin az olduğu tropikal iklimi sever.",
        "author_name": "Dünya Meraklısı",
        "author_username": "dunyameraklisi",
        "difficulty": "kolay",
        "background": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=1080&auto=format&fit=crop",
    },
    {
        "category": "Matematik",
        "text": "Bir sayının %25'i 15 ise bu sayı kaçtır?",
        "options": ["45", "50", "60", "75"],
        "correct_index": 2,
        "explanation": "15'i 0,25'e böldüğümüzde sonuç 60 olur.",
        "author_name": "Sayı Kaşifi",
        "author_username": "sayikasifi",
        "difficulty": "zor",
        "background": None,
    },
    {
        "category": "Dil",
        "text": "İngilizcede 'curious' kelimesinin en yakın anlamı hangisidir?",
        "options": ["Meraklı", "Sessiz", "Hızlı", "Dikkatli"],
        "correct_index": 0,
        "explanation": "Curious, yeni şeyler öğrenmeye istekli ve meraklı demektir.",
        "author_name": "Kelime Gezgini",
        "author_username": "kelimegezgini",
        "difficulty": "kolay",
        "background": "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=1080&auto=format&fit=crop",
    },
    {
        "category": "Bilim",
        "text": "İnsan vücudundaki en büyük organ hangisidir?",
        "options": ["Kalp", "Cilt", "Akciğer", "Karaciğer"],
        "correct_index": 1,
        "explanation": "Cilt, vücudu kaplayan ve koruyan en büyük organdır.",
        "author_name": "Bilim Kulübü",
        "author_username": "bilimkulubu",
        "difficulty": "orta",
        "background": "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?q=80&w=1080&auto=format&fit=crop",
    },
    {
        "category": "Astronomi",
        "text": "Güneş sistemindeki en büyük gezegen hangisidir?",
        "options": ["Mars", "Satürn", "Jüpiter", "Neptün"],
        "correct_index": 2,
        "explanation": "Jüpiter, diğer tüm gezegenlerin toplam kütlesinin 2,5 katına sahiptir.",
        "author_name": "Gökyüzü Takipçisi",
        "author_username": "gokyuzu",
        "difficulty": "kolay",
        "background": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1080&auto=format&fit=crop",
    },
    {
        "category": "Bilim",
        "text": "Işık hızı saniyede yaklaşık kaç kilometredir?",
        "options": ["150.000 km", "300.000 km", "450.000 km", "1.000.000 km"],
        "correct_index": 1,
        "explanation": "Işık boşlukta saniyede yaklaşık 299.792 km yol alır.",
        "author_name": "Fizik Köşesi",
        "author_username": "fizikkosusu",
        "difficulty": "uzman",
        "background": "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1080&auto=format&fit=crop",
    },
]


def question_public(question: Dict[str, Any], saved: bool = False) -> Dict[str, Any]:
    return {
        "question_id": question["question_id"],
        "category": question["category"],
        "text": question["text"],
        "options": question["options"],
        "author_name": question.get("author_name", "Swipedia Öğrencisi"),
        "author_username": question.get("author_username", ""),
        "author_id": question.get("author_id", "editorial"),
        "author_avatar": question.get("author_avatar", ""),
        "author_verified": bool(question.get("author_verified", False)),
        "explanation": question.get("explanation", "Güzel bir keşif!"),
        "difficulty": question.get("difficulty", "kolay"),
        "background": question.get("background"),
        "likes": question.get("likes", 0),
        "saves_count": question.get("saves_count", 0),
        "shares_count": question.get("shares_count", 0),
        "comments_count": question.get("comments_count", 0),
        "saved": saved,
    }


async def seed_database() -> None:
    # Başlangıç soruları kaldırıldı; içerik doğrulanmış admin hesabından yayınlanır.
    # username'si olmayan eski kullanıcılar için geri doldur
    async for old_user in db.users.find({"username": {"$exists": False}}):
        uname = await unique_username(str(old_user.get("email", "user")).split("@")[0])
        await db.users.update_one({"user_id": old_user["user_id"]}, {"$set": {"username": uname}})
    # ondalık puan -> tam sayı geçişi + point_progress geri doldurma
    async for old_user in db.users.find({}):
        fixes = {}
        pts = old_user.get("points", 0)
        if not isinstance(pts, int):
            fixes["points"] = int(float(pts or 0))
        if "point_progress" not in old_user:
            fixes["point_progress"] = 0
        if fixes:
            await db.users.update_one({"user_id": old_user["user_id"]}, {"$set": fixes})
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("username", unique=True, sparse=True)
    await db.users.create_index("apple_sub", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.questions.create_index("question_id", unique=True)
    await db.saved_questions.create_index([("user_id", 1), ("question_id", 1)], unique=True)
    await db.uploads.create_index("path", unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index("notification_id", unique=True)
    await db.verification_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.verification_codes.create_index([("ckey", 1), ("purpose", 1)])


@app.on_event("startup")
async def startup_db() -> None:
    await seed_database()
    try:
        await run_in_threadpool(init_storage)
    except Exception as exc:  # storage kullanılamıyorsa yükleme endpoint'i hata döner
        logger.warning("Object storage init failed: %s", exc)


@api_router.get("/")
async def root() -> Dict[str, str]:
    return {"message": "Swipedia API"}


# ---------- Auth ----------

@api_router.post("/auth/register")
async def register(credentials: Credentials) -> Dict[str, Any]:
    email = str(credentials.email).lower()
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(status_code=409, detail="Bu e-posta zaten kayıtlı")
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": email,
        "name": credentials.name or email.split("@")[0].title(),
        "username": await unique_username(email.split("@")[0]),
        "password_hash": bcrypt.hashpw(credentials.password.encode(), bcrypt.gensalt()).decode(),
        "provider": "password",
        "avatar": "",
        "points": 0.0,
        "correct_count": 0,
        "saved_count": 0,
        "bio": "Meraklı bir Swipedia öğrencisi.",
        "created_at": now_utc(),
    }
    await db.users.insert_one(user.copy())
    await create_notification(user["user_id"], "system", "Swipedia'ya hoş geldin!", "Soruları kaydırarak keşfet, doğru cevapla ve rütbe atla.", "rocket-outline")
    return {"session_token": await create_session(user["user_id"]), "user": public_user(user)}


@api_router.post("/auth/register/request-code")
async def register_request_code(payload: RegisterRequest) -> Dict[str, Any]:
    email = str(payload.email).lower()
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(status_code=409, detail="Bu e-posta zaten kayıtlı")
    phone = re.sub(r"\s+", "", payload.phone)
    data = {
        "email": email,
        "phone": phone,
        "name": payload.name or email.split("@")[0].title(),
        "password_hash": bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode(),
    }
    await send_verification_code(email, "register", payload=data)
    return {"ok": True}


@api_router.post("/auth/register/verify")
async def register_verify(payload: RegisterVerify) -> Dict[str, Any]:
    email = str(payload.email).lower()
    data = await verify_code(email, "register", payload.code)
    if await db.users.find_one({"email": email}, {"_id": 0}):
        raise HTTPException(status_code=409, detail="Bu e-posta zaten kayıtlı")
    user = {
        "user_id": f"user_{uuid.uuid4().hex[:12]}",
        "email": data.get("email", email),
        "phone": data.get("phone", ""),
        "name": data.get("name") or email.split("@")[0].title(),
        "username": await unique_username(email.split("@")[0]),
        "password_hash": data.get("password_hash", ""),
        "provider": "password",
        "email_verified": True,
        "avatar": "",
        "points": 0.0,
        "correct_count": 0,
        "saved_count": 0,
        "bio": "Meraklı bir Swipedia öğrencisi.",
        "created_at": now_utc(),
    }
    await db.users.insert_one(user.copy())
    await create_notification(user["user_id"], "system", "Swipedia'ya hoş geldin!", "Soruları kaydırarak keşfet, doğru cevapla ve rütbe atla.", "rocket-outline")
    return {"session_token": await create_session(user["user_id"]), "user": public_user(user)}


@api_router.post("/auth/login")
async def login(credentials: Credentials) -> Dict[str, Any]:
    user = await db.users.find_one({"email": str(credentials.email).lower()}, {"_id": 0})
    if not user or not user.get("password_hash") or not bcrypt.checkpw(credentials.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    return {"session_token": await create_session(user["user_id"]), "user": public_user(user)}


@api_router.post("/auth/guest")
async def guest(request: GuestRequest) -> Dict[str, Any]:
    guest_id = f"guest_{uuid.uuid4().hex[:12]}"
    user = {
        "user_id": guest_id,
        "email": f"{guest_id}@guest.swipedia.app",
        "name": request.name or "Guest Learner",
        "username": await unique_username(guest_id),
        "provider": "guest",
        "avatar": "",
        "points": 0.0,
        "correct_count": 0,
        "saved_count": 0,
        "bio": "Bugün merak ettim, yarın öğreteceğim.",
        "created_at": now_utc(),
    }
    await db.users.insert_one(user.copy())
    await create_notification(guest_id, "system", "Swipedia'ya hoş geldin!", "Soruları kaydırarak keşfet, doğru cevapla ve rütbe atla.", "rocket-outline")
    return {"session_token": await create_session(guest_id), "user": public_user(user)}


@api_router.post("/auth/session")
async def google_session(payload: GoogleSession) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as http_client:
        response = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
        )
    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Google oturumu doğrulanamadı")
    data = response.json()
    email = str(data.get("email", "")).lower()
    if not email:
        raise HTTPException(status_code=401, detail="Google hesabı e-postası bulunamadı")
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": data.get("name") or email.split("@")[0].title(),
            "username": await unique_username(email.split("@")[0]),
            "avatar": data.get("picture", ""),
            "provider": "google",
            "points": 0.0,
            "correct_count": 0,
            "saved_count": 0,
            "bio": "Meraklı bir Swipedia öğrencisi.",
            "created_at": now_utc(),
        }
        await db.users.insert_one(user.copy())
    return {"session_token": await create_session(user["user_id"]), "user": public_user(user)}


@api_router.post("/auth/apple")
async def apple_session(payload: AppleSession) -> Dict[str, Any]:
    global apple_jwks
    try:
        header = jwt.get_unverified_header(payload.identity_token)
        if not apple_jwks:
            async with httpx.AsyncClient(timeout=10) as http_client:
                apple_jwks = (await http_client.get("https://appleid.apple.com/auth/keys")).json()
        jwk = next(k for k in apple_jwks["keys"] if k["kid"] == header["kid"])
        public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(jwk))
        claims = jwt.decode(payload.identity_token, public_key, algorithms=["RS256"], audience=APPLE_AUDIENCES, issuer="https://appleid.apple.com")
    except Exception:
        raise HTTPException(status_code=401, detail="Apple oturumu doğrulanamadı")
    apple_sub = claims["sub"]
    user = await db.users.find_one({"apple_sub": apple_sub}, {"_id": 0})
    if not user:
        email = (payload.email or claims.get("email") or "").lower()
        user = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "apple_sub": apple_sub,
            "email": email,
            "name": payload.name or "Apple Kullanıcısı",
            "username": await unique_username(email.split("@")[0] if email else "apple"),
            "avatar": "",
            "provider": "apple",
            "points": 0.0,
            "correct_count": 0,
            "saved_count": 0,
            "bio": "Meraklı bir Swipedia öğrencisi.",
            "created_at": now_utc(),
        }
        await db.users.insert_one(user.copy())
    else:
        fixups: Dict[str, Any] = {}
        if payload.name and user.get("name") in ("Apple Kullanıcısı", ""):
            fixups["name"] = payload.name
        if payload.email and not user.get("email"):
            fixups["email"] = payload.email.lower()
        if fixups:
            await db.users.update_one({"user_id": user["user_id"]}, {"$set": fixups})
            user.update(fixups)
    return {"session_token": await create_session(user["user_id"]), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return {"user": public_user(user)}


@api_router.patch("/users/me")
async def update_profile(payload: ProfileUpdate, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    updates: Dict[str, Any] = {}
    if payload.name:
        updates["name"] = payload.name.strip()
    if payload.avatar is not None:
        updates["avatar"] = payload.avatar.strip()
    if payload.username:
        uname = slugify_username(payload.username)
        if len(uname) < 3:
            raise HTTPException(status_code=422, detail="Kullanıcı adı en az 3 karakter olmalı (a-z, 0-9, _)")
        taken = await db.users.find_one({"username": uname, "user_id": {"$ne": user["user_id"]}}, {"_id": 0})
        if taken:
            raise HTTPException(status_code=409, detail="Bu kullanıcı adı alınmış")
        updates["username"] = uname
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
        user.update(updates)
        question_updates = {}
        if "name" in updates:
            question_updates["author_name"] = updates["name"]
        if "username" in updates:
            question_updates["author_username"] = updates["username"]
        if "avatar" in updates:
            question_updates["author_avatar"] = updates["avatar"]
        if question_updates:
            await db.questions.update_many({"author_id": user["user_id"]}, {"$set": question_updates})
    return {"user": public_user(user)}


@api_router.post("/users/me/password")
async def change_password(payload: ChangePassword, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, bool]:
    if not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Bu hesap şifre ile giriş yapmıyor")
    if not bcrypt.checkpw(payload.current_password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=403, detail="Mevcut şifre hatalı")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"password_hash": bcrypt.hashpw(payload.new_password.encode(), bcrypt.gensalt()).decode()}},
    )
    return {"ok": True}


@api_router.post("/users/me/request-change-code")
async def request_change_code(payload: ContactChangeRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, bool]:
    if payload.field not in ("email", "phone"):
        raise HTTPException(status_code=422, detail="Geçersiz alan")
    current_email = user.get("email", "")
    if not current_email or current_email.endswith("@guest.swipedia.app"):
        raise HTTPException(status_code=400, detail="Doğrulama için geçerli bir e-postan olmalı")
    if payload.field == "email":
        value = payload.value.lower().strip()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            raise HTTPException(status_code=422, detail="Geçerli bir e-posta gir")
        if await db.users.find_one({"email": value, "user_id": {"$ne": user["user_id"]}}, {"_id": 0}):
            raise HTTPException(status_code=409, detail="Bu e-posta kullanımda")
    else:
        value = re.sub(r"\s+", "", payload.value)
        if len(value) < 7:
            raise HTTPException(status_code=422, detail="Geçerli bir telefon numarası gir")
    await send_verification_code(current_email, f"change_{payload.field}", payload={"field": payload.field, "value": value}, key=user["user_id"])
    return {"ok": True}


@api_router.post("/users/me/confirm-change")
async def confirm_change(payload: ContactChangeVerify, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if payload.field not in ("email", "phone"):
        raise HTTPException(status_code=422, detail="Geçersiz alan")
    data = await verify_code(user["user_id"], f"change_{payload.field}", payload.code)
    field = data.get("field", payload.field)
    value = data.get("value", "")
    if not value:
        raise HTTPException(status_code=400, detail="Doğrulama verisi bulunamadı")
    update: Dict[str, Any] = {field: value}
    if field == "email":
        update["email_verified"] = True
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    user.update(update)
    return {"user": public_user(user)}


# ---------- Feed / Questions ----------

@api_router.get("/feed")
async def feed(request: Request) -> List[Dict[str, Any]]:
    user = await get_optional_user(request)
    saved_ids = set()
    if user:
        saved = await db.saved_questions.find({"user_id": user["user_id"]}, {"_id": 0, "question_id": 1}).to_list(200)
        saved_ids = {item["question_id"] for item in saved}
    questions = await db.questions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [question_public(item, item["question_id"] in saved_ids) for item in questions]


@api_router.post("/questions/{question_id}/answer")
async def answer(question_id: str, payload: AnswerRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    question = await db.questions.find_one({"question_id": question_id}, {"_id": 0})
    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı")
    answer_key = f"{user['user_id']}:{question_id}"
    if await db.answers.find_one({"answer_key": answer_key}, {"_id": 0}):
        answered_count = await db.answers.count_documents({"user_id": user["user_id"]})
        return {"correct": payload.option_index == question["correct_index"], "already_answered": True, "earned": 0, "answered_count": answered_count, "user": public_user(user)}
    correct = payload.option_index == question["correct_index"]
    await db.answers.insert_one({"answer_key": answer_key, "user_id": user["user_id"], "question_id": question_id, "correct": correct, "created_at": now_utc()})
    earned = 0
    progress = user.get("point_progress", 0)
    rate = rate_for(float(user.get("points", 0)))
    if correct:
        next_count = user.get("correct_count", 0) + 1
        progress += 1
        points = int(float(user.get("points", 0)))
        if progress >= rate:
            earned = 1
            progress = 0
            points += 1
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"correct_count": next_count, "point_progress": progress, "points": points}})
        user["correct_count"] = next_count
        user["point_progress"] = progress
        user["points"] = points
        if earned > 0:
            await create_notification(user["user_id"], "points", f"+{earned} puan kazandın!", f"Toplam puanın: {points}", "sparkles", question_id)
        if next_count % 10 == 0:
            await create_notification(user["user_id"], "points", f"{next_count} doğru cevap!", f"Harika gidiyorsun! {progress}/{rate} ilerleme.", "flame-outline", question_id)
    return {
        "correct": correct,
        "already_answered": False,
        "correct_index": question["correct_index"],
        "explanation": question["explanation"],
        "earned": earned,
        "point_progress": progress,
        "point_rate": rate,
        "answered_count": await db.answers.count_documents({"user_id": user["user_id"]}),
        "user": public_user(user),
    }


@api_router.post("/questions/{question_id}/save")
async def save_question(question_id: str, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, bool]:
    question = await db.questions.find_one({"question_id": question_id}, {"_id": 0, "question_id": 1})
    if not question:
        raise HTTPException(status_code=404, detail="Soru bulunamadı")
    existing = await db.saved_questions.find_one({"user_id": user["user_id"], "question_id": question_id}, {"_id": 0})
    if existing:
        await db.saved_questions.delete_one({"user_id": user["user_id"], "question_id": question_id})
        await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"saved_count": -1}})
        await db.questions.update_one({"question_id": question_id}, {"$inc": {"saves_count": -1}})
        return {"saved": False}
    await db.saved_questions.insert_one({"user_id": user["user_id"], "question_id": question_id, "created_at": now_utc()})
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"saved_count": 1}})
    await db.questions.update_one({"question_id": question_id}, {"$inc": {"saves_count": 1}})
    return {"saved": True}


@api_router.get("/questions/{question_id}/comments")
async def comments(question_id: str) -> List[Dict[str, Any]]:
    rows = await db.comments.find({"question_id": question_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return rows


@api_router.post("/questions/{question_id}/comments")
async def add_comment(question_id: str, payload: CommentRequest, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    comment = {"comment_id": f"c_{uuid.uuid4().hex[:12]}", "question_id": question_id, "user_id": user["user_id"], "user_name": user["name"], "text": payload.text, "created_at": now_utc().isoformat()}
    await db.comments.insert_one(comment.copy())
    await db.questions.update_one({"question_id": question_id}, {"$inc": {"comments_count": 1}})
    # Notify question author about the new comment
    question = await db.questions.find_one({"question_id": question_id}, {"_id": 0, "author_id": 1, "text": 1})
    if question and question.get("author_id") and question["author_id"] != user["user_id"]:
        snippet = (question.get("text") or "")[:40]
        await create_notification(question["author_id"], "comment", f"{user['name']} yorum yaptı", f'"{snippet}…" sorusuna: {payload.text[:60]}', "chatbubble-outline", question_id)
    return comment


@api_router.post("/questions")
async def create_question(payload: QuestionCreate, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if payload.difficulty not in DIFFICULTIES:
        raise HTTPException(status_code=422, detail="Geçersiz zorluk seviyesi")
    question = {
        **payload.model_dump(),
        "question_id": f"q_{uuid.uuid4().hex[:12]}",
        "author_id": user["user_id"],
        "author_name": user["name"],
        "author_username": user.get("username", ""),
        "author_avatar": user.get("avatar", ""),
        "author_verified": bool(user.get("verified", False)),
        "likes": 0,
        "saves_count": 0,
        "shares_count": 0,
        "comments_count": 0,
        "created_at": now_utc(),
    }
    await db.questions.insert_one(question.copy())
    return question_public(question)


@api_router.get("/leaderboard")
async def leaderboard() -> List[Dict[str, Any]]:
    users = await db.users.find({"provider": {"$ne": "guest"}}, {"_id": 0, "name": 1, "user_id": 1, "points": 1, "correct_count": 1, "avatar": 1}).sort([("points", -1), ("correct_count", -1)]).to_list(100)
    return [{**item, "points": int(float(item.get("points", 0))), "avatar": item.get("avatar", ""), "rank": index + 1} for index, item in enumerate(users)]


@api_router.get("/saved-questions")
async def saved_questions_list(user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    rows = await db.saved_questions.find({"user_id": user["user_id"]}, {"_id": 0, "question_id": 1, "created_at": 1}).sort("created_at", -1).to_list(300)
    ids = [r["question_id"] for r in rows]
    if not ids:
        return []
    qmap = {q["question_id"]: q for q in await db.questions.find({"question_id": {"$in": ids}}, {"_id": 0}).to_list(300)}
    return [question_public(qmap[i], True) for i in ids if i in qmap]


@api_router.get("/my-questions")
async def my_questions_list(user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    saved = await db.saved_questions.find({"user_id": user["user_id"]}, {"_id": 0, "question_id": 1}).to_list(500)
    saved_ids = {s["question_id"] for s in saved}
    rows = await db.questions.find({"author_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(300)
    return [question_public(q, q["question_id"] in saved_ids) for q in rows]


# ---------- Messaging ----------

@api_router.get("/conversations")
async def conversations(user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    rows = await db.conversations.find({"participants": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(50)
    result = []
    for row in rows:
        other_id = next((p for p in row.get("participants", []) if p != user["user_id"]), None)
        other_name = row.get("other_name", "Kullanıcı")
        if other_id:
            other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "name": 1})
            if other:
                other_name = other["name"]
        result.append({**row, "other_name": other_name})
    return result


@api_router.get("/conversations/{other_user_id}/messages")
async def messages(other_user_id: str, user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    participants = {user["user_id"], other_user_id}
    rows = await db.messages.find({"sender_id": {"$in": list(participants)}, "recipient_id": {"$in": list(participants)}}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return rows


@api_router.post("/conversations/{other_user_id}/messages")
async def send_message(other_user_id: str, payload: MessageCreate, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    recipient = await db.users.find_one({"user_id": other_user_id}, {"_id": 0, "user_id": 1, "name": 1})
    if not recipient:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    message = {"message_id": f"m_{uuid.uuid4().hex[:12]}", "sender_id": user["user_id"], "recipient_id": other_user_id, "sender_name": user["name"], "text": payload.text, "question_id": payload.question_id, "created_at": now_utc().isoformat()}
    await db.messages.insert_one(message.copy())
    participants = [user["user_id"], other_user_id]
    pair_key = ":".join(sorted(participants))
    await db.conversations.update_one(
        {"pair_key": pair_key},
        {
            "$set": {"other_name": recipient["name"], "last_message": payload.text, "updated_at": now_utc().isoformat()},
            "$setOnInsert": {"pair_key": pair_key, "participants": participants},
        },
        upsert=True,
    )
    if payload.question_id:
        await db.questions.update_one({"question_id": payload.question_id}, {"$inc": {"shares_count": 1}})
        await create_notification(other_user_id, "share", f"{user['name']} seninle bir soru paylaştı", payload.text[:80], "paper-plane-outline", payload.question_id)
    return message


@api_router.get("/people")
async def people(user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    rows = await db.users.find({"user_id": {"$ne": user["user_id"]}, "provider": {"$ne": "guest"}}, {"_id": 0, "user_id": 1, "name": 1, "bio": 1, "points": 1, "avatar": 1}).to_list(20)
    return rows


# ---------- Notifications ----------

NOTIFICATION_TYPES = {"points", "rank_up", "comment", "share", "system"}


async def create_notification(
    user_id: str,
    notif_type: str,
    title: str,
    body: str,
    icon: str = "notifications-outline",
    ref_id: Optional[str] = None,
) -> None:
    """Persist an in-app notification for *user_id*."""
    doc = {
        "notification_id": f"n_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "icon": icon,
        "ref_id": ref_id or "",
        "read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.notifications.insert_one(doc)


@api_router.get("/notifications")
async def get_notifications(user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    rows = await db.notifications.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return rows


@api_router.get("/notifications/unread-count")
async def unread_count(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, int]:
    count = await db.notifications.count_documents({"user_id": user["user_id"], "read": False})
    return {"count": count}


@api_router.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: str, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, bool]:
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user["user_id"]},
        {"$set": {"read": True}},
    )
    return {"ok": result.modified_count > 0}


@api_router.post("/notifications/read-all")
async def mark_all_read(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, bool]:
    await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}},
    )
    return {"ok": True}


# ---------- Uploads (soru arka planları) ----------

@api_router.post("/uploads")
async def upload_file(file: UploadFile = File(...), user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Boş dosya")
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Dosya 5 MB sınırını aşıyor")
    ext = ((file.filename or "image.jpg").rsplit(".", 1)[-1] or "jpg").lower()
    content_type = file.content_type or "image/jpeg"
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    try:
        result = await run_in_threadpool(put_object, path, data, content_type)
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 500
        if status == 402:
            raise HTTPException(status_code=402, detail="Depolama kredisi doldu, lütfen daha sonra dene")
        raise HTTPException(status_code=502, detail="Depolama servisine ulaşılamadı")
    await db.uploads.insert_one({"path": result["path"], "owner_id": user["user_id"], "content_type": content_type, "created_at": now_utc().isoformat()})
    return {"path": result["path"]}


@api_router.get("/files/{file_path:path}")
async def serve_file(file_path: str, request: Request) -> Response:
    token = request.query_params.get("token", "")
    if not token:
        header = request.headers.get("Authorization", "")
        token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0, "expires_at": 1})
    if not session:
        raise HTTPException(status_code=401, detail="Oturum gerekli")
    expires_at = session.get("expires_at")
    if expires_at and expires_at.replace(tzinfo=timezone.utc) < now_utc():
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    record = await db.uploads.find_one({"path": file_path}, {"_id": 0, "content_type": 1})
    if not record:
        raise HTTPException(status_code=404, detail="Dosya bulunamadı")
    try:
        data, content_type = await run_in_threadpool(get_object, file_path)
    except Exception:
        raise HTTPException(status_code=404, detail="Dosya bulunamadı")
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})


app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("shutdown")
async def shutdown_db_client() -> None:
    client.close()
