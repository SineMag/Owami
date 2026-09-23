"""Owami backend — FastAPI + MongoDB + Emergent Object Storage + Gemini."""
import os
import re
import uuid
import json
import base64
import hashlib
import hmac
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import bcrypt
import jwt
import httpx
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Request
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr, Field, field_validator
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
except ImportError:
    LlmChat = UserMessage = TextDelta = StreamDone = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY", "")
PAYSTACK_PLAN_MONTHLY = os.environ.get("PAYSTACK_PLAN_MONTHLY", "")
PAYSTACK_PLAN_YEARLY = os.environ.get("PAYSTACK_PLAN_YEARLY", "")
PAYSTACK_AMOUNT_MONTHLY = os.environ.get("PAYSTACK_AMOUNT_MONTHLY", "49900")
PAYSTACK_AMOUNT_YEARLY = os.environ.get("PAYSTACK_AMOUNT_YEARLY", "399900")
PAYSTACK_CALLBACK_URL = os.environ.get("PAYSTACK_CALLBACK_URL", "owami://paywall?payment=success")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "owami"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]
logger = logging.getLogger("owami")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Owami API")
api = APIRouter(prefix="/api")

# ---------------------------------------------------------------- Auth helpers
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False

def make_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)},
        JWT_SECRET, algorithm="HS256",
    )

async def get_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    try:
        payload = jwt.decode(authorization.split()[1], JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    if not user:
        raise HTTPException(401, "User not found")
    return user

# ---------------------------------------------------------------- Storage
_storage_key: Optional[str] = None

def _init_storage_sync() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logger.warning(f"storage init failed: {e}")
        return None

def _put_object_sync(path: str, data: bytes, content_type: str) -> Dict[str, Any]:
    global _storage_key
    key = _init_storage_sync()
    if not key:
        raise HTTPException(503, "Storage unavailable")
    r = requests.put(f"{STORAGE_URL}/objects/{path}",
                     headers={"X-Storage-Key": key, "Content-Type": content_type},
                     data=data, timeout=120)
    if r.status_code == 503:
        _storage_key = None
        key = _init_storage_sync()
        r = requests.put(f"{STORAGE_URL}/objects/{path}",
                         headers={"X-Storage-Key": key, "Content-Type": content_type},
                         data=data, timeout=120)
    r.raise_for_status()
    return r.json()

def _get_object_sync(path: str) -> tuple[bytes, str]:
    key = _init_storage_sync()
    if not key:
        raise HTTPException(503, "Storage unavailable")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")

# ---------------------------------------------------------------- Models
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    display_name: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdateIn(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None

class SessionIn(BaseModel):
    session_id: str

class Ingredient(BaseModel):
    name: str
    quantity: str = ""
    unit: str = ""

    @field_validator("quantity", "unit", mode="before")
    @classmethod
    def _coerce(cls, v):
        if v is None: return ""
        return str(v)

    @field_validator("name", mode="before")
    @classmethod
    def _coerce_name(cls, v):
        if v is None: return ""
        return str(v)

class RecipeIn(BaseModel):
    title: str
    description: str = ""
    image_url: str = ""
    prep_time: int = 0
    cook_time: int = 0
    servings: int = 2
    difficulty: str = "Easy"
    category: str = "Dinner"
    ingredients: List[Ingredient] = []
    instructions: List[str] = []
    tags: List[str] = []

    @field_validator("instructions", "tags", mode="before")
    @classmethod
    def _coerce_str_list(cls, v):
        if v is None: return []
        return [str(x) if not isinstance(x, dict) else str(x.get("text") or x.get("step") or x)
                for x in v]

    @field_validator("prep_time", "cook_time", "servings", mode="before")
    @classmethod
    def _coerce_int(cls, v):
        if v is None or v == "": return 0
        try: return int(float(v))
        except Exception: return 0

class IngredientList(BaseModel):
    ingredients: List[str]

class AskIn(BaseModel):
    question: str
    recipe_id: Optional[str] = None
    current_step: Optional[int] = None

class ScaleIn(BaseModel):
    recipe_id: str
    servings: int

class SubIn(BaseModel):
    ingredient: str
    recipe_id: Optional[str] = None

class PrefsIn(BaseModel):
    diet: List[str] = []
    cuisines: List[str] = []
    liked_ingredients: List[str] = []
    disliked: List[str] = []
    skill_level: Optional[str] = None
    onboarded: bool = True

class MealPlanIn(BaseModel):
    date: str  # ISO YYYY-MM-DD
    slot: str  # breakfast | lunch | dinner
    recipe_id: str

# ---------------------------------------------------------------- Auth routes
@api.post("/auth/register")
async def register(body: RegisterIn):
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(400, "Email already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": body.email.lower(),
        "display_name": body.display_name,
        "password_hash": hash_pw(body.password),
        "avatar_url": "",
        "is_premium": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "preferences": {"diet": [], "liked_ingredients": [], "disliked": []},
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None); doc.pop("_id", None)
    return {"token": make_token(uid), "user": doc}

@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    user.pop("_id", None); user.pop("password_hash", None)
    return {"token": make_token(user["id"]), "user": user}

# Emergent-managed Google sign-in: frontend obtains a one-time session_id and
# posts it here. We exchange it for user info at the Emergent auth service, then
# upsert the user and mint OUR standard JWT so every other endpoint keeps working.
@api.post("/auth/session")
async def auth_session(body: SessionIn):
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": body.session_id},
            )
    except Exception:
        raise HTTPException(401, "Google sign-in failed")
    if r.status_code != 200:
        raise HTTPException(401, "Google sign-in failed")
    data = r.json()
    email = (data.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(401, "Google sign-in failed")
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture") or ""
    user = await db.users.find_one({"email": email})
    if not user:
        uid = str(uuid.uuid4())
        user = {
            "id": uid, "email": email, "display_name": name,
            # Random unusable password hash — user signed in via Google
            "password_hash": hash_pw(uuid.uuid4().hex),
            "avatar_url": picture, "is_premium": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "preferences": {"diet": [], "cuisines": [], "liked_ingredients": [], "disliked": [], "onboarded": False},
            "auth_provider": "google",
        }
        await db.users.insert_one(user.copy())
    else:
        # Backfill avatar/name for returning google users if we don't have them
        updates: Dict[str, Any] = {}
        if not user.get("avatar_url") and picture: updates["avatar_url"] = picture
        if updates: await db.users.update_one({"id": user["id"]}, {"$set": updates})
    user = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return {"token": make_token(user["id"]), "user": user}

@api.get("/auth/me")
async def me(user=Depends(get_user)):
    return user

@api.patch("/auth/me")
async def update_me(body: ProfileUpdateIn, user=Depends(get_user)):
    updates: Dict[str, Any] = {}
    if body.display_name is not None:
        name = body.display_name.strip()
        if not name:
            raise HTTPException(400, "Name can't be empty")
        updates["display_name"] = name
    if body.avatar_url is not None:
        updates["avatar_url"] = body.avatar_url
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
        # keep owner_name on recipes in sync when the display name changes
        if "display_name" in updates:
            await db.recipes.update_many({"owner_id": user["id"]}, {"$set": {"owner_name": updates["display_name"]}})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})

