import os
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

load_dotenv()
import agent  # noqa: E402  (after load_dotenv so MULAQAT_MODEL is read)
import db  # noqa: E402


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


@app.get("/api/health")
def health():
    return {"ok": True, "mode": "live" if os.getenv("ANTHROPIC_API_KEY") else "demo"}


@app.post("/api/chat")
def chat(body: ChatIn):
    history = [m.model_dump() for m in body.messages]
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            reply, trace = agent.run_agent(history)
        except Exception as e:  # network or API failure should not crash the UI
            raise HTTPException(502, f"LLM error: {type(e).__name__}") from e
    else:
        reply, trace = agent.mock_agent(history[-1]["content"])
    return {"reply": reply, "trace": trace}


@app.get("/api/appointments")
def appointments():
    with db.conn() as c:
        rows = c.execute(
            "SELECT id, name, phone, service, day, time FROM appointments "
            "WHERE status='confirmed' AND day >= date('now','localtime') ORDER BY day, time"
        ).fetchall()
    return [dict(r) for r in rows]


@app.delete("/api/appointments/{appt_id}")
def cancel(appt_id: int):
    with db.conn() as c:
        cur = c.execute(
            "UPDATE appointments SET status='cancelled' WHERE id=? AND status='confirmed'", (appt_id,)
        )
    if cur.rowcount != 1:
        raise HTTPException(404, "Booking not found")
    return {"ok": True}
