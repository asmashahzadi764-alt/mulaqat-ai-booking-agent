"""Tool-calling loop. The model decides which tool to run; every call and
result is returned as a trace so the UI can show *why* the agent acted."""
import json
import os
import re
import time
from datetime import date, timedelta

import tools

CLAUDE_MODEL = os.getenv("MULAQAT_MODEL", "claude-sonnet-5-5")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")  # alias: always the current Flash model
# If the main model is overloaded (503) or retired (404), try these in order.
GEMINI_FALLBACKS = [m.strip() for m in os.getenv(
    "GEMINI_FALLBACKS", "gemini-3.1-flash-lite,gemini-3.5-flash-lite").split(",") if m.strip()]
RETRYABLE = {404, 429, 500, 502, 503, 504}
FALLBACK = "Maaf kijiye, kuch masla aaya. Dobara koshish karein."
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
    return f"""You are Mulaqat, the AI receptionist demo for Multan Dental Clinic (Dr. Arshad Mehmood, BDS), Multan Cantt. This is an unofficial demo built from public listing information.
Today is {today.isoformat()} ({today.strftime('%A')}).
- Reply in the patient's own language and script (Roman Urdu, Urdu or English). Keep replies short and warm.
- Plain text only: no markdown, no asterisks, no bold. Use short lines instead.
- Always call check_slots before offering times. Never invent availability, fees or policies: use search_faq.
- Before booking, collect name, mobile number, date, time and service, then repeat them and wait for a clear yes.
- After booking, give the booking ID and tell them to keep it for cancellation.
- Fees are not published: never quote prices, say the clinic confirms fees after examination.
- You cannot diagnose or give medical advice. For pain or swelling, share the emergency guidance from search_faq."""


def provider() -> str:
    if os.getenv("GEMINI_API_KEY"):
        return "gemini"
    if os.getenv("ANTHROPIC_API_KEY"):
        return "claude"
    return "demo"


def run_agent(history: list[dict]) -> tuple[str, list[dict]]:
    if provider() == "gemini":
        return _run_gemini(history)
    return _run_claude(history)


def _gemini_tools():
    from google.genai import types

    kinds = {"string": "STRING", "integer": "INTEGER"}
    decls = []
    for t in TOOLS:
        props = {
            k: types.Schema(type=kinds[v["type"]], description=v.get("description"))
            for k, v in t["input_schema"]["properties"].items()
        }
        decls.append(types.FunctionDeclaration(
            name=t["name"], description=t["description"],
            parameters=types.Schema(type="OBJECT", properties=props,
                                    required=t["input_schema"]["required"])))
    return [types.Tool(function_declarations=decls)]


def _generate(client, models, contents, config):
    """Call Gemini, retrying overloads and falling back to the next model.
    Returns (response, model_used)."""
    from google.genai import errors

    last = None
    for model in models:
        for attempt in range(2):
            try:
                return client.models.generate_content(model=model, contents=contents, config=config), model
            except errors.APIError as e:
                last = e
                if e.code not in RETRYABLE:
                    raise
                if e.code == 404:
                    break  # model retired: go straight to the next one
                time.sleep(1.5 * (attempt + 1))
    raise last


def _run_gemini(history: list[dict]) -> tuple[str, list[dict]]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    config = types.GenerateContentConfig(
        system_instruction=system_prompt(), tools=_gemini_tools(), max_output_tokens=1000,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True))
    contents = [types.Content(role="user" if m["role"] == "user" else "model",
                              parts=[types.Part(text=m["content"])]) for m in history]
    trace: list[dict] = []
    models = [GEMINI_MODEL, *GEMINI_FALLBACKS]
    for _ in range(MAX_STEPS):
        r, used = _generate(client, models, contents, config)
        models = [used] * 2  # stay on the model that worked for the rest of this chat turn
        if not r.candidates or not r.candidates[0].content:
            return FALLBACK, trace
        content = r.candidates[0].content
        calls = [p.function_call for p in (content.parts or []) if p.function_call]
        if not calls:
            text = "".join(p.text or "" for p in (content.parts or []) if p.text).strip()
            return text or FALLBACK, trace
        contents.append(content)  # keep the model turn exactly as returned
        parts = []
        for c in calls:
            out = tools.dispatch(c.name, dict(c.args or {}))
            trace.append({"tool": c.name, "input": dict(c.args or {}), "output": out})
            parts.append(types.Part(function_response=types.FunctionResponse(
                id=getattr(c, "id", None), name=c.name, response={"result": out})))
        contents.append(types.Content(role="user", parts=parts))
    return FALLBACK, trace


def _run_claude(history: list[dict]) -> tuple[str, list[dict]]:
    import anthropic  # imported lazily so demo mode needs no key

    client = anthropic.Anthropic()
    messages, trace = list(history), []
    for _ in range(MAX_STEPS):
        r = client.messages.create(
            model=CLAUDE_MODEL, max_tokens=1000, system=system_prompt(), tools=TOOLS, messages=messages
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
    return FALLBACK, trace


def mock_agent(text: str) -> tuple[str, list[dict]]:
    """Demo mode without an API key: rule-based slot lookup and FAQ only."""
    words, trace = set(re.findall(r"\w+", text.lower())), []
    offset = None
    if words & {"kal", "kl", "tomorrow"}:
        offset = 1
    elif words & {"aaj", "aj", "today"}:
        offset = 0
    elif words & {"parson", "parso", "parsoon"}:
        offset = 2
    wants_slot = bool(words & {"appointment", "apointment", "checkup", "book", "booking", "slot", "slots", "mily", "milay", "mil", "available"})
    if wants_slot and offset is None:
        return "Kis din aana chahenge? Aaj, kal ya parson bata dein.", trace
    if offset is not None and wants_slot:
        day = date.today() + timedelta(days=offset)
        for _ in range(7):  # skip closed days (e.g. Sunday) until a day has free slots
            out = tools.check_slots(day.isoformat())
            trace.append({"tool": "check_slots", "input": {"day": day.isoformat()}, "output": out})
            if out.get("free"):
                break
            day += timedelta(days=1)
        free = ", ".join(out.get("free", [])[:8]) or "koi slot nahi"
        return f"{day.strftime('%d %b')} ke khali waqt: {free}.", trace
    out = tools.search_faq(text)
    trace.append({"tool": "search_faq", "input": {"query": text}, "output": out})
    if out["matches"]:
        return out["matches"][0]["answer"], trace
    return "Main waqt, fees, address ya policies ke baare mein bata sakta hoon.", trace