@api.delete("/auth/me")
async def delete_me(user=Depends(get_user)):
    uid = user["id"]
    await db.users.delete_one({"id": uid})
    await db.recipes.delete_many({"owner_id": uid})
    await db.likes.delete_many({"user_id": uid})
    await db.saves.delete_many({"user_id": uid})
    await db.history.delete_many({"user_id": uid})
    return {"ok": True}

# ---------------------------------------------------------------- Recipes
def _clean(doc: Dict[str, Any]) -> Dict[str, Any]:
    doc.pop("_id", None)
    return doc

@api.get("/recipes")
async def list_recipes(q: Optional[str] = None, category: Optional[str] = None, limit: int = 50):
    query: Dict[str, Any] = {}
    if category and category != "All":
        query["category"] = category
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        query["$or"] = [{"title": rx}, {"description": rx}, {"tags": rx}, {"ingredients.name": rx}]
    docs = await db.recipes.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return docs

@api.get("/recipes/popular")
async def popular():
    docs = await db.recipes.find({}, {"_id": 0}).sort("likes_count", -1).limit(10).to_list(10)
    return docs

@api.get("/recipes/recommended")
async def recommended(user=Depends(get_user)):
    liked = [r["recipe_id"] async for r in db.likes.find({"user_id": user["id"]})]
    saved = [r["recipe_id"] async for r in db.saves.find({"user_id": user["id"]})]
    seen = set(liked + saved)
    liked_docs = await db.recipes.find({"id": {"$in": liked}}, {"_id": 0}).to_list(50)
    tags = set()
    for d in liked_docs:
        for t in d.get("tags", []): tags.add(t)
    if tags:
        docs = await db.recipes.find({"tags": {"$in": list(tags)}, "id": {"$nin": list(seen)}}, {"_id": 0}).limit(10).to_list(10)
        if docs: return docs
    return await db.recipes.find({"id": {"$nin": list(seen)}}, {"_id": 0}).sort("likes_count", -1).limit(10).to_list(10)

@api.get("/recipes/{rid}")
async def get_recipe(rid: str):
    doc = await db.recipes.find_one({"id": rid}, {"_id": 0})
    if not doc: raise HTTPException(404, "Not found")
    return doc

@api.post("/recipes")
async def create_recipe(body: RecipeIn, user=Depends(get_user)):
    rid = str(uuid.uuid4())
    doc = body.dict()
    doc.update({
        "id": rid, "owner_id": user["id"],
        "owner_name": user["display_name"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "likes_count": 0,
    })
    await db.recipes.insert_one(doc.copy())
    return _clean(doc)

@api.put("/recipes/{rid}")
async def update_recipe(rid: str, body: RecipeIn, user=Depends(get_user)):
    r = await db.recipes.find_one({"id": rid})
    if not r: raise HTTPException(404, "Not found")
    if r["owner_id"] != user["id"]: raise HTTPException(403, "Not yours")
    await db.recipes.update_one({"id": rid}, {"$set": body.dict()})
    return await db.recipes.find_one({"id": rid}, {"_id": 0})

@api.delete("/recipes/{rid}")
async def delete_recipe(rid: str, user=Depends(get_user)):
    r = await db.recipes.find_one({"id": rid})
    if not r: raise HTTPException(404, "Not found")
    if r["owner_id"] != user["id"]: raise HTTPException(403, "Not yours")
    await db.recipes.delete_one({"id": rid})
    return {"ok": True}

# ---------------------------------------------------------------- Likes/Saves/History
@api.post("/recipes/{rid}/like")
async def like_toggle(rid: str, user=Depends(get_user)):
    existing = await db.likes.find_one({"user_id": user["id"], "recipe_id": rid})
    if existing:
        await db.likes.delete_one({"user_id": user["id"], "recipe_id": rid})
        await db.recipes.update_one({"id": rid}, {"$inc": {"likes_count": -1}})
        return {"liked": False}
    await db.likes.insert_one({"user_id": user["id"], "recipe_id": rid,
                                "created_at": datetime.now(timezone.utc).isoformat()})
    await db.recipes.update_one({"id": rid}, {"$inc": {"likes_count": 1}})
    return {"liked": True}

@api.post("/recipes/{rid}/save")
async def save_toggle(rid: str, user=Depends(get_user)):
    existing = await db.saves.find_one({"user_id": user["id"], "recipe_id": rid})
    if existing:
        await db.saves.delete_one({"user_id": user["id"], "recipe_id": rid})
        return {"saved": False}
    await db.saves.insert_one({"user_id": user["id"], "recipe_id": rid,
                                "created_at": datetime.now(timezone.utc).isoformat()})
    return {"saved": True}

@api.get("/me/likes")
async def my_likes(user=Depends(get_user)):
    ids = [r["recipe_id"] async for r in db.likes.find({"user_id": user["id"]})]
    return await db.recipes.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)

