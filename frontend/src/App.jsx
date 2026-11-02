import { useEffect, useRef, useState } from "react";

const STARTERS = [
  "Kal shaam ko koi waqt mil sakta hai?",
  "Clinic kahan hai aur kaun si doctor hain?",
  "Clinic ke timings kya hain?",
];

function prettyDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso ?? "";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function summarize({ tool, output: o = {} }) {
  if (tool === "check_slots")
    return o.error ?? (o.free?.length ? `${prettyDay(o.day)}: ${o.free.length} slots free` : `${prettyDay(o.day)}: closed`);
  if (tool === "book_appointment")
    return o.ok ? `Booking #${o.booking_id} confirmed for ${prettyDay(o.day)}, ${o.time}` : `Not booked: ${o.error}`;
  if (tool === "cancel_appointment")
    return o.ok ? `Booking #${o.cancelled} cancelled` : `Not cancelled: ${o.error}`;
  if (tool === "search_faq")
    return o.matches?.length ? `Found: ${o.matches[0].q.split("?")[0]}` : "Nothing matching in clinic info";
  return "";
}

const LABELS = {
  check_slots: "Checked the diary",
  book_appointment: "Booked a slot",
  cancel_appointment: "Cancelled a booking",
  search_faq: "Looked up clinic info",
};

export default function App() {
  const [history, setHistory] = useState([]);
  const [trace, setTrace] = useState([]);
  const [appts, setAppts] = useState([]);
  const [mode, setMode] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const loadAppts = () =>
    fetch("/api/appointments").then((r) => r.json()).then(setAppts).catch(() => {});

  useEffect(() => {
    loadAppts();
    fetch("/api/health").then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {});
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [history, busy]);

  async function send(msg) {
    const content = msg.trim();
    if (!content || busy) return;
    const next = [...history, { role: "user", content }];
    setHistory(next);
    setText("");
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      const lookup = [...data.trace].reverse().find((x) => x.tool === "check_slots" && x.output?.free?.length);
      setHistory([
        ...next,
        { role: "assistant", content: data.reply, slots: lookup ? lookup.output : null },
      ]);
      setTrace((t) => [...data.trace.map((x) => ({ ...x, at: new Date() })), ...t]);
      loadAppts();
    } catch {
      setHistory(history);
      setText(content);
      setError("Server se rabta nahi hua. Check karein ke backend port 8000 par chal raha hai.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id) {
    await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    loadAppts();
  }

  return (
    <div className="shell">
      <aside className="diary">
        <h1>Mulaqat</h1>
        <p className="tag">AI receptionist jo Urdu mein baat karta hai.</p>
        <h2>Upcoming bookings</h2>
        {appts.length === 0 ? (
          <p className="empty">Abhi koi booking nahi.</p>
        ) : (
          <ul className="appts">
            {appts.map((a) => (
              <li key={a.id}>
                <div className="when">{prettyDay(a.day)}, {a.time}</div>
                <div>{a.name} ({a.service})</div>
                <button onClick={() => cancel(a.id)}>Cancel booking #{a.id}</button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="chat">
        <header className="bar">
          <div>
            <h2>Multan Dental Clinic</h2>
            <p>Mon to Sat, 10:00 to 1:00 and 4:30 to 8:00, Multan Cantt. Unofficial demo.</p>
          </div>
          {mode && <span className={`mode ${mode}`}>{mode === "live" ? "Live AI" : "Demo mode"}</span>}
        </header>
        {mode === "demo" && (
          <p className="notice">
            Demo mode: abhi sirf waqt dekhna aur sawal-jawab chalte hain. Booking ke liye AI key lagani hogi.
          </p>
        )}
        <div className="log" role="log" aria-live="polite">
          {history.length === 0 && (
            <div className="welcome">
              <p className="lead">Assalam o alaikum, aap ko kab aana hai?</p>
              <div className="starters">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={`row ${m.role}`}>
              <p className={`msg ${m.role}`}>{m.content}</p>
              {m.slots && (
                <div className="chips">
                  {m.slots.free.map((t) => (
                    <button key={t} disabled={busy} onClick={() => send(`${m.slots.day} ko ${t} par appointment chahiye`)}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && <p className="msg assistant pending">Diary dekh raha hoon...</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <div ref={endRef} />
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Yahan likhein, jaise: parson 4 baje appointment chahiye"
            aria-label="Message"
          />
          <button type="submit" disabled={busy || !text.trim()}>Send</button>
        </form>
      </main>

      <aside className="ledger">
        <h2>Agent ledger</h2>
        <p className="tag">Agent ne kya kiya, har qadam yahan likha jata hai.</p>
        {trace.length === 0 ? (
          <p className="empty">Pehli entry yahan aaye gi.</p>
        ) : (
          <ol>
            {trace.map((t, i) => (
              <li key={i}>
                <div className="head">
                  <strong>{LABELS[t.tool] ?? t.tool}</strong>
                  <time>{t.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                </div>
                <p className="sum">{summarize(t)}</p>
                <details>
                  <summary>Raw data</summary>
                  <pre>{JSON.stringify({ input: t.input, output: t.output }, null, 1)}</pre>
                </details>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}