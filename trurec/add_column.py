import sqlite3

conn = sqlite3.connect("fighters.db")
c = conn.cursor()

try:
    c.execute("ALTER TABLE fighters ADD COLUMN state_label TEXT;")
    print("✅ Column 'state_label' added successfully.")
except Exception as e:
    print("⚠️", e)

conn.commit()
conn.close()