@api.get("/me/saves")
async def my_saves(user=Depends(get_user)):
    ids = [r["recipe_id"] async for r in db.saves.find({"user_id": user["id"]})]
    return await db.recipes.find({"id": {"$in": ids}}, {"_id": 0}).to_list(100)

@api.get("/me/recipes")
async def my_recipes(user=Depends(get_user)):
    return await db.recipes.find({"owner_id": user["id"]}, {"_id": 0}).to_list(100)

@api.post("/recipes/{rid}/history")
async def record_history(rid: str, status: str = "started", user=Depends(get_user)):
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "recipe_id": rid,
           "status": status, "at": datetime.now(timezone.utc).isoformat()}
    await db.history.insert_one(doc.copy())
    return _clean(doc)

@api.get("/me/history")
async def my_history(user=Depends(get_user)):
    hist = await db.history.find({"user_id": user["id"]}, {"_id": 0}).sort("at", -1).limit(30).to_list(30)
    ids = list({h["recipe_id"] for h in hist})
    recipes = {r["id"]: r for r in await db.recipes.find({"id": {"$in": ids}}, {"_id": 0}).to_list(len(ids))}
    return [{"history": h, "recipe": recipes.get(h["recipe_id"])} for h in hist if recipes.get(h["recipe_id"])]

# ---------------------------------------------------------------- Subscription
def paystack_ready() -> bool:
    return bool(PAYSTACK_SECRET_KEY and PAYSTACK_PLAN_MONTHLY and PAYSTACK_PLAN_YEARLY)

def paystack_plan(plan: str) -> tuple[str, str]:
    plans = {
        "monthly": (PAYSTACK_PLAN_MONTHLY, PAYSTACK_AMOUNT_MONTHLY),
        "yearly": (PAYSTACK_PLAN_YEARLY, PAYSTACK_AMOUNT_YEARLY),
    }
    price = plans.get(plan)
    if not price:
        raise HTTPException(400, "Unknown subscription plan")
    return price

def paystack_headers() -> Dict[str, str]:
    return {"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}", "Content-Type": "application/json"}

async def paystack_request(method: str, path: str, **kwargs) -> Dict[str, Any]:
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(503, "Paystack is not configured")
    async with httpx.AsyncClient(timeout=20.0) as http:
        response = await http.request(method, f"https://api.paystack.co{path}", headers=paystack_headers(), **kwargs)
    if response.status_code >= 400 or not response.json().get("status"):
        message = response.json().get("message", "Paystack request failed")
        raise HTTPException(502, message)
    return response.json()["data"]

@api.get("/subscription/status")
async def sub_status(user=Depends(get_user)):
    return {"is_premium": bool(user.get("is_premium")), "offerings": [
        {"id": "monthly", "title": "Owami+ Monthly", "price": "R49.90", "period": "month"},
        {"id": "yearly", "title": "Owami+ Yearly", "price": "R399.90", "period": "year", "badge": "Best value"},
    ]}

@api.post("/subscription/paystack/checkout")
async def paystack_checkout(body: Dict[str, str], user=Depends(get_user)):
    if not paystack_ready():
        raise HTTPException(503, "Paystack is not configured")
    plan, amount = paystack_plan(body.get("plan", ""))
    data = await paystack_request("POST", "/transaction/initialize", json={
        "email": user["email"],
        "amount": amount,
        "currency": "ZAR",
        "plan": plan,
        "callback_url": PAYSTACK_CALLBACK_URL,
        "metadata": {"user_id": user["id"], "plan": body.get("plan", "")},
    })
    await db.users.update_one({"id": user["id"]}, {"$set": {"paystack_reference": data["reference"]}})
    return {"url": data["authorization_url"], "reference": data["reference"]}

@api.post("/subscription/paystack/verify")
async def paystack_verify(body: Dict[str, str], user=Depends(get_user)):
    reference = body.get("reference", "")
    if not reference:
        raise HTTPException(400, "Payment reference is required")
    data = await paystack_request("GET", f"/transaction/verify/{reference}")
    metadata = data.get("metadata") or {}
    if (data.get("status") != "success"
            or data.get("customer", {}).get("email", "").lower() != user["email"].lower()
            or metadata.get("user_id") not in (None, user["id"])):
        raise HTTPException(402, "Payment has not been completed")
    await activate_paystack_user(user["id"], data)
    return {"is_premium": True}

async def activate_paystack_user(user_id: str, data: Dict[str, Any]):
    customer = data.get("customer") or {}
    updates = {
        "is_premium": True,
        "paystack_customer_code": customer.get("customer_code"),
        "paystack_reference": data.get("reference"),
    }
    subscription = data.get("subscription") or {}
    if isinstance(subscription, dict) and subscription.get("subscription_code"):
        updates["paystack_subscription_code"] = subscription["subscription_code"]
    email_token = data.get("email_token") or (subscription.get("email_token") if isinstance(subscription, dict) else None)
    if email_token:
        updates["paystack_email_token"] = email_token
    await db.users.update_one({"id": user_id}, {"$set": updates})

