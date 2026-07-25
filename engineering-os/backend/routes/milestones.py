"""Progress timeline — milestones in chronological order."""

from flask import Blueprint, jsonify, request

from config import DEFAULT_PROJECT_ID
from database import get_db
from utils import now_iso, row_to_dict, rows_to_list

bp = Blueprint("milestones", __name__, url_prefix="/api/milestones")

FIELDS = ("title", "description", "milestone_date", "sort_order")


def _project_id() -> int:
    return int(request.args.get("project_id", DEFAULT_PROJECT_ID))


@bp.route("", methods=["GET", "POST"])
def milestones_list():
    pid = _project_id()
    with get_db() as conn:
        if request.method == "GET":
            rows = conn.execute(
                """
                SELECT * FROM milestones
                WHERE project_id = ?
                ORDER BY milestone_date ASC, sort_order ASC, id ASC
                """,
                (pid,),
            ).fetchall()
            return jsonify(rows_to_list(rows))

        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "title required"}), 400
        mdate = data.get("milestone_date") or now_iso()[:10]
        sort_order = int(data.get("sort_order", 0))
        cur = conn.execute(
            """
            INSERT INTO milestones (project_id, title, description, milestone_date, sort_order)
            VALUES (?, ?, ?, ?, ?)
            """,
            (pid, title, data.get("description", ""), mdate, sort_order),
        )
        conn.execute(
            "UPDATE projects SET last_update = ? WHERE id = ?",
            (now_iso(), pid),
        )
        row = conn.execute(
            "SELECT * FROM milestones WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return jsonify(row_to_dict(row)), 201


@bp.route("/<int:milestone_id>", methods=["PATCH", "DELETE"])
def milestone_item(milestone_id: int):
    pid = _project_id()
    with get_db() as conn:
        if request.method == "DELETE":
            conn.execute(
                "DELETE FROM milestones WHERE id = ? AND project_id = ?",
                (milestone_id, pid),
            )
            return jsonify({"ok": True})

        data = request.get_json(silent=True) or {}
        updates = {k: data[k] for k in FIELDS if k in data}
        if "sort_order" in updates:
            updates["sort_order"] = int(updates["sort_order"])
        if updates:
            sets = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE milestones SET {sets} WHERE id = ? AND project_id = ?",
                (*updates.values(), milestone_id, pid),
            )
            conn.execute(
                "UPDATE projects SET last_update = ? WHERE id = ?",
                (now_iso(), pid),
            )
        row = conn.execute(
            "SELECT * FROM milestones WHERE id = ? AND project_id = ?",
            (milestone_id, pid),
        ).fetchone()
        return jsonify(row_to_dict(row))
