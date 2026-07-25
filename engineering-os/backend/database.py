"""
SQLite access layer.

Architecture note: thin wrapper around sqlite3 with row_factory for dict rows.
Future modules (ESP32 telemetry, live sensors) can add separate tables here
without changing the REST surface — see schema.sql for extension points.
"""

import sqlite3
from contextlib import contextmanager
from pathlib import Path

from config import DATA_DIR, DATABASE_PATH


def ensure_directories() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    ensure_directories()
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_schema() -> None:
    """Apply schema.sql and seed default project if empty."""
    schema_path = Path(__file__).parent / "schema.sql"
    with get_db() as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        row = conn.execute("SELECT COUNT(*) AS c FROM projects").fetchone()
        if row["c"] == 0:
            conn.execute(
                """
                INSERT INTO projects (id, name, status, version, progress_percent)
                VALUES (1, 'My Engineering Project', 'active', '1.0.0', 0)
                """
            )
            conn.execute(
                """
                INSERT INTO project_overview (project_id, title)
                VALUES (1, 'My Engineering Project')
                """
            )