@api.post("/subscription/paystack/webhook")
async def paystack_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("x-paystack-signature", "")
    expected = hmac.new(PAYSTACK_SECRET_KEY.encode(), payload, hashlib.sha512).hexdigest()
    if not PAYSTACK_SECRET_KEY or not signature or not hmac.compare_digest(signature, expected):
        raise HTTPException(401, "Invalid Paystack webhook")
    event = await request.json()
    data = event.get("data") or {}
    event_type = event.get("event")
    metadata = data.get("metadata") or {}
    user_id = metadata.get("user_id")
    if not user_id and data.get("customer", {}).get("email"):
        user = await db.users.find_one({"email": data["customer"]["email"].lower()})
        user_id = user.get("id") if user else None
    if user_id and event_type in {"charge.success", "subscription.create", "invoice.create"}:
        if event_type == "charge.success":
            await activate_paystack_user(user_id, data)
    elif user_id and event_type in {"subscription.disable", "subscription.not_renew"}:
        await db.users.update_one({"id": user_id}, {"$set": {"is_premium": False}})
    return {"received": True}

@api.post("/subscription/paystack/cancel")
async def paystack_cancel(user=Depends(get_user)):
    subscription_code = user.get("paystack_subscription_code")
    if subscription_code:
        await paystack_request("POST", "/subscription/disable", json={
            "code": subscription_code,
            "token": user.get("paystack_email_token", ""),
        })
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_premium": False}})
    return {"is_premium": False}

@api.post("/subscription/restore")
async def sub_restore(user=Depends(get_user)):
    return {"is_premium": bool(user.get("is_premium"))}

@api.post("/subscription/mock-purchase")
async def sub_mock_purchase(user=Depends(get_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_premium": True, "subscription_source": "mock"}})
    return {"is_premium": True}

@api.post("/subscription/cancel")
async def sub_cancel(user=Depends(get_user)):
    if PAYSTACK_SECRET_KEY and user.get("paystack_subscription_code"):
        return await paystack_cancel(user)
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_premium": False}})
    return {"is_premium": False}

# ---------------------------------------------------------------- Uploads
@api.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(get_user)):
    ext = (file.filename or "img").split(".")[-1].lower()[:5] or "jpg"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = await run_in_threadpool(_put_object_sync, path, data, file.content_type or "image/jpeg")
    await db.uploads.insert_one({"path": result["path"], "owner_id": user["id"],
                                   "at": datetime.now(timezone.utc).isoformat()})
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}

@api.get("/files/{full_path:path}")
async def get_file(full_path: str):
    meta = await db.uploads.find_one({"path": full_path})
    if not meta: raise HTTPException(404, "Not found")
    content, ct = await run_in_threadpool(_get_object_sync, full_path)
    return Response(content=content, media_type=ct)

# ---------------------------------------------------------------- AI
async def _ask_llm(system: str, prompt: str) -> str:
    if not EMERGENT_LLM_KEY or LlmChat is None:
        raise HTTPException(503, "AI unavailable")
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()),
                    system_message=system).with_model("gemini", "gemini-3-flash-preview")
    parts: list[str] = []
    try:
        async for ev in chat.stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                parts.append(ev.content or "")
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logger.exception("llm stream error")
        raise HTTPException(503, f"AI error: {e}")
    return "".join(parts).strip()

def _extract_json(text: str) -> Any:
    m = re.search(r"```(?:json)?\s*(.+?)\s*```", text, re.S)
    if m: text = m.group(1)
    text = text.strip()
    try:
        return json.loads(text)
    except Exception:
        # try to isolate top-level object/array
        m = re.search(r"(\{.*\}|\[.*\])", text, re.S)
        if m:
            try: return json.loads(m.group(1))
            except Exception: pass
    return None

@api.post("/ai/from-ingredients")
async def ai_from_ingredients(body: IngredientList, user=Depends(get_user)):
    if not user.get("is_premium"):
        raise HTTPException(402, "Owami+ required")
    ing = ", ".join(body.ingredients)
    prompt = (
        f"I have these ingredients: {ing}.\n"
        "Suggest ONE recipe I can make. Respond ONLY as JSON with keys: "
        "title (string), description (short string, one sentence), "
        "prep_time (int minutes), cook_time (int minutes), servings (int), "
        "difficulty (Easy|Medium|Hard), category (Breakfast|Lunch|Dinner|Dessert|Snack), "
        "ingredients (array of {name, quantity, unit}), "
        "missing_ingredients (array of strings that user probably doesn't have), "
        "instructions (array of short step strings, 4-8 steps), "
        "tags (array of short strings). No prose."
    )
    text = await _ask_llm("You are Owami, a warm, concise cooking assistant. Always reply with valid JSON only.", prompt)
    data = _extract_json(text)
    if not data or not isinstance(data, dict):
        raise HTTPException(502, "AI returned invalid recipe")
    data.setdefault("tags", []); data.setdefault("missing_ingredients", [])
    return data

@api.post("/ai/save-generated")
async def ai_save_generated(body: RecipeIn, user=Depends(get_user)):
    return await create_recipe(body, user)

