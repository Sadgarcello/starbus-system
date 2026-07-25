"""Row helpers — convert sqlite3.Row to JSON-serializable dicts."""

from datetime import datetime


def row_to_dict(row) -> dict | None:
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows) -> list[dict]:
    return [dict(r) for r in rows]


def now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
