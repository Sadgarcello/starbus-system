"""Circuit gallery — local filesystem storage for diagrams and photos."""

import uuid
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from config import ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, UPLOAD_DIR, DEFAULT_PROJECT_ID
from database import get_db
from utils import now_iso, row_to_dict, rows_to_list

bp = Blueprint("circuits", __name__, url_prefix="/api/circuits")


def _project_id() -> int:
    return int(request.args.get("project_id", DEFAULT_PROJECT_ID))


def _allowed(filename: str) -> bool:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return ext in ALLOWED_EXTENSIONS


@bp.route("", methods=["GET", "POST"])
def circuits_list():
    pid = _project_id()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    if request.method == "GET":
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM circuit_images WHERE project_id = ? ORDER BY uploaded_at DESC",
                (pid,),
            ).fetchall()
            items = rows_to_list(rows)
            for item in items:
                item["url"] = f"/api/circuits/files/{item['filename']}"
            return jsonify({"items": items})

    if "file" not in request.files:
        return jsonify({"error": "file required"}), 400
    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "empty filename"}), 400
    if not _allowed(file.filename):
        return jsonify({"error": "file type not allowed"}), 400

    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_UPLOAD_BYTES:
        return jsonify({"error": "file too large"}), 400

    original = secure_filename(file.filename)
    ext = original.rsplit(".", 1)[-1].lower()
    stored = f"{uuid.uuid4().hex}.{ext}"
    caption = request.form.get("caption", "")

    file.save(Path(UPLOAD_DIR) / stored)

    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO circuit_images (project_id, filename, original_name, caption)
            VALUES (?, ?, ?, ?)
            """,
            (pid, stored, original, caption),
        )
        conn.execute(
            "UPDATE projects SET last_update = ? WHERE id = ?",
            (now_iso(), pid),
        )
        row = conn.execute(
            "SELECT * FROM circuit_images WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    item = row_to_dict(row)
    item["url"] = f"/api/circuits/files/{stored}"
    return jsonify(item), 201


@bp.route("/<int:image_id>", methods=["PATCH", "DELETE"])
def circuit_item(image_id: int):
    pid = _project_id()
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM circuit_images WHERE id = ? AND project_id = ?",
            (image_id, pid),
        ).fetchone()
        if not row:
            return jsonify({"error": "Not found"}), 404

        if request.method == "DELETE":
            path = Path(UPLOAD_DIR) / row["filename"]
            if path.exists():
                path.unlink()
            conn.execute(
                "DELETE FROM circuit_images WHERE id = ?", (image_id,)
            )
            return jsonify({"ok": True})

        data = request.get_json(silent=True) or {}
        if "caption" in data:
            conn.execute(
                "UPDATE circuit_images SET caption = ? WHERE id = ?",
                (data["caption"], image_id),
            )
        row = conn.execute(
            "SELECT * FROM circuit_images WHERE id = ?", (image_id,)
        ).fetchone()
    item = row_to_dict(row)
    item["url"] = f"/api/circuits/files/{item['filename']}"
    return jsonify(item)


@bp.route("/files/<path:filename>", methods=["GET"])
def serve_file(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)