@api.post("/ai/ask")
async def ai_ask(body: AskIn, user=Depends(get_user)):
    ctx = ""
    if body.recipe_id:
        r = await db.recipes.find_one({"id": body.recipe_id}, {"_id": 0})
        if r:
            ctx = (f"Current recipe: {r['title']}. Servings: {r.get('servings')}. "
                   f"Ingredients: {'; '.join(i['name']+' '+str(i.get('quantity',''))+' '+str(i.get('unit','')) for i in r.get('ingredients', []))}. "
                   f"Steps: {' | '.join(r.get('instructions', []))}. ")
            if body.current_step is not None and body.current_step < len(r.get("instructions", [])):
                ctx += f"User is on step {body.current_step + 1}: {r['instructions'][body.current_step]}. "
    prompt = ctx + "User question: " + body.question + "\nAnswer in ONE or TWO short sentences, warm and helpful."
    text = await _ask_llm("You are Owami, a friendly hands-free cooking companion. Keep answers short and clear.", prompt)
    return {"answer": text}

@api.post("/ai/scale")
async def ai_scale(body: ScaleIn, user=Depends(get_user)):
    if not user.get("is_premium"):
        raise HTTPException(402, "Owami+ required")
    r = await db.recipes.find_one({"id": body.recipe_id}, {"_id": 0})
    if not r: raise HTTPException(404, "Recipe not found")
    factor = body.servings / max(1, r.get("servings", 1))
    def scale_qty(q: str) -> str:
        try:
            n = float(q)
            v = n * factor
            return f"{v:.2f}".rstrip("0").rstrip(".")
        except Exception:
            return q
    scaled = [{"name": i["name"], "quantity": scale_qty(str(i.get("quantity",""))), "unit": i.get("unit","")}
              for i in r.get("ingredients", [])]
    return {"servings": body.servings, "ingredients": scaled}

@api.post("/ai/substitute")
async def ai_substitute(body: SubIn, user=Depends(get_user)):
    if not user.get("is_premium"):
        raise HTTPException(402, "Owami+ required")
    prompt = f"I don't have {body.ingredient}. Suggest 3 common substitutes with brief notes. Respond as JSON array of {{name, note}}."
    text = await _ask_llm("You are Owami, expert on cooking substitutions. Return valid JSON only.", prompt)
    data = _extract_json(text)
    if not isinstance(data, list): raise HTTPException(502, "AI parse error")
    return {"substitutes": data}

# ---------------------------------------------------------------- Preferences (onboarding)
@api.put("/me/preferences")
async def set_prefs(body: PrefsIn, user=Depends(get_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"preferences": body.dict()}})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated

# ---------------------------------------------------------------- Meal plans (premium)
@api.get("/me/meal-plan")
async def list_meal_plan(user=Depends(get_user)):
    plans = await db.meal_plans.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    rids = list({p["recipe_id"] for p in plans})
    recipes = {r["id"]: r for r in await db.recipes.find({"id": {"$in": rids}}, {"_id": 0}).to_list(len(rids))}
    return [{"plan": p, "recipe": recipes.get(p["recipe_id"])} for p in plans if recipes.get(p["recipe_id"])]

