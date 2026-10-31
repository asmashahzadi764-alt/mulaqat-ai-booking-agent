"""Tools the agent can call. Each returns a plain dict so results can be
shown in the UI ledger exactly as the model saw them."""
import json
import re
import sqlite3
from datetime import date, datetime
from pathlib import Path

import db

FAQ = json.loads((Path(__file__).parent / "faq.json").read_text(encoding="utf-8"))


def _day(s):
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def check_slots(day: str) -> dict:
    d = _day(day)
    if not d:
        return {"error": "Date YYYY-MM-DD format mein dein."}
    if d < date.today():
        return {"error": "Yeh date guzar chuki hai."}
    if d.weekday() == 6:
        return {"day": day, "free": [], "note": "Itwaar ko clinic band hota hai."}
    with db.conn() as c:
        rows = c.execute(
            "SELECT time FROM appointments WHERE day=? AND status='confirmed'", (day,)
        )
        taken = {r["time"] for r in rows}
    now = datetime.now().strftime("%H:%M") if d == date.today() else ""
    return {"day": day, "free": [s for s in db.SLOTS if s not in taken and s > now]}


def book_appointment(name: str, phone: str, day: str, time: str, service: str = "Checkup") -> dict:
    clean = re.sub(r"[\s-]", "", phone or "")
    if not re.fullmatch(r"(\+92|0)3\d{9}", clean):
        return {"ok": False, "error": "Valid mobile number chahiye, jaise 03XXXXXXXXX."}
    avail = check_slots(day)
    if "error" in avail or time not in avail["free"]:
        return {"ok": False, "error": "Yeh waqt available nahi.", "free": avail.get("free", [])}
    try:
        with db.conn() as c:
            cur = c.execute(
                "INSERT INTO appointments(name, phone, service, day, time) VALUES (?,?,?,?,?)",
                (name.strip(), clean, service, day, time),
            )
        return {"ok": True, "booking_id": cur.lastrowid, "day": day, "time": time, "service": service}
    except sqlite3.IntegrityError:
        return {"ok": False, "error": "Yeh slot abhi kisi aur ne le liya."}


def cancel_appointment(booking_id: int, phone: str) -> dict:
    clean = re.sub(r"[\s-]", "", phone or "")
    with db.conn() as c:
        cur = c.execute(
            "UPDATE appointments SET status='cancelled' "
            "WHERE id=? AND phone=? AND status='confirmed'",
            (booking_id, clean),
        )
    if cur.rowcount != 1:
        return {"ok": False, "error": "Booking ID aur phone number match nahi hue."}
    return {"ok": True, "cancelled": booking_id}


def _words(s: str) -> set:
    return set(re.findall(r"\w+", s.lower()))


def search_faq(query: str) -> dict:
    q = _words(query)
    scored = sorted(
        ((len(q & _words(f["q"] + " " + " ".join(f["keywords"]))), f) for f in FAQ),
        key=lambda x: -x[0],
    )
    return {"matches": [{"q": f["q"], "answer": f["a"]} for s, f in scored[:2] if s > 0]}


REGISTRY = {
    "check_slots": check_slots,
    "book_appointment": book_appointment,
    "cancel_appointment": cancel_appointment,
    "search_faq": search_faq,
}


def dispatch(name: str, args: dict) -> dict:
    fn = REGISTRY.get(name)
    if not fn:
        return {"error": f"Unknown tool {name}"}
    try:
        return fn(**args)
    except TypeError as e:
        return {"error": f"Bad arguments: {e}"}
