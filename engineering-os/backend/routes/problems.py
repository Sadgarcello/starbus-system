"""Problems & solutions log."""

from flask import Blueprint, jsonify, request

from config import DEFAULT_PROJECT_ID
from database import get_db
from utils import now_iso, row_to_dict, rows_to_list

bp = Blueprint("problems", __name__, url_prefix="/api/problems")

FIELDS = ("problem", "cause", "solution", "status")


def _project_id() -> int:
    return int(request.args.get("project_id", DEFAULT_PROJECT_ID))


@bp.route("", methods=["GET", "POST"])
def problems_list():
    pid = _project_id()
    with get_db() as conn:
        if request.method == "GET":
            rows = conn.execute(
                "SELECT * FROM problems WHERE project_id = ? ORDER BY created_at DESC",
                (pid,),
            ).fetchall()
            return jsonify(rows_to_list(rows))

        data = request.get_json(silent=True) or {}
        problem = (data.get("problem") or "").strip()
        if not problem:
            return jsonify({"error": "problem required"}), 400
        cur = conn.execute(
            """
            INSERT INTO problems (project_id, problem, cause, solution, status)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                pid,
                problem,
                data.get("cause", ""),
                data.get("solution", ""),
                data.get("status", "open"),
            ),
        )
        conn.execute(
            "UPDATE projects SET last_update = ? WHERE id = ?",
            (now_iso(), pid),
        )
        row = conn.execute(
            "SELECT * FROM problems WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return jsonify(row_to_dict(row)), 201


@bp.route("/<int:problem_id>", methods=["PATCH", "DELETE"])
def problem_item(problem_id: int):
    pid = _project_id()
    with get_db() as conn:
        if request.method == "DELETE":
            conn.execute(
                "DELETE FROM problems WHERE id = ? AND project_id = ?",
                (problem_id, pid),
            )
            return jsonify({"ok": True})

        data = request.get_json(silent=True) or {}
        updates = {k: data[k] for k in FIELDS if k in data}
        if updates:
            updates["updated_at"] = now_iso()
            sets = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE problems SET {sets} WHERE id = ? AND project_id = ?",
                (*updates.values(), problem_id, pid),
            )
            conn.execute(
                "UPDATE projects SET last_update = ? WHERE id = ?",
                (now_iso(), pid),
            )
        row = conn.execute(
            "SELECT * FROM problems WHERE id = ? AND project_id = ?",
            (problem_id, pid),
        ).fetchone()
        return jsonify(row_to_dict(row))
