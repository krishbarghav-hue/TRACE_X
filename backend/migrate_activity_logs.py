"""
TraceX — Database Migration Script
Adds event_id and source columns to activity_logs table.

Run this ONCE after updating the backend code:
    python migrate_activity_logs.py

Or run the SQL manually in MySQL Workbench / CLI.
"""

import os
import sys
import urllib.parse
from dotenv import load_dotenv

# Load .env from the backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, ".env"))

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "3306")
DB_USER     = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME     = os.getenv("DB_NAME", "trace_x")

encoded_password = urllib.parse.quote_plus(DB_PASSWORD)
DATABASE_URL = f"mysql+pymysql://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

try:
    from sqlalchemy import create_engine, text
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
except ImportError:
    print("ERROR: sqlalchemy not installed. Run: pip install sqlalchemy pymysql python-dotenv")
    sys.exit(1)

migrations = [
    # Add event_id for deduplication
    """
    ALTER TABLE activity_logs
    ADD COLUMN event_id VARCHAR(128) NULL DEFAULT NULL
    AFTER activity_id;
    """,
    # Add unique index on event_id (allow NULLs — MySQL allows multiple NULLs on unique index)
    """
    CREATE UNIQUE INDEX idx_activity_logs_event_id
    ON activity_logs (event_id);
    """,
    # Add source column
    """
    ALTER TABLE activity_logs
    ADD COLUMN source VARCHAR(32) NULL DEFAULT 'chrome'
    AFTER event_id;
    """,
]

def run_migration(sql: str, description: str):
    try:
        with engine.begin() as conn:
            conn.execute(text(sql.strip()))
        print(f"  [OK] {description}")
    except Exception as e:
        error_msg = str(e)
        # Silently skip if column/index already exists
        if "Duplicate column name" in error_msg or "Duplicate key name" in error_msg or "already exists" in error_msg.lower():
            print(f"  [SKIP] Already exists: {description}")
        else:
            print(f"  [FAIL] {description}")
            print(f"     Error: {error_msg}")

print("\nTraceX — Running activity_logs migrations...\n")
run_migration(migrations[0], "Add event_id column to activity_logs")
run_migration(migrations[1], "Add unique index on event_id")
run_migration(migrations[2], "Add source column to activity_logs")
print("\nMigration complete.\n")
