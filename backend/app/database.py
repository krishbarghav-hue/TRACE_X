
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
    # Validate connections before use — catches stale sockets immediately
    pool_pre_ping=True,
    # Recycle connections after 3 minutes; Aiven/Render firewalls typically
    # kill idle TCP sockets around 5 minutes, so staying well below that
    # prevents the wsarecv "established connection aborted" error.
    pool_recycle=180,
    # How long to wait for a connection from the pool before raising
    pool_timeout=30,
    # Steady-state pool size (connections kept open)
    pool_size=5,
    # Extra overflow connections allowed under high load
    max_overflow=10,
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
    """
    Yield a SQLAlchemy DB session for a single request lifecycle.
    Properly rolls back and closes failed sessions without attempting unsafe
    re-yields or retrying in-flight writes.
    Connection health and recovery from drops are managed safely at the pool level
    via pool_pre_ping=True and pool_recycle=180.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    finally:
        db.close()
