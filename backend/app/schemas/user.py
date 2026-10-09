from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


# ── What the frontend sends to REGISTER ──────────────────────────────────────
class UserRegister(BaseModel):
    full_name: str
    email: EmailStr        # Pydantic validates email format automatically
    password: str          # Plain text — we hash it before saving


# ── What the frontend sends to LOGIN ─────────────────────────────────────────
class UserLogin(BaseModel):
    email: EmailStr
    password: str          # Plain text — we compare against the stored hash


# ── What we send BACK to the frontend (never include password_hash!) ──────────
class UserResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    created_at: Optional[datetime] = None
    is_active: bool

    # This tells Pydantic to read data from SQLAlchemy model attributes
    model_config = {"from_attributes": True}


# ── What we return after successful login ─────────────────────────────────────
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
