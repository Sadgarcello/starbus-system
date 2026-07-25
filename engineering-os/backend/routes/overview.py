"""Project overview — editable narrative fields with auto-save support."""

from flask import Blueprint, jsonify, request

from config import DEFAULT_PROJECT_ID
from database import get_db
from utils import now_iso, row_to_dict

bp = Blueprint("overview", __name__, url_prefix="/api/overview")

OVERVIEW_FIELDS = (
    "title",
    "problem_statement",
    "objective",
    "expected_outcome",
    "future_upgrades",
    "lessons_learned",
)


def _project_id() -> int:
    return int(request.args.get("project_id", DEFAULT_PROJECT_ID))


@bp.route("", methods=["GET", "PUT", "PATCH"])
def overview():
    pid = _project_id()
    with get_db() as conn:
        if request.method == "GET":
            row = conn.execute(
                "SELECT * FROM project_overview WHERE project_id = ?", (pid,)
            ).fetchone()
            if not row:
                conn.execute(
                    "INSERT INTO project_overview (project_id) VALUES (?)", (pid,)
                )
                row = conn.execute(
                    "SELECT * FROM project_overview WHERE project_id = ?", (pid,)
                ).fetchone()
            return jsonify(row_to_dict(row))

        data = request.get_json(silent=True) or {}
        updates = {k: data[k] for k in OVERVIEW_FIELDS if k in data}
        if not updates:
            return jsonify({"error": "No valid fields"}), 400

        updates["updated_at"] = now_iso()
        sets = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE project_overview SET {sets} WHERE project_id = ?",
            (*updates.values(), pid),
        )
        conn.execute(
            "UPDATE projects SET last_update = ? WHERE id = ?",
            (now_iso(), pid),
        )
        row = conn.execute(
            "SELECT * FROM project_overview WHERE project_id = ?", (pid,)
        ).fetchone()
        return jsonify(row_to_dict(row))
