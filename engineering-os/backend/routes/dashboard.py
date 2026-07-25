"""Dashboard & project metadata API."""

from flask import Blueprint, jsonify, request

from config import DEFAULT_PROJECT_ID
from database import get_db
from utils import now_iso, row_to_dict, rows_to_list

bp = Blueprint("dashboard", __name__, url_prefix="/api")


def _project_id() -> int:
    return int(request.args.get("project_id", DEFAULT_PROJECT_ID))


@bp.route("/dashboard", methods=["GET"])
def get_dashboard():
    pid = _project_id()
    with get_db() as conn:
        project = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (pid,)
        ).fetchone()
        if not project:
            return jsonify({"error": "Project not found"}), 404

        tasks = rows_to_list(
            conn.execute(
                "SELECT * FROM tasks WHERE project_id = ? ORDER BY id",
                (pid,),
            ).fetchall()
        )
        active = sum(1 for t in tasks if not t["completed"])
        completed = sum(1 for t in tasks if t["completed"])

        # Derive progress from tasks when tasks exist; else use stored field
        progress = project["progress_percent"]
        if tasks:
            progress = round((completed / len(tasks)) * 100, 1)

        return jsonify(
            {
                "project": row_to_dict(project),
                "progress_percent": progress,
                "active_tasks": active,
                "completed_tasks": completed,
                "tasks": tasks,
            }
        )


@bp.route("/project", methods=["GET", "PATCH"])
def project_meta():
    pid = _project_id()
    with get_db() as conn:
        if request.method == "GET":
            project = conn.execute(
                "SELECT * FROM projects WHERE id = ?", (pid,)
            ).fetchone()
            return jsonify(row_to_dict(project))

        data = request.get_json(silent=True) or {}
        allowed = ("name", "status", "version", "progress_percent")
        fields = {k: data[k] for k in allowed if k in data}
        if fields:
            fields["last_update"] = now_iso()
            sets = ", ".join(f"{k} = ?" for k in fields)
            conn.execute(
                f"UPDATE projects SET {sets} WHERE id = ?",
                (*fields.values(), pid),
            )
        project = conn.execute(
            "SELECT * FROM projects WHERE id = ?", (pid,)
        ).fetchone()
        return jsonify(row_to_dict(project))


@bp.route("/tasks", methods=["GET", "POST"])
def tasks_list():
    pid = _project_id()
    with get_db() as conn:
        if request.method == "GET":
            rows = conn.execute(
                "SELECT * FROM tasks WHERE project_id = ? ORDER BY id", (pid,)
            ).fetchall()
            return jsonify(rows_to_list(rows))

        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "title required"}), 400
        cur = conn.execute(
            "INSERT INTO tasks (project_id, title) VALUES (?, ?)",
            (pid, title),
        )
        row = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        conn.execute(
            "UPDATE projects SET last_update = ? WHERE id = ?",
            (now_iso(), pid),
        )
        return jsonify(row_to_dict(row)), 201


@bp.route("/tasks/<int:task_id>", methods=["PATCH", "DELETE"])
def task_item(task_id: int):
    pid = _project_id()
    with get_db() as conn:
        if request.method == "DELETE":
            conn.execute(
                "DELETE FROM tasks WHERE id = ? AND project_id = ?",
                (task_id, pid),
            )
            return jsonify({"ok": True})

        data = request.get_json(silent=True) or {}
        if "completed" in data:
            conn.execute(
                "UPDATE tasks SET completed = ? WHERE id = ? AND project_id = ?",
                (1 if data["completed"] else 0, task_id, pid),
            )
        if "title" in data:
            conn.execute(
                "UPDATE tasks SET title = ? WHERE id = ? AND project_id = ?",
                (data["title"], task_id, pid),
            )
        conn.execute(
            "UPDATE projects SET last_update = ? WHERE id = ?",
            (now_iso(), pid),
        )
        row = conn.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        return jsonify(row_to_dict(row))
