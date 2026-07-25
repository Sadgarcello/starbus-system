#!/usr/bin/env python3
"""Initialize or reset the local SQLite database."""

from database import init_schema

if __name__ == "__main__":
    init_schema()
    print("Database initialized at data/engineering_os.db")
