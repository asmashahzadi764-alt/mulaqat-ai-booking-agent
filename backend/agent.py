"""Tool-calling loop. The model decides which tool to run; every call and
result is returned as a trace so the UI can show *why* the agent acted."""
import json
import os
from datetime import date, timedelta

import tools

MODEL = os.getenv("MULAQAT_MODEL", "claude-sonnet-5-5")
MAX_STEPS = 6
S = {"type": "string"}


def _tool(name, desc, props, required):
    return {"name": name, "description": desc,
            "input_schema": {"type": "object", "properties": props, "required": required}}


TOOLS = [
    _tool("check_slots", "List free appointment times for one date.",
          {"day": {**S, "description": "YYYY-MM-DD"}}, ["day"]),
    _tool("book_appointment", "Book a slot. Only call after the patient confirmed name, phone, date and time.",
          {"name": S, "phone": S, "day": S, "time": {**S, "description": "HH:MM, 24-hour"},
           "service": {**S, "description": "e.g. Checkup, Cleaning, Filling"}},
          ["name", "phone", "day", "time"]),
    _tool("cancel_appointment", "Cancel a booking. Needs booking id and the phone used to book.",
          {"booking_id": {"type": "integer"}, "phone": S}, ["booking_id", "phone"]),
    _tool("search_faq", "Look up clinic timings, fees, address, policies, payments.",
          {"query": S}, ["query"]),
]


def system_prompt() -> str:
    today = date.today()
    return f"""You are Mulaqat, the receptionist of Shifa Dental Care.
Today is {today.isoformat()} ({today.strftime('%A')}).
- Reply in the patient's own language and script (Roman Urdu, Urdu or English). Keep replies short and warm.
- Always call check_slots before offering times. Never invent availability, fees or policies: use search_faq.
- Before booking, collect name, mobile number, date, time and service, then repeat them and wait for a clear yes.
- After booking, give the booking ID and tell them to keep it for cancellation.
- You cannot diagnose or give medical advice. For pain or swelling, share the emergency guidance from search_faq."""


def run_agent(history: list[dict]) -> tuple[str, list[dict]]:
    import anthropic  # imported lazily so demo mode needs no key

    client = anthropic.Anthropic()
    messages, trace = list(history), []
    for _ in range(MAX_STEPS):
        r = client.messages.create(
            model=MODEL, max_tokens=1000, system=system_prompt(), tools=TOOLS, messages=messages
        )
        messages.append({"role": "assistant", "content": r.content})
        calls = [b for b in r.content if b.type == "tool_use"]
        if not calls:
            return "".join(b.text for b in r.content if b.type == "text"), trace
        results = []
        for c in calls:
            out = tools.dispatch(c.name, c.input)
            trace.append({"tool": c.name, "input": c.input, "output": out})
            results.append({"type": "tool_result", "tool_use_id": c.id,
                            "content": json.dumps(out, ensure_ascii=False)})
        messages.append({"role": "user", "content": results})
    return "Maaf kijiye, kuch masla aaya. Dobara koshish karein.", trace


def mock_agent(text: str) -> tuple[str, list[dict]]:
    """Demo mode without an API key: slot lookup and FAQ only."""
    t, trace = text.lower(), []
    day = None
    if any(w in t for w in ("kal", "tomorrow")):
        day = date.today() + timedelta(days=1)
    elif any(w in t for w in ("aaj", "today")):
        day = date.today()
    if day:
        out = tools.check_slots(day.isoformat())
        trace.append({"tool": "check_slots", "input": {"day": day.isoformat()}, "output": out})
        free = ", ".join(out.get("free", [])[:8]) or "koi slot nahi"
        return (f"{day.strftime('%d %b')} ke khali waqt: {free}. "
                "(Demo mode: booking ke liye ANTHROPIC_API_KEY set karein.)"), trace
    out = tools.search_faq(text)
    trace.append({"tool": "search_faq", "input": {"query": text}, "output": out})
    if out["matches"]:
        return out["matches"][0]["answer"], trace
    return "Main waqt, fees, address ya policies ke baare mein bata sakta hoon.", trace
