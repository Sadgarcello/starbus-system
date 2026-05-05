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

USE_DISK = os.path.exists(DISK_DIR)  # True on Render when disk is mounted

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
    fid = (fighter_id or "").strip().lower()
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("SELECT * FROM fighters WHERE LOWER(id) = ?", (fid,))
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
        (fid,),
    )
    fighter_dict["fight_history"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return fighter_dict


def list_fighter_ids():
    """Return a list of fighter IDs for sitemap (lowercased, unique)."""
    try:
        conn = get_conn()
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("SELECT LOWER(id) AS id FROM fighters")
        ids = [r["id"] for r in c.fetchall() if r["id"]]
        conn.close()
        # Deduplicate while preserving order
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

# Full Malaysia states + federal territories → flag filename
STATE_FLAG_MAP = {
    # West Malaysia
    "johor": "johor.png",
    "kedah": "kedah.png",
    "kelantan": "kelantan.png",
    "malacca": "melaka.png",
    "melaka": "melaka.png",             # alt spelling
    "negeri sembilan": "negeri-sembilan.png",
    "pahang": "pahang.png",
    "penang": "pulau-pinang.png",
    "pulau pinang": "pulau-pinang.png",
    "perak": "perak.png",
    "perlis": "perlis.png",
    "selangor": "selangor.png",
    "terengganu": "terengganu.png",

    # East Malaysia
    "sabah": "sabah.png",
    "sarawak": "sarawak.png",

    # Federal Territories
    "kuala lumpur": "kuala-lumpur.svg",
    "putrajaya": "putrajaya.png",
    "labuan": "labuan.png",
}


def normalize_state_from_country(country: str, explicit_state: str = "") -> tuple[str, str]:
    """
    Return (state_label, flag_file).

    Priority:
    1. if DB already has a state_label column (explicit_state), trust that
    2. else try to parse "Malaysia (Selangor)" style country field
    3. else fall back to whole country if it's not just "Malaysia"
    """
    # Step 1: if caller already gave us a state_label from DB, use it
    if explicit_state:
        label = explicit_state.strip()
        key = label.lower()
        flag_file = STATE_FLAG_MAP.get(key, "")
        return (label, flag_file)

    # Step 2: try to extract (...) substring
    if not country:
        return ("", "")
    raw = country.strip()
    state = ""
    if "(" in raw and ")" in raw:
        state = raw.split("(", 1)[1].split(")", 1)[0].strip()

    # Step 3: fallback if not Malaysia
    if not state and raw.lower() not in ("malaysia",):
        state = raw

    label = state.strip()
    key = label.lower() if label else ""
    flag_file = STATE_FLAG_MAP.get(key, "")
    return (label, flag_file)
# --------------------------------------------------------------------


# ----------------------------- Sponsors ------------------------------
SPONSORS = [
    {
        "name": "Abang Besi",
        "logo_path": "images/sponsors/abangbesi.png",
        "url": "https://www.instagram.com/abangbesigallery?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
    },
    {
        "name": "ko",
        "logo_path": "images/sponsors/ko.png",
        "url": "https://www.instagram.com/knockoutmediasg?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==",
    },
    {
        "name": "Kaboom.my",
        "logo_path": "images/sponsors/kaboom.png",
        "url": "https://kaboom.my",
    },
    {
        "name": "trurec",
        "logo_path": "images/sponsors/trurec.png",
        "url": "https://truboxing.co/fighters",
    },
    {
        "name": "TSL",
        "logo_path": "images/sponsors/tsl.png",
        "url": "https://teamsoundandlight.com/",
    },
]
# --------------------------------------------------------------------


# ------------------------- NEW SAFE HELPERS --------------------------
def get_spotlight_from_db(limit: int = 3) -> list[dict]:
    """Read-only helper to pick spotlight fighters."""
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(
        """
        SELECT f.*,
               (SELECT MAX(h.date)
                  FROM fight_history h
                 WHERE LOWER(h.fighter_id)=LOWER(f.id)) AS last_date
          FROM fighters f
         ORDER BY f.wins DESC,
                  f.kos DESC,
                  COALESCE(last_date,'0000-00-00') DESC
         LIMIT ?
        """,
        (limit,),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_fighters_filtered(search: str = "", weight: str = "") -> list[dict]:
    """Read-only server-side filter for fighters list."""
    search = (search or "").strip().lower()
    weight = (weight or "").strip().lower()

    conn = get_conn()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM fighters")
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    def ok(f):
        name_ok = (search in (f.get("name") or "").lower()) if search else True
        wt_ok = (weight == (f.get("weight_class") or "").lower()) if weight else True
        return name_ok and wt_ok

    return [f for f in rows if ok(f)]
# --------------------------------------------------------------------


# ------------------------------ Routes -------------------------------
@app.route("/")
def home():
    """Home page: Featured Boxers + Sponsors."""
    conn = get_conn()
    conn.row_factory = sqlite3.Row

    placeholders = ",".join("?" * len(FEATURED_IDS))
    q = f"""
      SELECT id, name, nickname, weight_class, image_profile, country, state_label
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

        # pass both 'country' and 'state_label' into normalizer
        st_label, flag_file = normalize_state_from_country(
            f.get("country") or "",
            f.get("state_label") or "",
        )

        featured.append(
            {
                "id": f.get("id", ""),
                "display_name": (f.get("name") or "").upper(),
                "weight_class": f.get("weight_class", ""),
                "preview_path": preview_path,
                "state_label": st_label,
                "flag_file": flag_file,
            }
        )

    return render_template("index.html", featured=featured, sponsors=SPONSORS)


@app.route("/fighters")
def fighters_page():
    """Fighters directory with new design (safe)."""
    search_query  = request.args.get("search", "")
    weight_filter = request.args.get("weight", "")

    try:
        fighters = get_fighters_filtered(search_query, weight_filter)
        spotlight_fighters = get_spotlight_from_db(limit=3)
    except Exception as e:
        print("⚠ DB Error, using fallback list:", e)
        fighters = fighters_fallback
        spotlight_fighters = fighters_fallback[:3]

    # decorate each fighter dict with state_label + flag_file for template
    for f in fighters + spotlight_fighters:
        st_label, flag_file = normalize_state_from_country(
            f.get("country") or "",
            f.get("state_label") or "",
        )
        f["state_label"] = st_label
        f["flag_file"] = flag_file

    return render_template(
        "fighters.html",
        fighters=fighters,
        spotlight_fighters=spotlight_fighters,
        search_value=search_query,
        weight_value=weight_filter,
    )


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

    # also decorate fighter profile with state + flag for template
    st_label, flag_file = normalize_state_from_country(
        fighter.get("country") or "",
        fighter.get("state_label") or "",
    )
    fighter["state_label"] = st_label
    fighter["flag_file"] = flag_file

    return render_template("fighter_profile.html", fighter=fighter)


@app.route("/events")
def events_page():
    return render_template("events.html")


@app.route("/merchandise")
def merchandise():
    return render_template("merchandise.html")


@app.route("/sponsors")
def sponsors_page():
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


# ------------------------- SEO: robots & sitemap ----------------------
@app.route("/robots.txt")
def robots():
    lines = [
        "User-agent: *",
        "Disallow: /watch",
        "Disallow: /checkout",
        "Disallow: /thank-you",
        "Disallow: /test-db",
        "Disallow: /debug-fights",
        "Sitemap: https://truboxing.co/sitemap.xml",
    ]
    return Response("\n".join(lines), mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap():
    core_pages = [
        url_for("home", _external=True),
        url_for("fighters_page", _external=True),
        url_for("events_page", _external=True),
        url_for("sponsors_page", _external=True),
        url_for("merchandise", _external=True),
        url_for("contact", _external=True),
    ]
    if os.getenv("FEATURE_RANKINGS", "1") == "1":
        core_pages.append(url_for("rankings", _external=True))

    fighter_urls = [
        url_for("fighter_profile", fighter_id=fid, _external=True)
        for fid in list_fighter_ids()
    ]
    urls = core_pages + fighter_urls
    lastmod = datetime.utcnow().date().isoformat()

    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for loc in urls:
        xml_parts.append("<url>")
        xml_parts.append(f"<loc>{loc}</loc>")
        xml_parts.append(f"<lastmod>{lastmod}</lastmod>")
        xml_parts.append("<changefreq>weekly</changefreq>")
        xml_parts.append("<priority>0.7</priority>")
        xml_parts.append("</url>")
    xml_parts.append("</urlset>")
    return Response("\n".join(xml_parts), mimetype="application/xml")
# ---------------------------------------------------------------------


@app.route("/healthz")
def healthz():
    return "ok", 200


# --------------------------- Rankings page ---------------------------
FEATURE_RANKINGS = os.getenv("FEATURE_RANKINGS", "1") == "1"

@app.route("/rankings")
def rankings():
    if not FEATURE_RANKINGS:
        return "Rankings feature is disabled.", 404

    conn = get_conn()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        rows = cur.execute("""
WITH stats AS (
  SELECT
    LOWER(f.id) AS id,
    f.name,
    f.country,
    COALESCE(SUM(CASE WHEN h.result='Win'  THEN 1 END),0) AS wins,
    COALESCE(SUM(CASE WHEN h.result='Loss' THEN 1 END),0) AS losses,
    COALESCE(SUM(CASE WHEN h.result='Draw' THEN 1 END),0) AS draws,
    COALESCE(SUM(CASE WHEN h.result='Win' AND (h.method LIKE '%KO%' OR h.method LIKE '%TKO%') THEN 1 END),0) AS kos,
    MAX(h.date) AS last_date
  FROM fighters f
  LEFT JOIN fight_history h ON LOWER(h.fighter_id)=LOWER(f.id)
  GROUP BY f.id
),
base AS (
  SELECT *,
    (wins*4.0) + (kos*2.0) - (losses*1.5) - (draws*0.5) AS base_points,
    CASE WHEN wins>=3 AND losses=0 THEN 1.10 ELSE 1.0 END AS undefeated_mult,
    CASE WHEN last_date IS NOT NULL AND (julianday('now') - julianday(last_date)) <= 183
         THEN 1.20 ELSE 1.0 END AS recency_mult
  FROM stats
),
scored AS (
  SELECT *,
    ROUND(base_points * undefeated_mult * recency_mult, 1) AS total_points
  FROM base
)
SELECT
  s.id, s.name, s.country,
  s.total_points AS total_points,
  s.wins, s.losses, s.draws, s.kos,
  COALESCE(f.image_profile,'placeholders/fighter_placeholder.png') AS image_profile
FROM scored s
LEFT JOIN fighters f ON LOWER(f.id)=s.id
ORDER BY total_points DESC, wins DESC, kos DESC
LIMIT 10
""").fetchall()

        last_raw = cur.execute("SELECT MAX(date) FROM fight_history").fetchone()[0]
        last_updated = ""
        if last_raw:
            try:
                dt = datetime.fromisoformat(str(last_raw))
                last_updated = dt.strftime("%Y-%m-%d %H:%M")
            except Exception:
                last_updated = str(last_raw)
    except sqlite3.OperationalError as e:
        conn.close()
        return (f"Ranking view error: {e}", 500)
    conn.close()

    return render_template("rankings.html", fighters=rows, last_updated=last_updated)
# --------------------------------------------------------------------


if __name__ == "__main__":
    app.run(debug=True)
