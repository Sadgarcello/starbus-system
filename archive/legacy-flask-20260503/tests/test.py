import sqlite3
from datetime import datetime, timezone

# -----------------------
# CONFIG
# -----------------------
DB_PATH = "fighters.db"  # change if needed (absolute path is OK)


# -----------------------
# DB
# -----------------------
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def has_column(table: str, column: str) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    cols = [r["name"].lower() for r in cur.fetchall()]
    conn.close()
    return column.lower() in cols


HAS_CLASS_COL = has_column("fighters", "class")


# -----------------------
# DATE PARSING (FIX)
# -----------------------
def parse_date_flex(s):
    """
    Supports common formats:
    - YYYY-MM-DD
    - DD/MM/YYYY  (your DB example: 24/05/2025)
    - DD-MM-YYYY
    - YYYY/MM/DD
    """
    if not s:
        return None
    s = str(s).strip()
    fmts = ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"]
    for fmt in fmts:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def recency_points(last_date):
    """
    Recency score:
    - <= 6 months: 15
    - <= 12 months: 8
    - older: 2
    - unknown: 0
    """
    d = parse_date_flex(last_date)
    if not d:
        return 0.0
    today = datetime.now(timezone.utc).date()
    days = (today - d).days
    if days <= 183:
        return 15.0
    if days <= 365:
        return 8.0
    return 2.0


# -----------------------
# STATS + SCORING
# -----------------------
def get_fighter_stats(fid: str):
    fid = (fid or "").strip().lower()
    conn = get_conn()
    cur = conn.cursor()

    if HAS_CLASS_COL:
        f = cur.execute("""
            SELECT id, name, nickname, weight_class, country, state_label,
                   COALESCE(class, 'Amateur') AS class
            FROM fighters
            WHERE LOWER(id)=?
        """, (fid,)).fetchone()
    else:
        f = cur.execute("""
            SELECT id, name, nickname, weight_class, country, state_label
            FROM fighters
            WHERE LOWER(id)=?
        """, (fid,)).fetchone()

    if not f:
        conn.close()
        return None

    s = cur.execute("""
        SELECT
          COALESCE(SUM(CASE WHEN result='Win'  THEN 1 END),0) AS wins,
          COALESCE(SUM(CASE WHEN result='Loss' THEN 1 END),0) AS losses,
          COALESCE(SUM(CASE WHEN result='Draw' THEN 1 END),0) AS draws,
          COALESCE(SUM(CASE WHEN result='Win' AND (method LIKE '%KO%' OR method LIKE '%TKO%') THEN 1 END),0) AS kos,
          COUNT(*) AS total_fights,
          MAX(date) AS last_date
        FROM fight_history
        WHERE LOWER(fighter_id)=?
    """, (fid,)).fetchone()

    conn.close()

    out = dict(f)
    out.update(dict(s))
    if "class" not in out:
        out["class"] = "Amateur"

    out["win_rate"] = (out["wins"] / out["total_fights"]) if out["total_fights"] else 0.0
    return out


def score_match(a: dict, b: dict):
    reasons, warnings = [], []

    # Phase 1 hard constraint: same weight_class
    if (a.get("weight_class") or "").strip().lower() != (b.get("weight_class") or "").strip().lower():
        return (0.0, [], ["Weight class mismatch"])

    score = 0.0

    # 1) Weight match
    score += 40.0
    reasons.append("Same weight class")

    # 2) Experience parity
    af, bf = int(a["total_fights"]), int(b["total_fights"])
    diff = abs(af - bf)
    exp_points = max(0.0, 20.0 - (diff * 3.0))
    score += exp_points
    reasons.append(f"Experience gap: {diff} fights")
    if diff >= 4:
        warnings.append("Big experience gap")

    # 3) Win-rate parity (noisy for tiny records)
    wr_diff = abs(float(a["win_rate"]) - float(b["win_rate"]))
    if af < 2 or bf < 2:
        # Reduce the penalty impact for small samples (0–1 fights)
        rec_points = max(0.0, 15.0 - (wr_diff * 12.0))
        reasons.append("Win-rate adjusted (small sample)")
    else:
        rec_points = max(0.0, 15.0 - (wr_diff * 30.0))
    score += rec_points
    reasons.append(f"Win-rate gap: {wr_diff:.2f}")

    # 4) Recency (minimum of both)
    rp = min(recency_points(a.get("last_date")), recency_points(b.get("last_date")))
    score += rp
    if rp >= 15:
        reasons.append("Both active recently")
    elif rp == 0:
        warnings.append("No fight date data")
    elif rp <= 2:
        warnings.append("Inactivity risk")

    # 5) Location proximity (stronger for real-world matching)
    a_state = (a.get("state_label") or "").strip().lower()
    b_state = (b.get("state_label") or "").strip().lower()
    a_country = (a.get("country") or "").strip().lower()
    b_country = (b.get("country") or "").strip().lower()

    if a_state and b_state and a_state == b_state:
        score += 15.0
        reasons.append("Same state")
    elif a_country and b_country and a_country == b_country:
        score += 10.0
        reasons.append("Same country")

    return (round(min(score, 100.0), 1), reasons[:6], warnings[:3])


