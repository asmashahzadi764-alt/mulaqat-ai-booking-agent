import logging
import os
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

load_dotenv()
import agent  # noqa: E402  (after load_dotenv so env vars are read)
import db  # noqa: E402
import security  # noqa: E402

log = logging.getLogger("uvicorn.error")
chat_limiter = security.Limiter(limit=20, window=600)    # protects the AI key
login_limiter = security.Limiter(limit=5, window=300)    # slows password guessing


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init()
    yield


app = FastAPI(title="Mulaqat API", lifespan=lifespan)


class Msg(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1000)


class ChatIn(BaseModel):
    messages: list[Msg] = Field(min_length=1, max_length=30)


class LoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


def mask(phone: str) -> str:
    return f"{phone[:4]}***{phone[-3:]}" if len(phone) >= 8 else "***"


@app.get("/api/health")
def health():
    p = agent.provider()
    return {"ok": True, "provider": p, "mode": "demo" if p == "demo" else "live",
            "owner_login": security.admin_configured()}


@app.post("/api/chat")
def chat(body: ChatIn, request: Request):
    chat_limiter.check(security.client_ip(request))
    history = [m.model_dump() for m in body.messages]
    if agent.provider() == "demo":
        reply, trace = agent.mock_agent(history[-1]["content"])
    else:
        try:
            reply, trace = agent.run_agent(history)
        except Exception as e:  # an API outage should not crash the UI
            log.exception("AI provider call failed")  # full error shows in the terminal
            raise HTTPException(502, f"AI service error: {type(e).__name__}") from e
    return {"reply": reply, "trace": trace}


@app.post("/api/admin/login")
def login(body: LoginIn, request: Request):
    login_limiter.check(security.client_ip(request))
    if not security.admin_configured():
        raise HTTPException(503, "Owner login is not configured on this server")
    if not security.check_password(body.password):
        raise HTTPException(401, "Wrong password")
    return {"token": security.make_token()}


@app.get("/api/appointments")
def appointments(authorization: str | None = security.Header(default=None)):
    owner = security.is_owner(authorization)
    with db.conn() as c:
        rows = c.execute(
            "SELECT id, name, phone, service, day, time FROM appointments "
            "WHERE status='confirmed' AND day >= date('now','localtime') ORDER BY day, time"
        ).fetchall()
    out = [dict(r) for r in rows]
    if not owner:  # public visitors never see full phone numbers
        for r in out:
            r["phone"] = mask(r["phone"])
    return out


@app.delete("/api/appointments/{appt_id}", dependencies=[Depends(security.require_owner)])
def cancel(appt_id: int):
    with db.conn() as c:
        cur = c.execute(
            "UPDATE appointments SET status='cancelled' WHERE id=? AND status='confirmed'", (appt_id,)
        )
    if cur.rowcount != 1:
        raise HTTPException(404, "Booking not found")
    return {"ok": True}