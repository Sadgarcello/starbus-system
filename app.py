# app.py
from flask import Flask, render_template, request, redirect, url_for, Response
import sqlite3
import os
import shutil
from datetime import datetime

app = Flask(__name__)

# -------------------- DB PATH (Render disk aware) --------------------
REPO_DB = os.path.join(os.path.dirname(__file__), "fighters.db")   # DB inside repo
DISK_DIR = "/var/data"                                             # Render disk mount
DISK_DB = os.path.join(DISK_DIR, "fighters.db")

USE_DISK = os.path.exists(DISK_DIR)

if USE_DISK and (not os.path.exists(DISK_DB)) and os.path.exists(REPO_DB):
    try:
        shutil.copyfile(REPO_DB, DISK_DB)
        print("✅ Seeded fighters.db to Render disk")
    except Exception as e:
        print("⚠️ Failed to seed DB to disk:", e)

DB_PATH = DISK_DB if USE_DISK else REPO_DB
print("USING DB:", DB_PATH)


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn
# --------------------------------------------------------------------


# -------------------------- Data helpers -----------------------------
fighters_fallback = []

def get_fighters_from_db():
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM fighters")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


def get_fighter_by_id_from_db(fighter_id: str):
    fid = (fighter_id or "").strip().lower()
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # Base fighter row (already includes W/L/D/KO from fighters table)
    c.execute("SELECT * FROM fighters WHERE LOWER(id) = ?", (fid,))
    fighter = c.fetchone()
    if not fighter:
        conn.close()
        return None

    fighter_dict = dict(fighter)

    # Attach fight history (don’t override stats — keep DB values)
    c.execute(
        """
        SELECT result, opponent, date, method, org
        FROM fight_history
        WHERE LOWER(fighter_id) = ?
        ORDER BY date DESC
        """,
        (fid,),
    )
    fighter_dict["fight_history"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return fighter_dict


def list_fighter_ids():
    try:
        conn = get_conn()
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT LOWER(id) AS id FROM fighters")
        ids = [r["id"] for r in c.fetchall() if r["id"]]
        conn.close()
        seen, unique = set(), []
        for fid in ids:
            if fid not in seen:
                unique.append(fid)
                seen.add(fid)
        return unique
    except Exception as e:
        print("⚠ list_fighter_ids DB error:", e)
        return []
# --------------------------------------------------------------------


# ----------------------- Home page featured --------------------------
FEATURED_IDS = ["shamel", "bazooka", "danny", "buki"]

STATE_FLAG_MAP = {
    "selangor": "selangor.png",
    "sarawak": "sarawak.png",
    "kuala-lumpur": "kuala-lumpur.png",
    "sabah": "sabah.png",
}

def normalize_state_from_country(country: str) -> tuple[str, str]:
    if not country:
        return ("", "")

    state = ""
    if "(" in country and ")" in country:
        state = country.split("(", 1)[1].split(")", 1)[0].strip()

    if not state and country.lower() not in ("malaysia",):
        state = country.strip()

    state_label = state
    key = state.lower().replace(" ", "-") if state else ""
    flag_file = STATE_FLAG_MAP.get(key, "")
    return (state_label, flag_file)
# --------------------------------------------------------------------


# ----------------------------- Sponsors ------------------------------
SPONSORS = [
    {"name": "Abang Besi", "logo_path": "images/sponsors/abangbesi.png", "url": "https://www.instagram.com/abangbesigallery"},
    {"name": "ko",         "logo_path": "images/sponsors/ko.png",        "url": "https://www.instagram.com/knockoutmediasg"},
    {"name": "Kaboom.my",  "logo_path": "images/sponsors/kaboom.png",    "url": "https://kaboom.my"},
    {"name": "trurec",     "logo_path": "images/sponsors/trurec.png",    "url": "https://truboxing.co/fighters"},
    {"name": "TSL",        "logo_path": "images/sponsors/tsl.png",       "url": "https://teamsoundandlight.com/"},
]
# --------------------------------------------------------------------


# ------------------------------ Routes -------------------------------
@app.route("/")
def home():
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
# --------------------------------------------------------------------


@app.route("/rankings")
def rankings():
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        rows = cur.execute("""
            WITH stats AS (
                SELECT
                    LOWER(fh.fighter_id) AS fid,
                    SUM(CASE WHEN fh.result='W' THEN 1 ELSE 0 END) AS wins,
                    SUM(CASE WHEN fh.result='L' THEN 1 ELSE 0 END) AS losses,
                    SUM(CASE WHEN fh.result='D' THEN 1 ELSE 0 END) AS draws,
                    SUM(CASE WHEN fh.result='W'
                             AND UPPER(COALESCE(fh.method,'')) LIKE '%KO%'
                             THEN 1 ELSE 0 END) AS kos
                FROM fight_history fh
                GROUP BY LOWER(fh.fighter_id)
            )
            SELECT
                f.id,
                f.name,
                f.country,
                COALESCE(f.image_profile, 'placeholders/fighter_placeholder.png') AS image_profile,
                COALESCE(s.wins,0)   AS wins,
                COALESCE(s.losses,0) AS losses,
                COALESCE(s.draws,0)  AS draws,
                COALESCE(s.kos,0)    AS kos,
                (3.0*COALESCE(s.wins,0) + 1.0*COALESCE(s.kos,0) - 1.0*COALESCE(s.losses,0)) AS total_points
            FROM fighters f
            LEFT JOIN stats s ON LOWER(f.id) = s.fid
            ORDER BY total_points DESC, s.wins DESC, s.kos DESC, f.name ASC
            LIMIT 10
        """).fetchall()

        last_raw = cur.execute("SELECT MAX(date) FROM fight_history").fetchone()[0]
        last_updated = str(last_raw) if last_raw else ""

    except sqlite3.OperationalError as e:
        conn.close()
        return f"SQLite error while computing rankings: {e}", 500

    conn.close()
    return render_template("rankings.html", fighters=rows, last_updated=last_updated)
# --------------------------------------------------------------------


@app.route("/healthz")
def healthz():
    return "ok", 200


if __name__ == "__main__":
    app.run(debug=True)
