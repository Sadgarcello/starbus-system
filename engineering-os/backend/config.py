"""Application configuration — paths and defaults for local Engineering OS."""

import os
from pathlib import Path

# Root of engineering-os/ (parent of backend/)
BASE_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent

# SQLite lives outside backend so it survives redeploys / venv resets
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = DATA_DIR / "engineering_os.db"

# Circuit / prototype images stored on filesystem
UPLOAD_DIR = BACKEND_DIR / "uploads"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "svg", "pdf"}
MAX_UPLOAD_BYTES = 16 * 1024 * 1024  # 16 MB

# Flask
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-local-engineering-os")
DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1"

# Default project for v1 (single-project mode; schema supports project_id for multi-project later)
DEFAULT_PROJECT_ID = 1
