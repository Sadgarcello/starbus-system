# app.py
from flask import Flask, render_template, request, redirect, url_for
import sqlite3
import os
import shutil

app = Flask(__name__)

# -------------------- DB PATH (Render disk aware) --------------------
REPO_DB = os.path.join(os.path.dirname(__file__), "fighters.db")  # seed DB in repo
DISK_DIR = "/var/data"                                            # Render disk mount
DISK_DB = os.path.join(DISK_DIR, "fighters.db")

USE_DISK = os.path.exists(DISK_DIR)  # True on Render (disk mounted)

# Seed the disk the first time if it's empty
if USE_DISK and (not os.path.exists(DISK_DB)) and os.path.exists(REPO_DB):
    try:
        shutil.copyfile(REPO_DB, DISK_DB)
        print("✅ Seeded fighters.db to Render disk")
    except Exception as e:
        print("⚠️ Failed to seed DB to disk:", e)

DB_PATH = DISK_DB if USE_DISK else REPO_DB
print("USING DB:", DB_PATH)


def get_conn():
    """Open a SQLite connection to the active DB (repo or Render disk)."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn
# --------------------------------------------------------------------


# -------------------------- Data helpers -----------------------------
fighters_fallback = []  # optional in-memory fallback if DB fails

def get_fighters_from_db():
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM fighters")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_fighter_by_id_from_db(fighter_id: str):
    fighter_id = (fighter_id or "").strip().lower()
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("SELECT * FROM fighters WHERE LOWER(id) = ?", (fighter_id,))
    fighter = c.fetchone()
    if not fighter:
        conn.close()
        return None

    fighter_dict = dict(fighter)

    c.execute(
        """
        SELECT result, opponent, date, method, org
        FROM fight_history
        WHERE LOWER(fighter_id) = ?
        ORDER BY date DESC
        """,
        (fighter_id,),
    )
    fighter_dict["fight_history"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return fighter_dict
# --------------------------------------------------------------------


# ----------------------- Home page featured --------------------------
FEATURED_IDS = ["shamel", "bazooka", "danny", "buki"]

STATE_FLAG_MAP = {
    "selangor": "selangor.png",
    "sarawak": "sarawak.png",
    "kuala-lumpur": "kuala-lumpur.png",
    "sabah": "sabah.png",
    # add more as needed…
}


def normalize_state_from_country(country: str) -> tuple[str, str]:
    """Extract a state label from 'Malaysia (Selangor)' style strings and map to a flag file."""
    if not country:
        return ("", "")

    state = ""
    if "(" in country and ")" in country:
        state = country.split("(", 1)[1].split(")", 1)[0].strip()

    if not state and country.lower() not in ("malaysia",):
        # If it's not Malaysia, show the country itself as 'state' label (fallback).
        state = country.strip()

    state_label = state
    key = state.lower().replace(" ", "-") if state else ""
    flag_file = STATE_FLAG_MAP.get(key, "")
    return (state_label, flag_file)
# --------------------------------------------------------------------


# ----------------------------- Sponsors ------------------------------
SPONSORS = [
    {"name": "Abang Besi", "logo_path": "images/sponsors/abangbesi.png", "url": "https://www.instagram.com/abangbesigallery?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="},
    {"name": "ko",         "logo_path": "images/sponsors/ko.png",        "url": "https://www.instagram.com/knockoutmediasg?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw=="},
    {"name": "Kaboom.my",  "logo_path": "images/sponsors/kaboom.png",    "url": "https://kaboom.my"},
    {"name": "trurec",     "logo_path": "images/sponsors/trurec.png",    "url": "https://truboxing.co/fighters"},
    {"name": "TSL",        "logo_path": "images/sponsors/tsl.png",       "url": "https://teamsoundandlight.com/"},
]
# --------------------------------------------------------------------


# ------------------------------ Routes -------------------------------
@app.route("/")
def home():
    """Home page: Featured Boxers + Sponsors."""
    conn = get_conn()
    conn.row_factory = sqlite3.Row

    placeholders = ",".join("?" * len(FEATURED_IDS))
    q = f"""
      SELECT id, name, nickname, weight_class, image_profile, country
      FROM fighters
      WHERE id IN ({placeholders})
      ORDER BY CASE id
        WHEN 'shamel' THEN 1
        WHEN 'bazooka' THEN 2
        WHEN 'danny'   THEN 3
        WHEN 'buki'    THEN 4
        ELSE 99 END
    """
    rows = [dict(r) for r in conn.execute(q, FEATURED_IDS).fetchall()]
    conn.close()

    featured = []
    for f in rows:
        img = f.get("image_profile") or "placeholders/fighter_placeholder.png"
        preview_path = "images/fighters/" + img
        state_label, flag_file = normalize_state_from_country(f.get("country") or "")
        featured.append(
            {
                "id": f.get("id", ""),
                "display_name": (f.get("name") or "").upper(),
                "weight_class": f.get("weight_class", ""),
                "preview_path": preview_path,
                "state_label": state_label,
                "flag_file": flag_file,
            }
        )

    return render_template("index.html", featured=featured, sponsors=SPONSORS)


@app.route("/fighters")
def fighters_page():
    search_query = request.args.get("search", "").strip().lower()
    weight_filter = request.args.get("weight", "").strip().lower()
    try:
        data = get_fighters_from_db()
    except Exception as e:
        print("⚠ DB Error, using backup list:", e)
        data = fighters_fallback

    filtered = []
    for f in data:
        name_ok = search_query in (f.get("name", "") or "").lower()
        weight_ok = weight_filter in (f.get("weight_class", "") or "").lower() if weight_filter else True
        if name_ok and weight_ok:
            filtered.append(f)

    return render_template("fighters.html", fighters=filtered)


@app.route("/fighter/<fighter_id>")
def fighter_profile(fighter_id):
    clean_id = (fighter_id or "").strip().lower()
    if clean_id != fighter_id:
        return redirect(url_for("fighter_profile", fighter_id=clean_id), code=301)

    try:
        fighter = get_fighter_by_id_from_db(clean_id)
    except Exception as e:
        print("⚠ DB Error, using backup list:", e)
        fighter = next(
            (f for f in fighters_fallback if (f.get("id", "") or "").strip().lower() == clean_id),
            None,
        )

    if not fighter:
        return "Fighter not found", 404

    return render_template("fighter_profile.html", fighter=fighter)


@app.route("/events")
def events_page():
    return render_template("events.html")


@app.route("/merchandise")
def merchandise():
    return render_template("merchandise.html")


@app.route("/sponsors")
def sponsors_page():
    # If you have a dedicated sponsors page, pass the data too.
    return render_template("sponsors.html", sponsors=SPONSORS)


@app.route("/contact")
def contact():
    return render_template("contact.html")


@app.route("/test-db")
def test_db():
    try:
        names = [f["name"] for f in get_fighters_from_db()]
        return "<br>".join(names)
    except Exception as e:
        return f"DB error: {e}", 500


@app.route("/debug-fights/<fighter_id>")
def debug_fights(fighter_id):
    fid = (fighter_id or "").strip().lower()
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute(
        """
        SELECT result, opponent, date, method, org
        FROM fight_history
        WHERE LOWER(fighter_id) = ?
        ORDER BY date DESC
        """,
        (fid,),
    )
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return "<br>".join([f"{r['date']} — {r['opponent']} — {r['result']} — {r['org']}" for r in rows])


@app.route("/healthz")
def healthz():
    return "ok", 200
# --------------------------------------------------------------------


if __name__ == "__main__":
    app.run(debug=True)
