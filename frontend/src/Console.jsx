import { useEffect, useRef, useState } from "react";

const STARTERS = [
  "Kal shaam ko koi waqt mil sakta hai?",
  "Clinic kahan hai aur kaun si doctor hain?",
  "Clinic ke timings kya hain?",
];
const LABELS = {
  check_slots: "Checked the diary",
  book_appointment: "Booked a slot",
  cancel_appointment: "Cancelled a booking",
  search_faq: "Looked up clinic info",
};

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

const readToken = () => { try { return sessionStorage.getItem("owner") || ""; } catch { return ""; } };
const saveToken = (t) => { try { t ? sessionStorage.setItem("owner", t) : sessionStorage.removeItem("owner"); } catch { /* ignore */ } };

export default function Console() {
  const [history, setHistory] = useState([]);
  const [trace, setTrace] = useState([]);
  const [appts, setAppts] = useState([]);
  const [health, setHealth] = useState({});
  const [token, setToken] = useState(readToken);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef(null);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  const loadAppts = () =>
    fetch("/api/appointments", { headers: authHeaders })
      .then((r) => r.json()).then(setAppts).catch(() => {});

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);
  useEffect(() => { loadAppts(); }, [token]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [history, busy]);

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
      if (r.status === 429) throw new Error("Bahut zyada messages. Thori der baad try karein.");
      if (!r.ok) throw new Error("Server ya AI service se jawab nahi aaya. Dobara koshish karein.");
      const data = await r.json();
      const lookup = [...data.trace].reverse().find((x) => x.tool === "check_slots" && x.output?.free?.length);
      setHistory([...next, { role: "assistant", content: data.reply, slots: lookup ? lookup.output : null }]);
      setTrace((t) => [...data.trace.map((x) => ({ ...x, at: new Date() })), ...t]);
      loadAppts();
    } catch (e) {
      setHistory(history);
      setText(content);
      setError(e.message || "Server se rabta nahi hua.");
    } finally {
      setBusy(false);
    }
  }

  async function login(e) {
    e.preventDefault();
    setLoginErr("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if (r.ok) {
      const { token: t } = await r.json();
      saveToken(t); setToken(t); setPw("");
    } else {
      setLoginErr(r.status === 503 ? "Owner login is server par set nahi." : r.status === 429 ? "Bahut koshishein. Baad mein try karein." : "Password galat hai.");
    }
  }
  const logout = () => { saveToken(""); setToken(""); };

  async function cancel(id) {
    await fetch(`/api/appointments/${id}`, { method: "DELETE", headers: authHeaders });
    loadAppts();
  }

  return (
    <div className="console">
      <aside className="panel diary">
        <h3>Diary</h3>
        <p className="hint">{token ? "Owner view: full phone numbers and cancel." : "Public view: phone numbers are masked."}</p>
        {appts.length === 0 ? (
          <p className="empty">No upcoming bookings yet.</p>
        ) : (
          <ul>
            {appts.map((a) => (
              <li key={a.id}>
                <b>{prettyDay(a.day)}, {a.time}</b>
                <span>{a.name} ({a.service})</span>
                <span className="phone">{a.phone}</span>
                {token && <button onClick={() => cancel(a.id)}>Cancel #{a.id}</button>}
              </li>
            ))}
          </ul>
        )}
        <div className="owner">
          {token ? (
            <button className="link" onClick={logout}>Log out of owner mode</button>
          ) : health.owner_login ? (
            <form onSubmit={login}>
              <label htmlFor="pw">Owner login</label>
              <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" />
              <button type="submit" disabled={!pw}>Unlock</button>
              {loginErr && <p className="err">{loginErr}</p>}
            </form>
          ) : (
            <p className="hint">Owner login is not set up on this server.</p>
          )}
        </div>
      </aside>

      <section className="panel chat">
        <header>
          <div>
            <h3>Multan Dental Clinic</h3>
            <p>Mon to Sat, 10:00 to 1:00 and 4:30 to 8:00. Unofficial demo.</p>
          </div>
          {health.mode && <span className={`mode ${health.mode}`}>{health.mode === "live" ? "Live AI" : "Demo mode"}</span>}
        </header>
        {health.mode === "demo" && (
          <p className="notice">Demo mode: slot lookup and clinic questions only. Booking needs an AI key on the server.</p>
        )}
        <div className="log" ref={logRef} role="log" aria-live="polite">
          {history.length === 0 && (
            <div className="welcome">
              <p>Assalam o alaikum, aap ko kab aana hai?</p>
              <div className="starters">
                {STARTERS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={`row ${m.role}`}>
              <p className={`msg ${m.role}`}>{m.content}</p>
              {m.slots && (
                <div className="chips">
                  {m.slots.free.map((t) => (
                    <button key={t} disabled={busy} onClick={() => send(`${m.slots.day} ko ${t} par appointment chahiye`)}>{t}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {busy && <p className="msg assistant pending"><i></i><i></i><i></i></p>}
          {error && <p className="err" role="alert">{error}</p>}
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} aria-label="Message"
                 placeholder="Yahan likhein, jaise: parson 4 baje appointment chahiye" />
          <button type="submit" disabled={busy || !text.trim()}>Send</button>
        </form>
      </section>

      <aside className="panel ledger">
        <h3>Agent ledger</h3>
        <p className="hint">Every step the agent takes, in plain words.</p>
        {trace.length === 0 ? (
          <p className="empty">The first entry appears here.</p>
        ) : (
          <ol>
            {trace.map((t, i) => (
              <li key={i}>
                <div className="head">
                  <b>{LABELS[t.tool] ?? t.tool}</b>
                  <time>{t.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                </div>
                <p>{summarize(t)}</p>
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