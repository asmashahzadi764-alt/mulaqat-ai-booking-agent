# Mulaqat

An Urdu-first AI receptionist that books dental clinic appointments in Roman Urdu, Urdu or English. It is a tool-calling agent, not a scripted chatbot: the model decides when to check the diary, book, cancel or look up clinic information, and every decision is written to a visible **agent ledger**.

> Demo business: Shifa Dental Care (fictional). Swap `backend/faq.json` and the slot rules to adapt it to any appointment-based business.

## Why it is different

- **Urdu-first.** Replies in the patient's own language and script, including Roman Urdu.
- **Explainable.** The ledger beside the chat shows each tool call, its input and the exact result the agent received.
- **Safe booking.** A partial unique index in SQLite makes double-booking impossible, even if two chats race for the same slot. Cancelling needs the booking ID and the phone used to book.
- **Grounded answers.** Fees, timings and policies come from a knowledge base through a retrieval tool, so the agent does not invent them.
- **Runs without a key.** Demo mode answers slot and FAQ questions locally so the UI can be tried immediately.

## Architecture

```
React (Vite)  --/api/chat-->  FastAPI  -->  Agent loop (Claude, tool use)
     |                           |                 |
 chat + diary + ledger       SQLite  <---  check_slots / book_appointment
                                           cancel_appointment / search_faq
```

1. The UI sends the conversation to `POST /api/chat`.
2. The agent loop calls the model with four tools. If the model requests a tool, the backend runs it, returns the result and repeats (max 6 steps).
3. The final reply and the full tool trace go back to the UI.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite 7, plain CSS |
| Backend | FastAPI, Pydantic, SQLite |
| AI | Anthropic Claude API with tool use (`claude-sonnet-5-5`) |
| Tests | pytest |

## Getting started

Requirements: Python 3.10+, Node.js 20+.

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # add ANTHROPIC_API_KEY for live mode
uvicorn main:app --reload   # http://127.0.0.1:8000

# frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Without `ANTHROPIC_API_KEY` the app runs in demo mode (slots and FAQ only). Check the mode at `GET /api/health`.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/chat` | Send the conversation, get `reply` and `trace` |
| GET | `/api/appointments` | Upcoming confirmed bookings |
| DELETE | `/api/appointments/{id}` | Owner cancels a booking |
| GET | `/api/health` | Service status and mode |

## Tests

```bash
cd backend && pytest
```

Covers slot availability, double-booking prevention, cancellation rules, Sunday and lunch closures, phone validation and FAQ retrieval.

## Project structure

```
backend/   main.py (API)  agent.py (tool loop)  tools.py  db.py  faq.json  test_tools.py
frontend/  src/App.jsx  src/index.css  vite.config.js
```

## Design

Editorial, consulting-firm look: ivory paper, deep emerald, brass rules. Playfair Display carries the receptionist's voice, Inter handles interface text. The ledger uses a brass timeline so the agent's actions read like a written record.

## Known limits and roadmap

- The owner diary has no login yet. Next step: JWT auth for the dashboard.
- Retrieval is keyword-based. Next step: embeddings for larger knowledge bases.
- No WhatsApp or SMS channel yet. Next step: WhatsApp Business API webhook reusing the same agent.
- Single clinic, fixed hours. Next step: per-doctor schedules and reminders.
