from datetime import date, timedelta

import pytest

import db
import tools


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB", str(tmp_path / "test.db"))
    db.init()


def next_day(want_sunday=False):
    d = date.today() + timedelta(days=1)
    while (d.weekday() == 6) != want_sunday:
        d += timedelta(days=1)
    return d.isoformat()


def test_booked_slot_disappears():
    d = next_day()
    assert tools.book_appointment("Ali", "03001234567", d, "11:00")["ok"]
    assert "11:00" not in tools.check_slots(d)["free"]


def test_double_booking_blocked():
    d = next_day()
    tools.book_appointment("Ali", "03001234567", d, "11:00")
    assert not tools.book_appointment("Sara", "03111234567", d, "11:00")["ok"]


def test_cancel_needs_matching_phone():
    d = next_day()
    bid = tools.book_appointment("Ali", "03001234567", d, "11:30")["booking_id"]
    assert not tools.cancel_appointment(bid, "03999999999")["ok"]
    assert tools.cancel_appointment(bid, "0300-1234567")["ok"]
    assert "11:30" in tools.check_slots(d)["free"]


def test_closed_on_sunday():
    assert tools.check_slots(next_day(want_sunday=True))["free"] == []


def test_invalid_phone_rejected():
    assert not tools.book_appointment("Ali", "12345", next_day(), "10:00")["ok"]


def test_faq_does_not_invent_fees():
    answer = tools.search_faq("cleaning ki fees kitni hai")["matches"][0]["answer"]
    assert "Rs" not in answer and "mu'ayena" in answer


def test_two_sessions_match_clinic_hours():
    free = tools.check_slots(next_day())["free"]
    assert "10:00" in free and "16:30" in free and "19:30" in free
    assert "13:00" not in free and "20:00" not in free