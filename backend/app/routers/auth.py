from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, UserResponse, TokenResponse
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user

# Create a router — all routes here will be prefixed with /api/auth
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── REGISTER ──────────────────────────────────────────────────────────────────
@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user account.

    Steps:
    1. Check if the email is already registered
    2. Hash the password (never store plain text!)
    3. Save the new user to the database
    4. Return the user info (without password)
    """
    # Step 1: Check for duplicate email
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # Step 2: Hash the password
    hashed = hash_password(data.password)

    # Step 3: Create the user record
    new_user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hashed
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)  # Refresh to get auto-generated fields (user_id, created_at)

    # Step 4: Return user info
    return new_user


# ── LOGIN ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """
    Log in with email and password.

    Steps:
    1. Find the user by email
    2. Verify the password matches the stored hash
    3. Create and return a JWT token
    """
    # Step 1: Find user by email
    user = db.query(User).filter(User.email == data.email).first()

    # Step 2: Verify password (same error for both wrong email + wrong password — security best practice)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated."
        )

    # Step 3: Create JWT token
    token = create_access_token(user_id=user.user_id, email=user.email)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user
    }


# ── GET CURRENT USER (Protected) ──────────────────────────────────────────────
@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the currently logged-in user's info.

    The 'Depends(get_current_user)' automatically:
      - Reads the Authorization: Bearer <token> header
      - Validates the JWT token
      - Returns the logged-in User object

    No database query needed here — get_current_user already did it.
    """
    return current_user
