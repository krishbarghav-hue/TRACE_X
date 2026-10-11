import os
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User

load_dotenv()

INSECURE_SECRETS = {
    "fallback_secret_key",
    "secret",
    "secret_key",
    "changeme",
    "your_secret_key",
    "replace_with_a_long_random_secret",
    "test_secret",
}


def get_secret_key() -> str:
    """
    Retrieve and validate the JWT secret key.
    Fails safely without printing or leaking the secret value.
    Preserves local development using an explicitly configured local secret.
    """
    env_name = os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).strip().lower()
    is_production = env_name in ("production", "prod") or bool(os.getenv("RENDER"))

    secret = os.getenv("SECRET_KEY") or (os.getenv("DEV_SECRET_KEY") if not is_production else None)

    if not secret or not secret.strip():
        if is_production:
            raise RuntimeError("Missing required SECRET_KEY environment variable in production.")
        raise RuntimeError(
            "SECRET_KEY is not configured. For local development, explicitly configure "
            "SECRET_KEY or DEV_SECRET_KEY in your environment or backend/.env."
        )

    clean_secret = secret.strip()
    if clean_secret.lower() in INSECURE_SECRETS:
        raise RuntimeError(
            "Configured SECRET_KEY is a known insecure placeholder. "
            "Please configure a strong, unique secret."
        )

    if is_production and len(clean_secret) < 32:
        raise RuntimeError(
            "Configured SECRET_KEY in production is too short (must be at least 32 characters)."
        )

    return clean_secret


def _init_module_secret() -> str:
    try:
        return get_secret_key()
    except RuntimeError:
        return ""


SECRET_KEY = _init_module_secret()
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7   # Token is valid for 7 days

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(plain_password: str) -> str:
    """Turn a plain text password into a bcrypt hash."""
    pwd_bytes = plain_password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if plain password matches the stored hash."""
    if not hashed_password:
        return False
    try:
        pwd_bytes = plain_password.encode('utf-8')[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode('utf-8'))
    except Exception:
        return False


def create_access_token(user_id: int, email: str) -> str:
    """Create a JWT token containing the user's id and email."""
    secret = get_secret_key()
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db)
) -> User:
    """FastAPI dependency for protected routes."""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"}
    )

    if not credentials or not credentials.credentials:
        raise credentials_error

    try:
        token = credentials.credentials
        secret = get_secret_key()
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except (JWTError, RuntimeError):
        raise credentials_error

    user = db.query(User).filter(User.user_id == int(user_id)).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user


def get_optional_user_id(authorization: Optional[str] = Header(None)) -> Optional[int]:
    """
    Extract user_id from optional Authorization header.
    Returns None if missing or invalid; never substitutes user 1.
    """
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        try:
            secret = get_secret_key()
            payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
            uid = payload.get("sub")
            if uid:
                return int(uid)
        except Exception:
            return None
    return None

