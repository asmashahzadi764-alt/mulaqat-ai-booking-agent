import { useEffect, useRef, useState } from "react";
import Console from "./Console.jsx";
import useReveal from "./useReveal.js";

const STACK = ["React 19", "Vite", "FastAPI", "Gemini API", "SQLite", "JWT", "pytest", "GitHub Actions"];

const PROBLEMS = [
  ["Calls go unanswered", "Patients message after hours and nobody replies until the next day."],
  ["Language gap", "Most booking tools speak English. Patients write Roman Urdu and Urdu."],
  ["Manual diaries", "Paper and WhatsApp bookings clash, and double bookings waste a doctor's time."],
];

const FEATURES = [
  ["Tool-calling agent", "The model decides when to check the diary, book or cancel. It is not a script, and each step runs real code.", "wide"],
  ["Urdu-first", "Replies in the patient's own language and script: Roman Urdu, Urdu or English.", ""],
  ["Agent ledger", "Every decision is logged beside the chat, with the exact data the agent saw.", ""],
  ["Safe booking", "A database rule makes double booking impossible, even if two chats race for one slot.", ""],
  ["Grounded answers", "Timings, address and doctor come from a knowledge base. Fees are never invented.", "wide"],
  ["Owner dashboard", "JWT login unlocks full phone numbers and cancellation. Public visitors see masked numbers.", ""],
];

const STEPS = [
  ["Ask", "The patient writes in their own words, like \"kal shaam ko waqt mil sakta hai?\"."],
  ["The agent checks", "It calls the diary tool, reads the free slots and offers times as tappable buttons."],
  ["Confirmed", "After a clear yes, it books the slot and hands back a booking ID."],
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
        const p = Math.min((t - t0) / 1200, 1);
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

export default function App() {
  useReveal();
  return (
    <>
      <nav className="nav">
        <a className="logo" href="#top"><span className="dot" />Mulaqat</a>
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
        <div className="track">
          {[...STACK, ...STACK].map((s, i) => <span key={i}>{s}</span>)}
        </div>
      </div>

      <section className="sec">
        <p className="badge" data-reveal>The challenge</p>
        <h2 data-reveal>Clinics are busy. Patients still need answers.</h2>
        <div className="grid3">
          {PROBLEMS.map(([t, d], i) => (
            <article key={t} className="card" data-reveal style={{ "--d": `${i * 90}ms` }}>
              <h3>{t}</h3><p>{d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sec" id="features">
        <p className="badge" data-reveal>Capabilities</p>
        <h2 data-reveal>Everything a front desk needs, built on an agent</h2>
        <div className="bento">
          {FEATURES.map(([t, d, w], i) => (
            <article key={t} className={`card glow ${w}`} data-reveal style={{ "--d": `${i * 70}ms` }}>
              <h3>{t}</h3><p>{d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sec" id="how">
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
      </section>

      <section className="sec stats" data-reveal>
        <div><b><Counter to={4} /></b><span>agent tools</span></div>
        <div><b><Counter to={13} /></b><span>daily slots</span></div>
        <div><b><Counter to={13} /></b><span>automated tests</span></div>
        <div><b><Counter to={3} /></b><span>languages</span></div>
      </section>

      <section className="sec" id="demo">
        <p className="badge" data-reveal>Live demo</p>
        <h2 data-reveal>Try it yourself</h2>
        <p className="lede" data-reveal>Ask for a time, a fee or the address. Watch the ledger on the right as the agent works.</p>
        <div data-reveal><Console /></div>
      </section>

      <section className="sec narrow" id="faq">
        <p className="badge" data-reveal>FAQ</p>
        <h2 data-reveal>Questions, answered</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="faq" data-reveal>
            <summary>{q}</summary><p>{a}</p>
          </details>
        ))}
      </section>

      <section className="sec final" data-reveal>
        <h2>See the agent book an appointment</h2>
        <a className="btn" href="#demo">Open the demo</a>
      </section>

      <footer className="foot">
        <span className="logo"><span className="dot" />Mulaqat</span>
        <p>Unofficial demo for Multan Dental Clinic, built only from publicly listed information. Not affiliated with or endorsed by the clinic.</p>
      </footer>
    </>
  );
}