def suggest_opponents(fighter_id: str, limit: int = 10):
    a = get_fighter_stats(fighter_id)
    if not a:
        return None, []

    weight = (a.get("weight_class") or "").strip().lower()
    if not weight:
        return a, []

    conn = get_conn()
    cur = conn.cursor()

    # If class exists, keep it; otherwise skip it.
    if HAS_CLASS_COL:
        candidates = cur.execute("""
            SELECT id
            FROM fighters
            WHERE LOWER(id) != LOWER(?)
              AND LOWER(COALESCE(weight_class,'')) = ?
              AND LOWER(COALESCE(class,'Amateur')) = LOWER(?)
            LIMIT 300
        """, (a["id"], weight, a.get("class") or "Amateur")).fetchall()
    else:
        candidates = cur.execute("""
            SELECT id
            FROM fighters
            WHERE LOWER(id) != LOWER(?)
              AND LOWER(COALESCE(weight_class,'')) = ?
            LIMIT 300
        """, (a["id"], weight)).fetchall()

    conn.close()

    results = []
    for row in candidates:
        b = get_fighter_stats(row["id"])
        if not b:
            continue
        score, reasons, warnings = score_match(a, b)
        if score <= 0:
            continue
        results.append({
            "id": b["id"],
            "name": b["name"],
            "score": score,
            "record": f'{b["wins"]}-{b["losses"]}-{b["draws"]} (KO {b["kos"]})',
            "last_date": b.get("last_date"),
            "state": b.get("state_label") or "",
            "country": b.get("country") or "",
            "reasons": reasons,
            "warnings": warnings,
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return a, results[:limit]


# -----------------------
# CLI HELPERS
# -----------------------
def list_some_ids(n=20):
    conn = get_conn()
    cur = conn.cursor()
    rows = cur.execute("SELECT id FROM fighters LIMIT ?", (n,)).fetchall()
    conn.close()
    return [r["id"] for r in rows]


# -----------------------
# MAIN
# -----------------------
if __name__ == "__main__":
    print("DB:", DB_PATH)
    print("fighters.class column exists?", HAS_CLASS_COL)
    print("Sample fighter IDs:", ", ".join(list_some_ids(15)))

    fighter_id = input("Enter fighter id to matchmake (e.g., bazooka): ").strip().lower()
    base, suggestions = suggest_opponents(fighter_id, limit=10)

    if not base:
        print("Fighter not found.")
        raise SystemExit(1)

    print("\nBase fighter:")
    print(f"- {base['id']} | {base['name']} | weight={base.get('weight_class') or '—'} | class={base.get('class')}")
    print(f"- record: {base['wins']}-{base['losses']}-{base['draws']} (KO {base['kos']}) | last={base.get('last_date')}\n")

    if not base.get("weight_class"):
        print("No weight_class for this fighter, so matching is empty.\n")
        raise SystemExit(0)

    if not suggestions:
        print("No suggestions found (likely no other fighters with the same weight_class).")
        print("Next: enable fallback matching (nearby weight classes / record-first).")
        raise SystemExit(0)

    print("Top suggestions:")
    for i, s in enumerate(suggestions, 1):
        print(f"{i:02d}) {s['score']:>5}  {s['id']:<18}  {s['name']:<25}  {s['record']}")
        loc = " ".join([x for x in [s["state"], s["country"]] if x])
        if loc:
            print(f"     location: {loc}")
        print(f"     reasons: {', '.join(s['reasons'])}")
        if s["warnings"]:
            print(f"     warnings: {', '.join(s['warnings'])}")
        print()
