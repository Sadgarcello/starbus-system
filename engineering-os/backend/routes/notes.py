"""Quick notes — ideas and future improvements with debounced auto-save."""

from flask import Blueprint, jsonify, request

from config import DEFAULT_PROJECT_ID
from database import get_db
from utils import now_iso, row_to_dict, rows_to_list

bp = Blueprint("notes", __name__, url_prefix="/api/notes")


def _project_id() -> int:
    return int(request.args.get("project_id", DEFAULT_PROJECT_ID))


@bp.route("", methods=["GET", "POST"])
def notes_list():
    pid = _project_id()
    with get_db() as conn:
        if request.method == "GET":
            rows = conn.execute(
                "SELECT * FROM notes WHERE project_id = ? ORDER BY updated_at DESC, id DESC",
                (pid,),
            ).fetchall()
            return jsonify(rows_to_list(rows))

        data = request.get_json(silent=True) or {}
        content = data.get("content", "")
        ts = now_iso()
        cur = conn.execute(
            "INSERT INTO notes (project_id, content, updated_at) VALUES (?, ?, ?)",
            (pid, content, ts),
        )
        conn.execute(
            "UPDATE projects SET last_update = ? WHERE id = ?",
            (ts, pid),
        )
        row = conn.execute(
            "SELECT * FROM notes WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return jsonify(row_to_dict(row)), 201


@bp.route("/<int:note_id>", methods=["PATCH", "DELETE"])
def note_item(note_id: int):
    pid = _project_id()
    with get_db() as conn:
        if request.method == "DELETE":
            conn.execute(
                "DELETE FROM notes WHERE id = ? AND project_id = ?",
                (note_id, pid),
            )
            return jsonify({"ok": True})

        data = request.get_json(silent=True) or {}
        if "content" in data:
            conn.execute(
                "UPDATE notes SET content = ?, updated_at = ? WHERE id = ? AND project_id = ?",
                (data["content"], now_iso(), note_id, pid),
            )
            conn.execute(
                "UPDATE projects SET last_update = ? WHERE id = ?",
                (now_iso(), pid),
            )
        row = conn.execute(
            "SELECT * FROM notes WHERE id = ? AND project_id = ?",
            (note_id, pid),
        ).fetchone()
        return jsonify(row_to_dict(row))
