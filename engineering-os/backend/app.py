"""
Flask application factory.

Architecture:
  - Blueprints in routes/ — one per domain (dashboard, components, circuits, …)
  - database.py — SQLite access; schema in schema.sql
  - config.py — paths; UPLOAD_DIR for circuit files; DATA_DIR for .db

Run: python app.py  (port 5000)
Future: add WebSocket blueprint for ESP32/sensor streams without restructuring.
"""

from flask import Flask, jsonify
from flask_cors import CORS

from config import DEBUG, UPLOAD_DIR
from database import init_schema
from routes.circuits import bp as circuits_bp
from routes.components import bp as components_bp
from routes.dashboard import bp as dashboard_bp
from routes.milestones import bp as milestones_bp
from routes.notes import bp as notes_bp
from routes.overview import bp as overview_bp
from routes.problems import bp as problems_bp
from routes.tests import bp as tests_bp


def create_app() -> Flask:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    init_schema()

    app = Flask(__name__)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.register_blueprint(dashboard_bp)
    app.register_blueprint(overview_bp)
    app.register_blueprint(components_bp)
    app.register_blueprint(circuits_bp)
    app.register_blueprint(tests_bp)
    app.register_blueprint(problems_bp)
    app.register_blueprint(milestones_bp)
    app.register_blueprint(notes_bp)

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "app": "Engineering OS"})

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=DEBUG)
