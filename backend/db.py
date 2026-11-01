"""SQLite storage. A partial unique index makes double-booking impossible
at the database level, even if two chats race for the same slot."""
import sqlite3

DB = "mulaqat.db"
# Multan Dental Clinic (public listing): Mon-Sat, 10:00-13:00 and 16:30-20:00.
# 30-minute slots; the last slot of each session starts 30 minutes before closing.
OPEN_DAYS = {0, 1, 2, 3, 4, 5}  # Monday=0 ... Saturday=5
SLOTS = (
    [f"{h:02d}:{m}" for h in (10, 11, 12) for m in ("00", "30")]
    + ["16:30"]
    + [f"{h:02d}:{m}" for h in (17, 18, 19) for m in ("00", "30")]
)


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