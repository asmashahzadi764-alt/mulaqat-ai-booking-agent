from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

import db
import main
import security
import tools


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB", str(tmp_path / "api.db"))
    for k in ("GEMINI_API_KEY", "ANTHROPIC_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("ADMIN_PASSWORD", "correct-horse")
    monkeypatch.setenv("JWT_SECRET", "test-secret")
    monkeypatch.setattr(main, "chat_limiter", security.Limiter(2, 60))
    monkeypatch.setattr(main, "login_limiter", security.Limiter(50, 60))
    with TestClient(main.app) as c:
        yield c


def book_one():
    d = date.today() + timedelta(days=1)
    while d.weekday() == 6:
        d += timedelta(days=1)
    return tools.book_appointment("Ali", "03001234567", d.isoformat(), "11:00")["booking_id"]


def login(client):
    return {"Authorization": "Bearer " + client.post("/api/admin/login", json={"password": "correct-horse"}).json()["token"]}


def test_wrong_password_rejected(client):
    assert client.post("/api/admin/login", json={"password": "nope"}).status_code == 401


def test_login_disabled_without_password(client, monkeypatch):
    monkeypatch.delenv("ADMIN_PASSWORD")
    assert client.post("/api/admin/login", json={"password": "x"}).status_code == 503


def test_public_sees_masked_phone_owner_sees_full(client):
    book_one()
    assert client.get("/api/appointments").json()[0]["phone"] == "0300***567"
    assert client.get("/api/appointments", headers=login(client)).json()[0]["phone"] == "03001234567"


def test_cancel_requires_owner_token(client):
    bid = book_one()
    assert client.delete(f"/api/appointments/{bid}").status_code == 401
    assert client.delete(f"/api/appointments/{bid}", headers={"Authorization": "Bearer fake"}).status_code == 401
    assert client.delete(f"/api/appointments/{bid}", headers=login(client)).status_code == 200


def test_chat_is_rate_limited(client):
    body = {"messages": [{"role": "user", "content": "clinic ke timings kya hain"}]}
    assert client.post("/api/chat", json=body).status_code == 200
    assert client.post("/api/chat", json=body).status_code == 200
    assert client.post("/api/chat", json=body).status_code == 429


def test_health_reports_demo_mode(client):
    h = client.get("/api/health").json()
    assert h["mode"] == "demo" and h["owner_login"] is True