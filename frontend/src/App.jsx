import { useEffect, useRef, useState } from "react";
import Console from "./Console.jsx";
import useReveal from "./useReveal.js";

const PORTFOLIO = "https://asmashahzadi764-alt.github.io/Personal-Portfolio/";
const STACK = ["React 19", "Vite", "FastAPI", "Gemini API", "SQLite", "JWT", "pytest", "GitHub Actions"];
const TOOLS = ["check_slots", "book_appointment", "cancel_appointment", "search_faq"];

const PROBLEMS = [
  ["Calls go unanswered", "Patients message after hours and nobody replies until the next day."],
  ["Language gap", "Most booking tools speak English. Patients write Roman Urdu and Urdu."],
  ["Manual diaries", "Paper and WhatsApp bookings clash, and double bookings waste a doctor's time."],
];

const FEATURES = [
  {
    n: "01", t: "Tool-calling agent", wide: true,
    d: "The model decides when to check the diary, book or cancel. It is not a script, and every step runs real code.",
    v: () => <div className="tools">{TOOLS.map((t, i) => <span key={t} style={{ "--i": i }}>{t}</span>)}</div>,
  },
  {
    n: "02", t: "Urdu-first",
    d: "Replies in the patient's own language and script.",
    v: () => (
      <div className="langs">
        <p>Kal waqt hai?</p>
        <p lang="ur" dir="rtl">کل وقت ہے؟</p>
        <p>Any slot tomorrow?</p>
      </div>
    ),
  },
  {
    n: "03", t: "Safe booking",
    d: "A database rule blocks double booking, even when two chats race for one slot.",
    v: () => (
      <div className="slotgrid">
        <span>10:00</span><span className="taken">10:30 taken</span><span>11:00</span>
        <span>11:30</span><span>12:00</span><span>12:30</span>
      </div>
    ),
  },
  {
    n: "04", t: "Agent ledger", wide: true,
    d: "Every decision is logged beside the chat, with the exact data the agent saw. Nothing happens in the dark.",
    v: () => (
      <div className="mini">
        <div style={{ "--i": 0 }}><b>Checked the diary</b> Sat 7 Nov: 13 slots free</div>
        <div style={{ "--i": 1 }}><b>Booked a slot</b> Booking #1 confirmed, 10:30</div>
        <div style={{ "--i": 2 }}><b>Looked up clinic info</b> Found: address</div>
      </div>
    ),
  },
  {
    n: "05", t: "Owner dashboard", wide: true,
    d: "A JWT login unlocks full phone numbers and cancellation. Public visitors only ever see masked numbers.",
    v: () => (
      <div className="rows">
        <div><span>Public view</span><b>0300***567</b></div>
        <div className="own"><span>Owner view</span><b>03001234567</b></div>
      </div>
    ),
  },
  {
    n: "06", t: "Grounded answers",
    d: "Address, hours and doctor come from a knowledge base.",
    v: () => (
      <div className="langs">
        <p>Fees kitni hain?</p>
        <p>Clinic mu'ayena ke baad batata hai.</p>
        <span className="tag-ok">No invented prices</span>
      </div>
    ),
  },
];

const STEPS = [
  ["Ask", "The patient writes in their own words, like \"kal shaam ko waqt mil sakta hai?\"."],
  ["The agent checks", "It calls the diary tool, reads the free slots and offers times as tappable buttons."],
  ["Confirmed", "After a clear yes, it books the slot and hands back a booking ID."],
];

const Icon = {
  tools: <svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" /></svg>,
  slots: <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  tests: <svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>,
  globe: <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18-3-3-3-15 0-18z" /></svg>,
};

const STATS = [
  [4, "agent tools", "Check, book, cancel and search", Icon.tools],
  [13, "daily slots", "Across two sessions, Monday to Saturday", Icon.slots],
  [13, "automated tests", "Run on every push with GitHub Actions", Icon.tests],
  [3, "languages", "Roman Urdu, Urdu and English", Icon.globe],
];

const FAQ = [
  ["Is this the clinic's official tool?", "No. It is an unofficial portfolio demo built only from the clinic's public listing (address and timings). Fees, policies and bookings are not real."],
  ["Which languages does it understand?", "Roman Urdu, Urdu and English. It answers in the language and script the patient used."],
  ["Can it double book a slot?", "No. SQLite enforces a unique confirmed slot per day and time, so a clash is rejected even if the AI makes a mistake."],
  ["Can it invent fees or policies?", "It is instructed to use only the clinic knowledge base, and the fees entry says the clinic confirms fees after examination."],
  ["How is the owner area protected?", "Login uses a server-side password and a signed JWT. The chat endpoint and login are rate limited."],
];

function Counter({ to }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(to); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min((t - t0) / 1400, 1);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{n}</span>;
}

// Full-width band with its own neon beams and glow behind a centered section.
function Band({ id, tone = "a", className = "", children }) {
  return (
    <div className={`band tone-${tone}`} id={id}>
      <i className="bm l" /><i className="bm r" /><i className="gl" />
      <section className={`sec ${className}`}>{children}</section>
    </div>
  );
}

