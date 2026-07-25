"""Components database — BOM with searchable list and cost totals."""

from flask import Blueprint, jsonify, request

from config import DEFAULT_PROJECT_ID
from database import get_db
from utils import now_iso, row_to_dict, rows_to_list

bp = Blueprint("components", __name__, url_prefix="/api/components")

FIELDS = (
    "name",
    "category",
    "quantity",
    "cost",
    "specifications",
    "purpose",
    "notes",
)


def _project_id() -> int:
    return int(request.args.get("project_id", DEFAULT_PROJECT_ID))


@bp.route("", methods=["GET", "POST"])
def components_list():
    pid = _project_id()
    q = (request.args.get("q") or "").strip().lower()

    with get_db() as conn:
        if request.method == "GET":
            rows = conn.execute(
                "SELECT * FROM components WHERE project_id = ? ORDER BY name",
                (pid,),
            ).fetchall()
            items = rows_to_list(rows)
            if q:
                items = [
                    i
                    for i in items
                    if q in (i.get("name") or "").lower()
                    or q in (i.get("category") or "").lower()
                    or q in (i.get("specifications") or "").lower()
                    or q in (i.get("purpose") or "").lower()
                ]
            total_cost = sum(
                (i.get("quantity") or 0) * (i.get("cost") or 0) for i in items
            )
            return jsonify({"items": items, "total_cost": round(total_cost, 2)})

        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name required"}), 400
        values = {
            "name": name,
            "category": data.get("category", ""),
            "quantity": float(data.get("quantity", 1)),
            "cost": float(data.get("cost", 0)),
            "specifications": data.get("specifications", ""),
            "purpose": data.get("purpose", ""),
            "notes": data.get("notes", ""),
        }
        cur = conn.execute(
            """
            INSERT INTO components
            (project_id, name, category, quantity, cost, specifications, purpose, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (pid, *values.values()),
        )
        conn.execute(
            "UPDATE projects SET last_update = ? WHERE id = ?",
            (now_iso(), pid),
        )
        row = conn.execute(
            "SELECT * FROM components WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return jsonify(row_to_dict(row)), 201


@bp.route("/<int:item_id>", methods=["GET", "PATCH", "DELETE"])
def component_item(item_id: int):
    pid = _project_id()
    with get_db() as conn:
        if request.method == "GET":
            row = conn.execute(
                "SELECT * FROM components WHERE id = ? AND project_id = ?",
                (item_id, pid),
            ).fetchone()
            if not row:
                return jsonify({"error": "Not found"}), 404
            return jsonify(row_to_dict(row))

        if request.method == "DELETE":
            conn.execute(
                "DELETE FROM components WHERE id = ? AND project_id = ?",
                (item_id, pid),
            )
            return jsonify({"ok": True})

        data = request.get_json(silent=True) or {}
        updates = {k: data[k] for k in FIELDS if k in data}
        if "quantity" in updates:
            updates["quantity"] = float(updates["quantity"])
        if "cost" in updates:
            updates["cost"] = float(updates["cost"])
        if updates:
            sets = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE components SET {sets} WHERE id = ? AND project_id = ?",
                (*updates.values(), item_id, pid),
            )
            conn.execute(
                "UPDATE projects SET last_update = ? WHERE id = ?",
                (now_iso(), pid),
            )
        row = conn.execute(
            "SELECT * FROM components WHERE id = ? AND project_id = ?",
            (item_id, pid),
        ).fetchone()
        return jsonify(row_to_dict(row))
