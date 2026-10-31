"""SQLite storage. A partial unique index makes double-booking impossible
at the database level, even if two chats race for the same slot."""
import sqlite3

DB = "mulaqat.db"
# 10:00-17:30 in 30-minute steps, 13:00-14:00 is lunch.
SLOTS = [f"{h:02d}:{m}" for h in range(10, 18) for m in ("00", "30") if h != 13]


def conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c


def init() -> None:
    with conn() as c:
        c.execute(
            """CREATE TABLE IF NOT EXISTS appointments(
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 name TEXT NOT NULL, phone TEXT NOT NULL, service TEXT,
                 day TEXT NOT NULL, time TEXT NOT NULL,
                 status TEXT NOT NULL DEFAULT 'confirmed',
                 created_at TEXT DEFAULT CURRENT_TIMESTAMP)"""
        )
        c.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uniq_slot "
            "ON appointments(day, time) WHERE status = 'confirmed'"
        )
