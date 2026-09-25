import os
import httpx
import jwt
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from core import (db, new_id, now_iso, now_utc, hash_password, verify_password, set_auth_cookies,
                  clear_auth_cookies, public_user, get_current_user, create_access_token, ALG)

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


async def _check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= 5:
        locked_until = rec.get("locked_until")
        if locked_until and locked_until > now_iso():
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        await db.login_attempts.delete_one({"identifier": identifier})


async def _record_failure(identifier: str):
    rec = await db.login_attempts.find_one_and_update(
        {"identifier": identifier}, {"$inc": {"count": 1}, "$set": {"updated_at": now_iso()}},
        upsert=True, return_document=True)
    if rec and rec.get("count", 0) >= 5:
        await db.login_attempts.update_one({"identifier": identifier},
                                           {"$set": {"locked_until": (now_utc() + timedelta(minutes=15)).isoformat()}})


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    user = {"id": new_id(), "email": email, "name": body.name.strip(), "phone": body.phone, "role": "patient",
            "password_hash": hash_password(body.password), "picture": "", "created_at": now_iso()}
    await db.users.insert_one(user)
    token = set_auth_cookies(response, user)
    return {"user": public_user(user), "access_token": token}


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    identifier = f"{request.client.host if request.client else 'unknown'}:{email}"
    await _check_lockout(identifier)
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        await _record_failure(identifier)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    token = set_auth_cookies(response, user)
    return {"user": public_user(user), "access_token": token}


@router.post("/google/session")
async def google_session(body: GoogleSessionIn, response: Response):
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                             headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google session")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user = {"id": new_id(), "email": email, "name": data.get("name", ""), "phone": "", "role": "patient",
                "picture": data.get("picture", ""), "created_at": now_iso()}
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"picture": data.get("picture", user.get("picture", ""))}})
    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.insert_one({"id": new_id(), "user_id": user["id"], "session_token": data["session_token"],
                                       "expires_at": expires_at.isoformat(), "created_at": now_iso()})
    response.set_cookie("session_token", data["session_token"], httponly=True, secure=True, samesite="none",
                        max_age=604800, path="/")
    return {"user": public_user(user)}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user)
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=43200, path="/")
    return {"access_token": access}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_one({"session_token": st})
    clear_auth_cookies(response)
    return {"ok": True}