function FeatureCard({ f }) {
  const spot = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <article className={`fcard${f.wide ? " wide" : ""}`} onMouseMove={spot} data-reveal>
      <span className="idx">{f.n}</span>
      <h3>{f.t}</h3>
      <p>{f.d}</p>
      <div className="vis">{f.v()}</div>
    </article>
  );
}

const Wordmark = () => <span className="wordmark">Mulaqat</span>;

export default function App() {
  useReveal();
  return (
    <>
      <nav className="nav">
        <a className="logo" href="#top"><Wordmark /></a>
        <div className="links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#demo">Demo</a>
          <a href="#faq">FAQ</a>
        </div>
        <a className="btn small" href="#demo">Try demo</a>
      </nav>

      <header className="hero" id="top">
        <div className="beam b1" /><div className="beam b2" /><div className="beam b3" />
        <div className="orb o1" /><div className="orb o2" />
        <p className="badge" data-reveal>Urdu-first AI receptionist</p>
        <h1 data-reveal style={{ "--d": "80ms" }}>The AI receptionist that speaks your patients' language</h1>
        <p className="sub" data-reveal style={{ "--d": "160ms" }}>
          Mulaqat books appointments in Roman Urdu, Urdu or English with a tool-calling agent that shows its work.
        </p>
        <div className="cta" data-reveal style={{ "--d": "240ms" }}>
          <a className="btn" href="#demo">Try the demo</a>
          <a className="btn ghost" href="#how">How it works</a>
        </div>
        <div className="float-card" aria-label="Example conversation">
          <span className="tagline">Example conversation</span>
          <p className="b u" style={{ "--i": 0 }}>Kal shaam ko appointment mil sakti hai?</p>
          <p className="b t" style={{ "--i": 1 }}>Checked the diary: 13 slots free</p>
          <p className="b a" style={{ "--i": 2 }}>Ji, shaam 4:30 se raat 8 baje tak waqt hai. Kaun sa waqt theek rahega?</p>
          <p className="b u" style={{ "--i": 3 }}>5 baje</p>
        </div>
      </header>

      <div className="marquee" aria-label="Built with">
        <div className="track">{[...STACK, ...STACK].map((s, i) => <span key={i}>{s}</span>)}</div>
      </div>

      <Band tone="c">
        <p className="badge" data-reveal>The challenge</p>
        <h2 data-reveal>Clinics are busy. Patients still need answers.</h2>
        <div className="grid3">
          {PROBLEMS.map(([t, d], i) => (
            <article key={t} className="card" data-reveal style={{ "--d": `${i * 90}ms` }}>
              <h3>{t}</h3><p>{d}</p>
            </article>
          ))}
        </div>
      </Band>

      <Band id="features" tone="a">
        <p className="badge" data-reveal>Capabilities</p>
        <h2 data-reveal>Everything a front desk needs, built on an agent</h2>
        <div className="bento">{FEATURES.map((f) => <FeatureCard key={f.n} f={f} />)}</div>
      </Band>

      <Band id="how" tone="b">
        <p className="badge" data-reveal>Process</p>
        <h2 data-reveal>How Mulaqat works</h2>
        <ol className="steps">
          {STEPS.map(([t, d], i) => (
            <li key={t} data-reveal style={{ "--d": `${i * 120}ms` }}>
              <span className="num">{i + 1}</span>
              <h3>{t}</h3><p>{d}</p>
            </li>
          ))}
        </ol>
      </Band>

      <Band tone="a">
        <p className="badge" data-reveal>By the numbers</p>
        <h2 data-reveal>Small project, solid engineering</h2>
        <div className="stat-grid">
          {STATS.map(([n, label, note, icon], i) => (
            <div key={label} className="stat" data-reveal style={{ "--d": `${i * 90}ms` }}>
              {icon}
              <b><Counter to={n} /></b>
              <strong>{label}</strong>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </Band>

      <Band id="demo" tone="a" className="wideband">
        <p className="badge" data-reveal>Live demo</p>
        <h2 data-reveal>Try it yourself</h2>
        <p className="lede" data-reveal>Ask for a time, an address or a booking. Watch the ledger on the right as the agent works.</p>
        <div data-reveal><Console /></div>
      </Band>

      <Band id="faq" tone="b" className="narrow">
        <p className="badge" data-reveal>FAQ</p>
        <h2 data-reveal>Questions, answered</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="faq" data-reveal>
            <summary>{q}</summary><p>{a}</p>
          </details>
        ))}
      </Band>

      <Band tone="final" className="final">
        <h2 data-reveal>See the agent book an appointment</h2>
        <a className="btn" href="#demo" data-reveal>Open the demo</a>
      </Band>

      <footer className="foot">
        <div className="foot-top">
          <div>
            <a className="logo" href="#top"><Wordmark /></a>
            <p className="foot-note">
              Unofficial demo for Multan Dental Clinic, built only from publicly listed information.
              Not affiliated with or endorsed by the clinic.
            </p>
          </div>
          <nav className="foot-links" aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#demo">Demo</a>
            <a href="#faq">FAQ</a>
          </nav>
          <p className="by">
            Built by <a href={PORTFOLIO} target="_blank" rel="noopener noreferrer">Asma Shahzadi</a>
          </p>
        </div>
        <div className="mega" aria-hidden="true">Mulaqat</div>
      </footer>
    </>
  );
}