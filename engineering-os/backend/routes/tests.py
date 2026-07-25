"""Testing section — test history with pass/fail tracking."""

from flask import Blueprint, jsonify, request

from config import DEFAULT_PROJECT_ID
from database import get_db
from utils import now_iso, row_to_dict, rows_to_list

bp = Blueprint("tests", __name__, url_prefix="/api/tests")

FIELDS = (
    "test_name",
    "test_date",
    "result",
    "pass_fail",
    "observations",
    "issues_found",
)


def _project_id() -> int:
    return int(request.args.get("project_id", DEFAULT_PROJECT_ID))


@bp.route("", methods=["GET", "POST"])
def tests_list():
    pid = _project_id()
    with get_db() as conn:
        if request.method == "GET":
            rows = conn.execute(
                "SELECT * FROM test_records WHERE project_id = ? ORDER BY test_date DESC, id DESC",
                (pid,),
            ).fetchall()
            return jsonify(rows_to_list(rows))

        data = request.get_json(silent=True) or {}
        name = (data.get("test_name") or "").strip()
        if not name:
            return jsonify({"error": "test_name required"}), 400
        test_date = data.get("test_date") or now_iso()[:10]
        cur = conn.execute(
            """
            INSERT INTO test_records
            (project_id, test_name, test_date, result, pass_fail, observations, issues_found)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pid,
                name,
                test_date,
                data.get("result", ""),
                data.get("pass_fail", "pending"),
                data.get("observations", ""),
                data.get("issues_found", ""),
            ),
        )
        conn.execute(
            "UPDATE projects SET last_update = ? WHERE id = ?",
            (now_iso(), pid),
        )
        row = conn.execute(
            "SELECT * FROM test_records WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return jsonify(row_to_dict(row)), 201


@bp.route("/<int:test_id>", methods=["PATCH", "DELETE"])
def test_item(test_id: int):
    pid = _project_id()
    with get_db() as conn:
        if request.method == "DELETE":
            conn.execute(
                "DELETE FROM test_records WHERE id = ? AND project_id = ?",
                (test_id, pid),
            )
            return jsonify({"ok": True})

        data = request.get_json(silent=True) or {}
        updates = {k: data[k] for k in FIELDS if k in data}
        if updates:
            sets = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE test_records SET {sets} WHERE id = ? AND project_id = ?",
                (*updates.values(), test_id, pid),
            )
            conn.execute(
                "UPDATE projects SET last_update = ? WHERE id = ?",
                (now_iso(), pid),
            )
        row = conn.execute(
            "SELECT * FROM test_records WHERE id = ? AND project_id = ?",
            (test_id, pid),
        ).fetchone()
        return jsonify(row_to_dict(row))
