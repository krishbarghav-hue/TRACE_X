
import os
import urllib.parse
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load backend/.env locally.
# On Render, environment variables are supplied by Render itself.
load_dotenv(
    os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "trace_x")

encoded_user = urllib.parse.quote_plus(DB_USER)
encoded_password = urllib.parse.quote_plus(DB_PASSWORD)
encoded_database = urllib.parse.quote_plus(DB_NAME)

DATABASE_URL = (
    f"mysql+pymysql://{encoded_user}:{encoded_password}"
    f"@{DB_HOST}:{DB_PORT}/{encoded_database}"
)

# Aiven requires encrypted connections. Enable TLS when configured
# for the hosted database; keep local development convenient.

connect_args = {}

if os.getenv("DB_SSL", "false").lower() in ("true", "1", "yes"):
    ca_path = os.getenv(
        "DB_SSL_CA_PATH",
        os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "ca.pem",
        ),
    )

    connect_args["ssl"] = {
        "ca": ca_path,
        "check_hostname": True,
    }

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