@api.post("/me/meal-plan")
async def add_meal_plan(body: MealPlanIn, user=Depends(get_user)):
    if not user.get("is_premium"):
        raise HTTPException(402, "Owami+ required")
    existing = await db.meal_plans.find_one({"user_id": user["id"], "date": body.date, "slot": body.slot})
    if existing:
        await db.meal_plans.update_one({"id": existing["id"]}, {"$set": {"recipe_id": body.recipe_id}})
        return {"id": existing["id"], **body.dict(), "user_id": user["id"]}
    pid = str(uuid.uuid4())
    doc = {"id": pid, "user_id": user["id"], **body.dict(),
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.meal_plans.insert_one(doc.copy())
    return _clean(doc)

@api.delete("/me/meal-plan/{pid}")
async def remove_meal_plan(pid: str, user=Depends(get_user)):
    await db.meal_plans.delete_one({"id": pid, "user_id": user["id"]})
    return {"ok": True}

# ---------------------------------------------------------------- Categories
@api.get("/categories")
async def categories():
    return ["All", "Breakfast", "Lunch", "Dinner", "Dessert", "Snack", "Vegetarian", "Quick"]

# ---------------------------------------------------------------- Seed
SEED_RECIPES = [
    {"title": "Autumn Pumpkin Soup", "category": "Lunch", "difficulty": "Easy", "prep_time": 10, "cook_time": 25, "servings": 4,
     "description": "Silky, warm, and spiced — the essence of autumn in a bowl.",
     "image_url": "https://images.unsplash.com/photo-1695459003933-4a1b59009355?w=800&q=80",
     "tags": ["soup", "vegetarian", "autumn"],
     "ingredients": [{"name": "Pumpkin", "quantity": "500", "unit": "g"},{"name": "Onion", "quantity": "1", "unit": ""},
                     {"name": "Garlic", "quantity": "2", "unit": "cloves"},{"name": "Vegetable stock", "quantity": "500", "unit": "ml"},
                     {"name": "Cream", "quantity": "100", "unit": "ml"},{"name": "Nutmeg", "quantity": "1", "unit": "pinch"}],
     "instructions": ["Peel and dice the pumpkin into cubes.","Sauté onion and garlic in butter until soft.",
                       "Add pumpkin and stock, simmer 20 minutes.","Blend until smooth.","Stir in cream and nutmeg. Season and serve."]},
    {"title": "Creamy Tomato Pasta", "category": "Dinner", "difficulty": "Easy", "prep_time": 5, "cook_time": 20, "servings": 2,
     "description": "The comforting weeknight bowl that never disappoints.",
     "image_url": "https://images.unsplash.com/photo-1608219992759-35f8f3b70ad6?w=800&q=80",
     "tags": ["pasta", "quick", "italian"],
     "ingredients": [{"name": "Penne", "quantity": "200", "unit": "g"},{"name": "Tomato passata", "quantity": "400", "unit": "g"},
                     {"name": "Garlic", "quantity": "2", "unit": "cloves"},{"name": "Cream", "quantity": "80", "unit": "ml"},
                     {"name": "Basil", "quantity": "1", "unit": "handful"},{"name": "Parmesan", "quantity": "30", "unit": "g"}],
     "instructions": ["Boil pasta until al dente.","Sizzle garlic in olive oil for 1 minute.","Add passata, simmer 8 minutes.",
                       "Stir in cream and basil.","Toss with pasta and parmesan."]},
    {"title": "Chicken Curry", "category": "Dinner", "difficulty": "Medium", "prep_time": 15, "cook_time": 35, "servings": 4,
     "description": "Rich, fragrant, deeply spiced chicken curry with tomatoes and onions.",
     "image_url": "https://images.unsplash.com/photo-1631292784640-2b24be784d5d?w=800&q=80",
     "tags": ["chicken", "curry", "spicy"],
     "ingredients": [{"name": "Chicken", "quantity": "600", "unit": "g"},{"name": "Onion", "quantity": "2", "unit": ""},
                     {"name": "Tomato", "quantity": "3", "unit": ""},{"name": "Ginger", "quantity": "1", "unit": "thumb"},
                     {"name": "Garlic", "quantity": "4", "unit": "cloves"},{"name": "Curry powder", "quantity": "2", "unit": "tbsp"},
                     {"name": "Coconut milk", "quantity": "200", "unit": "ml"}],
     "instructions": ["Brown chicken pieces; set aside.","Fry onions until golden.","Add ginger, garlic, curry powder.",
                       "Add tomatoes; cook down 5 minutes.","Return chicken, add coconut milk.","Simmer 25 minutes. Serve with rice."]},
    {"title": "Golden Pancakes", "category": "Breakfast", "difficulty": "Easy", "prep_time": 5, "cook_time": 15, "servings": 2,
     "description": "Fluffy, buttery pancakes with a golden edge.",
     "image_url": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
     "tags": ["breakfast", "sweet", "quick"],
     "ingredients": [{"name": "Flour", "quantity": "200", "unit": "g"},{"name": "Milk", "quantity": "250", "unit": "ml"},
                     {"name": "Egg", "quantity": "2", "unit": ""},{"name": "Sugar", "quantity": "2", "unit": "tbsp"},
                     {"name": "Baking powder", "quantity": "1", "unit": "tsp"}],
     "instructions": ["Whisk dry ingredients.","Whisk in milk and eggs.","Rest 5 minutes.","Pour ladlefuls into hot buttered pan.",
                       "Flip when bubbles form. Stack and serve."]},
    {"title": "Herb Roasted Chicken", "category": "Dinner", "difficulty": "Medium", "prep_time": 10, "cook_time": 60, "servings": 4,
     "description": "Crackly-skinned, herby, Sunday-lunch chicken.",
     "image_url": "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=800&q=80",
     "tags": ["chicken", "roast"],
     "ingredients": [{"name": "Whole chicken", "quantity": "1.4", "unit": "kg"},{"name": "Butter", "quantity": "50", "unit": "g"},
                     {"name": "Thyme", "quantity": "1", "unit": "bunch"},{"name": "Garlic", "quantity": "6", "unit": "cloves"},
                     {"name": "Lemon", "quantity": "1", "unit": ""}],
     "instructions": ["Heat oven to 200°C.","Rub chicken with butter, salt, herbs.","Stuff lemon and garlic in the cavity.",
                       "Roast 60 minutes until juices run clear.","Rest 10 minutes; carve."]},
    {"title": "Rustic Beef Stew", "category": "Dinner", "difficulty": "Medium", "prep_time": 20, "cook_time": 120, "servings": 4,
     "description": "Slow-braised beef with root vegetables and red wine.",
     "image_url": "https://images.unsplash.com/photo-1547424450-e50fa8ce70f7?w=800&q=80",
     "tags": ["beef", "stew", "autumn"],
     "ingredients": [{"name": "Beef chuck", "quantity": "800", "unit": "g"},{"name": "Carrot", "quantity": "3", "unit": ""},
                     {"name": "Onion", "quantity": "2", "unit": ""},{"name": "Red wine", "quantity": "250", "unit": "ml"},
                     {"name": "Beef stock", "quantity": "500", "unit": "ml"},{"name": "Bay leaf", "quantity": "2", "unit": ""}],
     "instructions": ["Brown beef in batches.","Sauté onions and carrots.","Deglaze with wine.","Add stock and bay.",
                       "Simmer 2 hours until tender.","Season and serve with bread."]},
    {"title": "Cheesy Mushroom Omelette", "category": "Breakfast", "difficulty": "Easy", "prep_time": 5, "cook_time": 8, "servings": 1,
     "description": "Three eggs, earthy mushrooms, melted cheese.",
     "image_url": "https://images.unsplash.com/photo-1510693206972-df098062cb71?w=800&q=80",
     "tags": ["breakfast", "eggs", "quick"],
     "ingredients": [{"name": "Egg", "quantity": "3", "unit": ""},{"name": "Mushroom", "quantity": "100", "unit": "g"},
                     {"name": "Cheddar", "quantity": "40", "unit": "g"},{"name": "Butter", "quantity": "10", "unit": "g"}],
     "instructions": ["Sauté mushrooms in butter.","Beat eggs; pour into hot pan.","Sprinkle cheese and mushrooms.",
                       "Fold and slide onto plate."]},
    {"title": "Warm Grain Bowl", "category": "Lunch", "difficulty": "Easy", "prep_time": 10, "cook_time": 20, "servings": 2,
     "description": "A hearty bowl of grains, roasted vegetables and tahini.",
     "image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80",
     "tags": ["vegetarian", "healthy", "bowl"],
     "ingredients": [{"name": "Quinoa", "quantity": "150", "unit": "g"},{"name": "Sweet potato", "quantity": "1", "unit": ""},
                     {"name": "Chickpea", "quantity": "1", "unit": "can"},{"name": "Tahini", "quantity": "2", "unit": "tbsp"}],
     "instructions": ["Roast diced sweet potato and chickpeas.","Cook quinoa.","Whisk tahini with lemon and water.",
                       "Assemble bowls; drizzle sauce."]},
    {"title": "Chocolate Fondant", "category": "Dessert", "difficulty": "Medium", "prep_time": 15, "cook_time": 12, "servings": 4,
     "description": "Molten-hearted chocolate puddings — the definitive finale.",
     "image_url": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&q=80",
     "tags": ["dessert", "chocolate"],
     "ingredients": [{"name": "Dark chocolate", "quantity": "150", "unit": "g"},{"name": "Butter", "quantity": "120", "unit": "g"},
                     {"name": "Egg", "quantity": "3", "unit": ""},{"name": "Sugar", "quantity": "100", "unit": "g"},
                     {"name": "Flour", "quantity": "50", "unit": "g"}],
     "instructions": ["Melt chocolate and butter.","Whisk eggs and sugar.","Fold in chocolate and flour.",
                       "Divide into buttered ramekins.","Bake at 200°C for 10-12 minutes."]},
    {"title": "Banana Bread", "category": "Snack", "difficulty": "Easy", "prep_time": 10, "cook_time": 55, "servings": 8,
     "description": "The cozy loaf that saves overripe bananas.",
     "image_url": "https://images.unsplash.com/photo-1606101273945-e9eba91c0dc4?w=800&q=80",
     "tags": ["baking", "snack", "sweet"],
     "ingredients": [{"name": "Banana", "quantity": "3", "unit": ""},{"name": "Flour", "quantity": "220", "unit": "g"},
                     {"name": "Sugar", "quantity": "150", "unit": "g"},{"name": "Butter", "quantity": "100", "unit": "g"},
                     {"name": "Egg", "quantity": "2", "unit": ""},{"name": "Baking soda", "quantity": "1", "unit": "tsp"}],
     "instructions": ["Cream butter and sugar.","Beat in eggs and mashed banana.","Fold in dry ingredients.",
                       "Pour into lined loaf tin.","Bake at 170°C for 55 minutes."]},
    {"title": "Charred Vegetable Salad", "category": "Lunch", "difficulty": "Easy", "prep_time": 10, "cook_time": 15, "servings": 2,
     "description": "Smoky vegetables, sharp lemon, soft herbs.",
     "image_url": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80",
     "tags": ["salad", "vegetarian", "healthy"],
     "ingredients": [{"name": "Zucchini", "quantity": "2", "unit": ""},{"name": "Bell pepper", "quantity": "2", "unit": ""},
                     {"name": "Feta", "quantity": "80", "unit": "g"},{"name": "Lemon", "quantity": "1", "unit": ""}],
     "instructions": ["Char vegetables on a griddle.","Squeeze over lemon.","Crumble feta and scatter herbs."]},
    {"title": "Sunday Ginger Stir Fry", "category": "Dinner", "difficulty": "Easy", "prep_time": 10, "cook_time": 10, "servings": 2,
     "description": "Fast, gingery, and full of crunch.",
     "image_url": "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800&q=80",
     "tags": ["stirfry", "quick", "asian"],
     "ingredients": [{"name": "Chicken breast", "quantity": "300", "unit": "g"},{"name": "Broccoli", "quantity": "200", "unit": "g"},
                     {"name": "Ginger", "quantity": "1", "unit": "thumb"},{"name": "Soy sauce", "quantity": "2", "unit": "tbsp"}],
     "instructions": ["Slice chicken; sear in wok.","Add broccoli and ginger.","Splash soy and cook 3 minutes.","Serve with rice."]},
    {"title": "Cinnamon French Toast", "category": "Breakfast", "difficulty": "Easy", "prep_time": 5, "cook_time": 10, "servings": 2,
     "description": "Crisp-edged, custardy, dusted with cinnamon sugar.",
     "image_url": "https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=800&q=80",
     "tags": ["breakfast", "sweet"],
     "ingredients": [{"name": "Bread", "quantity": "4", "unit": "slices"},{"name": "Egg", "quantity": "2", "unit": ""},
                     {"name": "Milk", "quantity": "100", "unit": "ml"},{"name": "Cinnamon", "quantity": "1", "unit": "tsp"}],
     "instructions": ["Whisk eggs, milk, cinnamon.","Dip bread and fry in butter.","Dust with cinnamon sugar."]},
    {"title": "Miso Roasted Salmon", "category": "Dinner", "difficulty": "Easy", "prep_time": 10, "cook_time": 12, "servings": 2,
     "description": "Sweet-savory glaze on flaky salmon.",
     "image_url": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80",
     "tags": ["fish", "healthy"],
     "ingredients": [{"name": "Salmon fillet", "quantity": "2", "unit": ""},{"name": "White miso", "quantity": "2", "unit": "tbsp"},
                     {"name": "Honey", "quantity": "1", "unit": "tbsp"},{"name": "Soy sauce", "quantity": "1", "unit": "tbsp"}],
     "instructions": ["Mix glaze; brush over salmon.","Roast at 200°C for 12 minutes.","Serve with greens."]},
    {"title": "Comforting Lentil Stew", "category": "Dinner", "difficulty": "Easy", "prep_time": 10, "cook_time": 35, "servings": 4,
     "description": "Earthy lentils simmered with tomato and cumin.",
     "image_url": "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80",
     "tags": ["vegetarian", "stew", "autumn"],
     "ingredients": [{"name": "Lentils", "quantity": "250", "unit": "g"},{"name": "Onion", "quantity": "1", "unit": ""},
                     {"name": "Carrot", "quantity": "2", "unit": ""},{"name": "Tomato", "quantity": "400", "unit": "g"},
                     {"name": "Cumin", "quantity": "1", "unit": "tsp"}],
     "instructions": ["Sauté onion and carrot.","Add cumin, then lentils and tomato.","Cover with water; simmer 35 minutes.","Season and serve."]},
    {"title": "Warm Apple Crumble", "category": "Dessert", "difficulty": "Easy", "prep_time": 15, "cook_time": 40, "servings": 6,
     "description": "Cinnamon-scented apples under a buttery oat crumble.",
     "image_url": "https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?w=800&q=80",
     "tags": ["dessert", "autumn", "baking"],
     "ingredients": [{"name": "Apple", "quantity": "6", "unit": ""},{"name": "Oats", "quantity": "150", "unit": "g"},
                     {"name": "Butter", "quantity": "100", "unit": "g"},{"name": "Brown sugar", "quantity": "100", "unit": "g"},
                     {"name": "Cinnamon", "quantity": "1", "unit": "tsp"}],
     "instructions": ["Slice apples into a dish.","Rub butter into oats, sugar and cinnamon.","Scatter over apples.",
                       "Bake at 180°C for 40 minutes.","Serve with cream."]},
]

async def seed_demo_data():
    demo_users = [
        {
            "email": "cook@owami.app",
            "display_name": "Cookist",
            "password": "owami123",
            "is_premium": False,
            "preferences": {"diet": [], "cuisines": [], "liked_ingredients": [], "disliked": [], "skill_level": None, "onboarded": True},
        },
        {
            "email": "premium@owami.app",
            "display_name": "Chef Ama",
            "password": "owami123",
            "is_premium": True,
            "preferences": {"diet": [], "cuisines": [], "liked_ingredients": [], "disliked": [], "skill_level": None, "onboarded": True},
        },
    ]

    for entry in demo_users:
        existing = await db.users.find_one({"email": entry["email"]})
        if existing:
            await db.users.update_one(
                {"email": entry["email"]},
                {"$set": {
                    "display_name": entry["display_name"],
                    "password_hash": hash_pw(entry["password"]),
                    "is_premium": entry["is_premium"],
                    "preferences": entry["preferences"],
                    "avatar_url": existing.get("avatar_url", ""),
                }},
            )
            continue

        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": entry["email"],
            "display_name": entry["display_name"],
            "password_hash": hash_pw(entry["password"]),
            "avatar_url": "",
            "is_premium": entry["is_premium"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "preferences": entry["preferences"],
            "auth_provider": "email",
        })

    owner = await db.users.find_one({"email": "cook@owami.app"}, {"_id": 0, "id": 1})
    owner_id = owner["id"] if owner else str(uuid.uuid4())
    existing_titles = {doc["title"] for doc in await db.recipes.find({}, {"_id": 0, "title": 1}).to_list(length=None)}
    for recipe in SEED_RECIPES:
        if recipe["title"] not in existing_titles:
            await db.recipes.insert_one({
                **recipe,
                "id": str(uuid.uuid4()),
                "owner_id": owner_id,
                "owner_name": "Cookist",
                "likes_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            existing_titles.add(recipe["title"])

    logger.info("Demo users and seed recipes are ready")

async def initialize_database():
    collections = {
        "users": [
            IndexModel([("id", ASCENDING)], unique=True),
            IndexModel([("email", ASCENDING)], unique=True),
        ],
        "recipes": [
            IndexModel([("id", ASCENDING)], unique=True),
            IndexModel([("owner_id", ASCENDING)]),
            IndexModel([("category", ASCENDING)]),
            IndexModel([("likes_count", DESCENDING)]),
            IndexModel([("tags", ASCENDING)]),
        ],
        "likes": [
            IndexModel([("user_id", ASCENDING), ("recipe_id", ASCENDING)], unique=True),
            IndexModel([("recipe_id", ASCENDING)]),
        ],
        "saves": [
            IndexModel([("user_id", ASCENDING), ("recipe_id", ASCENDING)], unique=True),
            IndexModel([("recipe_id", ASCENDING)]),
        ],
        "history": [
            IndexModel([("user_id", ASCENDING), ("at", DESCENDING)]),
            IndexModel([("recipe_id", ASCENDING)]),
        ],
        "uploads": [
            IndexModel([("path", ASCENDING)], unique=True),
            IndexModel([("owner_id", ASCENDING)]),
        ],
        "meal_plans": [
            IndexModel([("id", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING), ("date", ASCENDING), ("slot", ASCENDING)], unique=True),
        ],
    }
    existing = set(await db.list_collection_names())
    for name, indexes in collections.items():
        if name not in existing:
            await db.create_collection(name)
        await db[name].create_indexes(indexes)
    logger.info("MongoDB collections and indexes are ready")

@app.on_event("startup")
async def on_startup():
    try:
        await initialize_database()
        await seed_demo_data()
    except Exception as e:
        logger.exception(f"seed failed: {e}")
    # storage init (non-blocking)
    try:
        await run_in_threadpool(_init_storage_sync)
    except Exception as e:
        logger.warning(f"storage init at startup: {e}")

@api.get("/")
async def root():
    return {"app": "Owami", "ok": True}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown():
    client.close()
