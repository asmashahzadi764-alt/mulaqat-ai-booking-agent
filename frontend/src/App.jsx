import { useEffect, useRef, useState } from "react";

const LABELS = {
  check_slots: "Checked the diary",
  book_appointment: "Booked a slot",
  cancel_appointment: "Cancelled a booking",
  search_faq: "Looked up clinic info",
};
const STARTERS = [
  "Kal shaam ko koi waqt mil sakta hai?",
  "Clinic kahan hai aur kaun si doctor hain?",
  "Clinic ke timings kya hain?",
];

const short = (v) => {
  const s = JSON.stringify(v);
  return s.length > 240 ? s.slice(0, 240) + "..." : s;
};

export default function App() {
  const [history, setHistory] = useState([]);
  const [trace, setTrace] = useState([]);
  const [appts, setAppts] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const loadAppts = () =>
    fetch("/api/appointments").then((r) => r.json()).then(setAppts).catch(() => {});

  useEffect(() => { loadAppts(); }, []);
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
        body: JSON.stringify({ messages: next }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setHistory([...next, { role: "assistant", content: data.reply }]);
      setTrace((t) => [...t, ...data.trace.map((x) => ({ ...x, at: new Date() }))]);
      loadAppts();
    } catch {
      setHistory(history); // roll back so the conversation stays valid
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
        <p className="tag">
          Multan Dental Clinic ka AI receptionist (unofficial demo). Roman Urdu, Urdu ya English mein baat karein.
        </p>
        <h2>Diary</h2>
        {appts.length === 0 ? (
          <p className="empty">Abhi koi booking nahi. Chat mein waqt maangein.</p>
        ) : (
          <ul className="appts">
            {appts.map((a) => (
              <li key={a.id}>
                <strong>{a.day}</strong> <span>{a.time}</span>
                <div>{a.name}, {a.service}</div>
                <button onClick={() => cancel(a.id)} aria-label={`Cancel booking ${a.id}`}>
                  Cancel booking {a.id}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className="chat">
        <div className="log" role="log" aria-live="polite">
          {history.length === 0 && (
            <div className="welcome">
              <p className="lead">Assalam o alaikum. Aap ko kab aana hai?</p>
              <div className="starters">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {history.map((m, i) => (
            <p key={i} className={`msg ${m.role}`}>{m.content}</p>
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
        <p className="tag">Agent jo bhi karta hai, yahan likha jata hai: kya dekha aur kya mila.</p>
        {trace.length === 0 ? (
          <p className="empty">Jab agent diary dekhega ya booking karega, uski entry yahan aaye gi.</p>
        ) : (
          <ol>
            {[...trace].reverse().map((t, i) => (
              <li key={i}>
                <div className="head">
                  <strong>{LABELS[t.tool] ?? t.tool}</strong>
                  <time>{t.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                </div>
                <pre>Sent: {short(t.input)}</pre>
                <pre>Got: {short(t.output)}</pre>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}