"""
TraceX Database Migration — DBMS Phase
=======================================
Safe migration that:
  1. Creates new tables: browser_history, website_usage
  2. Adds new columns to activity_logs (started_at, ended_at, is_active,
     tab_id, window_id, activity_type)
  3. Backfills started_at / ended_at from existing visit_time / exit_time
  4. Adds new indexes
  5. Never drops existing tables or data

Run from the backend directory:
  python migrate_db_phase2.py
"""

import os
import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
import urllib.parse
from dotenv import load_dotenv

# ── Load env ──────────────────────────────────────────────────────────────────
load_dotenv()

DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "3306")
DB_USER     = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME     = os.getenv("DB_NAME", "trace_x")

import pymysql

def get_connection():
    return pymysql.connect(
        host=DB_HOST,
        port=int(DB_PORT),
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
    )


def column_exists(cursor, table, column):
    cursor.execute(
        "SELECT COUNT(*) FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s",
        (DB_NAME, table, column)
    )
    return cursor.fetchone()[0] > 0


def index_exists(cursor, table, index_name):
    cursor.execute(
        "SELECT COUNT(*) FROM information_schema.STATISTICS "
        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND INDEX_NAME = %s",
        (DB_NAME, table, index_name)
    )
    return cursor.fetchone()[0] > 0


def table_exists(cursor, table):
    cursor.execute(
        "SELECT COUNT(*) FROM information_schema.TABLES "
        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
        (DB_NAME, table)
    )
    return cursor.fetchone()[0] > 0


