import os
import urllib.parse
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load .env file from the backend folder
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# Read database settings from .env
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "3306")
DB_USER     = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME     = os.getenv("DB_NAME", "trace_x")

# Encode password so special characters like #, <, > don't break the URL
encoded_password = urllib.parse.quote_plus(DB_PASSWORD)

# Build the connection string
# Format: mysql+pymysql://user:password@host:port/database
DATABASE_URL = (
    f"mysql+pymysql://{DB_USER}:{encoded_password}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Create the SQLAlchemy engine
# pool_pre_ping=True: tests the connection before using it (prevents stale connections)
engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)

# SessionLocal is a factory that creates new database sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base is the parent class for all our database models (User, Course, etc.)
Base = declarative_base()


def get_db():
    """
    FastAPI dependency: provides a database session to each route.

    Usage in a route:
        from app.database import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @router.get("/something")
        def my_route(db: Session = Depends(get_db)):
            ...

    The 'yield' means: open session → run route → close session (always).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
