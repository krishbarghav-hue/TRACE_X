from sqlalchemy import Column, BigInteger, String, Boolean, TIMESTAMP
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    """
    Maps to the 'users' table in the trace_x database.
    Every column here matches exactly one column in MySQL.
    """
    __tablename__ = "users"

    user_id       = Column(BigInteger, primary_key=True, autoincrement=True)
    full_name     = Column(String(120), nullable=False)
    email         = Column(String(180), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    created_at    = Column(TIMESTAMP, server_default=func.now())
    is_active     = Column(Boolean, default=True)