def run_migration():
    conn = get_connection()
    cursor = conn.cursor()
    errors = []

    print(f"\n{'='*60}")
    print("  TraceX DBMS Migration — Phase 2")
    print(f"{'='*60}\n")

    # ── 1. Add new columns to activity_logs ──────────────────────────────────
    print("[1] Migrating activity_logs table...")

    new_columns = [
        ("started_at",    "DATETIME NULL COMMENT 'Alias for visit_time — when tracking started'"),
        ("ended_at",      "DATETIME NULL COMMENT 'Alias for exit_time — when tracking ended'"),
        ("is_active",     "TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'True=activity still in progress'"),
        ("tab_id",        "INT NULL COMMENT 'Chrome tab ID'"),
        ("window_id",     "INT NULL COMMENT 'Chrome window ID'"),
        ("activity_type", "VARCHAR(32) NULL DEFAULT 'browsing' COMMENT 'browsing|pdf|video|coding'"),
    ]

    for col_name, col_def in new_columns:
        if not column_exists(cursor, "activity_logs", col_name):
            try:
                cursor.execute(f"ALTER TABLE activity_logs ADD COLUMN {col_name} {col_def}")
                conn.commit()
                print(f"   ✓ Added column: {col_name}")
            except Exception as e:
                print(f"   ✗ Failed to add {col_name}: {e}")
                errors.append(str(e))
        else:
            print(f"   · Column already exists: {col_name}")

    # ── 2. Backfill started_at / ended_at from visit_time / exit_time ────────
    print("\n[2] Backfilling started_at / ended_at from visit_time / exit_time...")
    try:
        cursor.execute("""
            UPDATE activity_logs
            SET started_at = visit_time
            WHERE started_at IS NULL AND visit_time IS NOT NULL
        """)
        rows = cursor.rowcount
        conn.commit()
        print(f"   ✓ Backfilled started_at for {rows} rows")

        cursor.execute("""
            UPDATE activity_logs
            SET ended_at = exit_time
            WHERE ended_at IS NULL AND exit_time IS NOT NULL
        """)
        rows = cursor.rowcount
        conn.commit()
        print(f"   ✓ Backfilled ended_at for {rows} rows")
    except Exception as e:
        print(f"   ✗ Backfill error: {e}")
        errors.append(str(e))

    # ── 3. Add indexes to activity_logs ──────────────────────────────────────
    print("\n[3] Adding indexes to activity_logs...")
    indexes = [
        ("idx_activity_logs_user_started", "user_id, started_at"),
        ("idx_activity_logs_domain",       "domain"),
        ("idx_activity_logs_user_visit",   "user_id, visit_time"),
        ("idx_activity_logs_is_active",    "is_active"),
    ]
    for idx_name, idx_cols in indexes:
        if not index_exists(cursor, "activity_logs", idx_name):
            try:
                cursor.execute(f"CREATE INDEX {idx_name} ON activity_logs ({idx_cols})")
                conn.commit()
                print(f"   ✓ Created index: {idx_name}")
            except Exception as e:
                print(f"   ✗ Failed to create index {idx_name}: {e}")
        else:
            print(f"   · Index already exists: {idx_name}")

    # ── 4. Create browser_history table ──────────────────────────────────────
    print("\n[4] Creating browser_history table...")
    if not table_exists(cursor, "browser_history"):
        try:
            cursor.execute("""
                CREATE TABLE browser_history (
                    history_id       BIGINT NOT NULL AUTO_INCREMENT,
                    user_id          BIGINT NOT NULL,
                    url              VARCHAR(1000) NOT NULL,
                    domain           VARCHAR(255) NOT NULL,
                    title            VARCHAR(500) NULL,
                    visit_count      INT NOT NULL DEFAULT 1,
                    first_visit_time DATETIME NULL,
                    last_visit_time  DATETIME NULL,
                    source           VARCHAR(32) NOT NULL DEFAULT 'chrome_history',
                    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (history_id),
                    CONSTRAINT fk_browser_history_user
                        FOREIGN KEY (user_id) REFERENCES users (user_id)
                        ON DELETE CASCADE ON UPDATE CASCADE,
                    INDEX idx_browser_history_user_last_visit (user_id, last_visit_time),
                    INDEX idx_browser_history_domain (domain)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                  COMMENT='Chrome historical browser visits — separate from live activity tracking';
            """)
            conn.commit()
            print("   ✓ Created table: browser_history")
        except Exception as e:
            print(f"   ✗ Failed to create browser_history: {e}")
            errors.append(str(e))
    else:
        print("   · Table already exists: browser_history")

    # ── 5. Create website_usage table ────────────────────────────────────────
    print("\n[5] Creating website_usage table...")
    if not table_exists(cursor, "website_usage"):
        try:
            cursor.execute("""
                CREATE TABLE website_usage (
                    usage_id      BIGINT NOT NULL AUTO_INCREMENT,
                    user_id       BIGINT NOT NULL,
                    domain        VARCHAR(255) NOT NULL,
                    total_seconds BIGINT NOT NULL DEFAULT 0,
                    visit_count   INT NOT NULL DEFAULT 0,
                    last_used     DATETIME NULL,
                    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (usage_id),
                    UNIQUE KEY uq_website_usage_user_domain (user_id, domain),
                    CONSTRAINT fk_website_usage_user
                        FOREIGN KEY (user_id) REFERENCES users (user_id)
                        ON DELETE CASCADE ON UPDATE CASCADE,
                    INDEX idx_website_usage_user_domain (user_id, domain)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                  COMMENT='Aggregated per-domain usage stats per user';
            """)
            conn.commit()
            print("   ✓ Created table: website_usage")
        except Exception as e:
            print(f"   ✗ Failed to create website_usage: {e}")
            errors.append(str(e))
    else:
        print("   · Table already exists: website_usage")

    # ── 6. Populate website_usage from existing activity_logs ─────────────────
    print("\n[6] Populating website_usage from existing activity_logs...")
    try:
        cursor.execute("""
            INSERT INTO website_usage (user_id, domain, total_seconds, visit_count, last_used)
            SELECT
                user_id,
                domain,
                COALESCE(SUM(duration_seconds), 0) AS total_seconds,
                COUNT(*) AS visit_count,
                MAX(COALESCE(started_at, visit_time)) AS last_used
            FROM activity_logs
            WHERE domain IS NOT NULL
            GROUP BY user_id, domain
            ON DUPLICATE KEY UPDATE
                total_seconds = VALUES(total_seconds),
                visit_count   = VALUES(visit_count),
                last_used     = VALUES(last_used),
                updated_at    = CURRENT_TIMESTAMP
        """)
        rows = cursor.rowcount
        conn.commit()
        print(f"   ✓ Upserted {rows} website_usage rows")
    except Exception as e:
        print(f"   ✗ website_usage population error: {e}")
        errors.append(str(e))

    # ── 7. Verify schema ──────────────────────────────────────────────────────
    print("\n[7] Schema verification...")

    for tbl in ["users", "activity_logs", "browser_history", "website_usage"]:
        if table_exists(cursor, tbl):
            cursor.execute(f"SELECT COUNT(*) FROM {tbl}")
            count = cursor.fetchone()[0]
            print(f"   ✓ {tbl}: {count} rows")
        else:
            print(f"   ✗ {tbl}: MISSING")

    # ── 8. Show activity_logs columns ─────────────────────────────────────────
    print("\n[8] activity_logs columns:")
    cursor.execute(
        "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT "
        "FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'activity_logs' "
        "ORDER BY ORDINAL_POSITION",
        (DB_NAME,)
    )
    for row in cursor.fetchall():
        print(f"   {row[0]:<25} {row[1]:<25} nullable={row[2]}")

    # ── 9. DBMS demonstration queries ─────────────────────────────────────────
    print("\n[9] DBMS Demonstration Queries:")

    print("\n  -- All activity (user_id=1, latest 5):")
    cursor.execute("""
        SELECT activity_id, domain, page_title, duration_seconds, started_at
        FROM activity_logs
        WHERE user_id = 1
        ORDER BY started_at DESC
        LIMIT 5
    """)
    rows = cursor.fetchall()
    for r in rows:
        print(f"   {r}")
    if not rows:
        print("   (no rows yet)")

    print("\n  -- Total time by domain (GROUP BY + SUM):")
    cursor.execute("""
        SELECT domain, SUM(duration_seconds) AS total_seconds
        FROM activity_logs
        WHERE user_id = 1 AND duration_seconds > 0
        GROUP BY domain
        ORDER BY total_seconds DESC
        LIMIT 5
    """)
    rows = cursor.fetchall()
    for r in rows:
        print(f"   {r}")
    if not rows:
        print("   (no rows yet)")

    print("\n  -- Duplicate event_id check (HAVING COUNT > 1):")
    cursor.execute("""
        SELECT event_id, COUNT(*) as cnt
        FROM activity_logs
        WHERE event_id IS NOT NULL
        GROUP BY event_id
        HAVING COUNT(*) > 1
    """)
    dups = cursor.fetchall()
    if dups:
        print(f"   ⚠ DUPLICATES FOUND: {dups}")
    else:
        print("   ✓ Zero duplicate event_ids — deduplication is working.")

    print("\n  -- Activity with user JOIN:")
    cursor.execute("""
        SELECT u.full_name, a.domain, a.page_title, a.duration_seconds
        FROM users u
        JOIN activity_logs a ON u.user_id = a.user_id
        ORDER BY a.started_at DESC
        LIMIT 3
    """)
    rows = cursor.fetchall()
    for r in rows:
        print(f"   {r}")
    if not rows:
        print("   (no rows yet)")

    # ── Done ──────────────────────────────────────────────────────────────────
    cursor.close()
    conn.close()

    print(f"\n{'='*60}")
    if errors:
        print(f"  Migration completed with {len(errors)} error(s):")
        for e in errors:
            print(f"  ✗ {e}")
    else:
        print("  ✓ Migration completed successfully — no errors.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    run_migration()
