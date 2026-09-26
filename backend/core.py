import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date, time
from zoneinfo import ZoneInfo
from fastapi import Request, HTTPException, Response, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

ALG = "HS256"
IST = ZoneInfo("Asia/Kolkata")
ACTIVE_STATUSES = ["confirmed", "checked_in", "in_progress"]
DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def new_id() -> str:
    return uuid.uuid4().hex


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now_utc().isoformat()


def local_now() -> datetime:
    return datetime.now(IST)


def today_str() -> str:
    return local_now().strftime("%Y-%m-%d")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user: dict) -> str:
    payload = {"sub": user["id"], "email": user["email"], "role": user["role"], "type": "access",
               "exp": now_utc() + timedelta(hours=12)}
    return jwt.encode(payload, _secret(), algorithm=ALG)


def create_refresh_token(user: dict) -> str:
    payload = {"sub": user["id"], "type": "refresh", "exp": now_utc() + timedelta(days=7)}
    return jwt.encode(payload, _secret(), algorithm=ALG)


def set_auth_cookies(response: Response, user: dict) -> str:
    access = create_access_token(user)
    refresh = create_refresh_token(user)
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return access


def clear_auth_cookies(response: Response):
    for k in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(k, path="/", secure=True, samesite="none")


def public_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("_id", "password_hash")}


async def _user_from_jwt(token: str):
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALG])
    except jwt.InvalidTokenError:
        return None
    if payload.get("type") != "access":
        return None
    return await db.users.find_one({"id": payload["sub"]}, {"_id": 0})


async def _user_from_session(token: str):
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now_utc():
        return None
    return await db.users.find_one({"id": session["user_id"]}, {"_id": 0})


async def get_current_user(request: Request) -> dict:
    user = None
    token = request.cookies.get("access_token")
    if token:
        user = await _user_from_jwt(token)
    if not user and request.cookies.get("session_token"):
        user = await _user_from_session(request.cookies["session_token"])
    if not user:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            bearer = header[7:]
            user = await _user_from_jwt(bearer) or await _user_from_session(bearer)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return public_user(user)


def require_role(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


def generate_slots(availability: list, date_str: str) -> list:
    d = date.fromisoformat(date_str)
    wd = d.weekday()
    slots = set()
    for a in availability or []:
        if int(a["day"]) != wd:
            continue
        step = timedelta(minutes=int(a.get("slot_duration", 30)))
        t = datetime.combine(d, time.fromisoformat(a["start"]))
        end = datetime.combine(d, time.fromisoformat(a["end"]))
        while t + step <= end:
            slots.add(t.strftime("%H:%M"))
            t += step
    return sorted(slots)


def slot_duration_for(availability: list, date_str: str) -> int:
    wd = date.fromisoformat(date_str).weekday()
    for a in availability or []:
        if int(a["day"]) == wd:
            return int(a.get("slot_duration", 30))
    return 30


def is_past_slot(date_str: str, time_str: str) -> bool:
    slot_dt = datetime.combine(date.fromisoformat(date_str), time.fromisoformat(time_str)).replace(tzinfo=IST)
    return slot_dt < local_now()


async def audit(user_id: str, action: str, resource: str, resource_id: str = ""):
    await db.audit_logs.insert_one({"id": new_id(), "user_id": user_id, "action": action, "resource": resource,
                                    "resource_id": resource_id, "timestamp": now_iso()})
