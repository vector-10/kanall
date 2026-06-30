import { Link } from "react-router-dom";

interface Props {
  isAuthed: boolean;
}

const PRIMITIVES = [
  {
    label: "DOUBLE-ENTRY LEDGER",
    body: "Every inbound payment posts two immutable entries sharing a transaction group. Credits and debits always sum to zero. Append-only — no UPDATE, no DELETE.",
  },
  {
    label: "IDEMPOTENCY GATE",
    body: "Webhook events are hints. The processed_events table ensures every payment is recorded exactly once, even under concurrent replay.",
  },
  {
    label: "CONVERGENCE SWEEP",
    body: "A background goroutine re-queries Nomba's API on a configurable interval, promoting provisional entries to confirmed or posting reversals.",
  },
  {
    label: "OUTBOUND DELIVERY",
    body: "Tenant callbacks dispatched from a transactional outbox with exponential backoff, retry tracking, and dead-letter visibility.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "REGISTER",
    body: "POST your organisation name and email. Receive an API key — shown exactly once.",
  },
  {
    n: "02",
    title: "PROVISION",
    body: "POST a virtual account with an external ref and customer name. Get a real NUBAN from Nomba in return.",
  },
  {
    n: "03",
    title: "RECEIVE",
    body: "Payments hit Nomba. Kanall verifies the webhook, posts double-entry ledger entries, and notifies your endpoint.",
  },
];

export default function LandingPage({ isAuthed }: Props) {
  const ctaTo = isAuthed ? "/accounts" : "/register";
  const navTo = isAuthed ? "/accounts" : "/login";
  const ctaLabel = isAuthed ? "DASHBOARD →" : "REGISTER →";
  const navLabel = isAuthed ? "DASHBOARD →" : "LOGIN →";

  return (
    <div
      className="relative overflow-hidden min-h-screen bg-[#0D0D0D] text-[#F5F5F5]"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* Yellow splash — top-right, wavy organic border */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0"
        style={{ width: "68%", height: "72vh", zIndex: 0 }}
        viewBox="0 0 440 720"
        preserveAspectRatio="none"
      >
        <path
          d="M 180,0 L 440,0 L 440,720
             C 405,662 355,700 315,645
             C 275,590 248,652 225,720
             C 185,658 245,588 198,512
             C 151,436 220,358 172,278
             C 124,198 200,128 155,58
             C 140,28 185,-8 180,0 Z"
          fill="#FFCD32"
        />
      </svg>

      {/* NAV */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-[#181818]">
        <span
          style={{
            fontFamily: "'Bungee Inline', sans-serif",
            fontSize: "24px",
            letterSpacing: "0.06em",
          }}
        >
          KANALL
        </span>
        <Link
          to={navTo}
          className="text-[#F5F5F5] bg-[#0D0D0D] px-4 py-2 text-sm font-semibold tracking-widest hover:opacity-75 transition-opacity"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {navLabel}
        </Link>
      </nav>

      {/* HERO */}
      <section className="relative z-10 px-6 md:px-12 pt-16 md:pt-28 pb-20 md:pb-32">
        <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left */}
          <div>
            <div className="flex items-center gap-3 mb-10">
              <div className="h-px w-6 bg-[#FFCD32]" />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "13px",
                  letterSpacing: "0.2em",
                  color: "#FFCD32",
                }}
              >
                BUILT ON NOMBA
              </span>
            </div>

            <h1
              className="font-medium leading-[1.06] mb-7"
              style={{
                fontSize: "clamp(2.6rem, 6vw, 4.0rem)",
                letterSpacing: "-0.025em",
                fontFamily: "var(--font-sans)",
              }}
            >
              Virtual account
              <br />
              infrastructure
              <br />
              <span className="text-[#FFCD32]">for any platf</span>
              <span className="text-[#0D0D0D] md:text-[#FFCD32]">orm.</span>
            </h1>

            <p
              className="text-[#606060] text-base md:text-lg leading-relaxed mb-10"
              style={{ maxWidth: 460 }}
            >
              Kanall is a domain-blind backend primitive. Provision dedicated
              NUBANs, record double-entry ledger entries, and deliver real-time
              payment events — without vertical-specific logic.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                to={ctaTo}
                className="bg-[#FFCD32] text-[#0D0D0D] px-7 py-3.5 text-sm font-semibold tracking-widest hover:opacity-90 transition-opacity"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {ctaLabel}
              </Link>
              <a
                href="#how-it-works"
                className="border border-[#282828] text-[#555555] px-7 py-3.5 text-sm tracking-widest hover:border-[#3C3C3C] hover:text-[#888] transition-colors"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                HOW IT WORKS
              </a>
            </div>
          </div>

          {/* Right — Terminal (desktop only) */}
          <div className="hidden lg:block">
            <div
              className="border border-[#1A1A1A] bg-[#070707]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {/* chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1A1A1A]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#252525]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#252525]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFCD32]" />
                <span
                  className="ml-2 text-[#2E2E2E]"
                  style={{ fontSize: "12px", letterSpacing: "0.1em" }}
                >
                  POST /v1/accounts
                </span>
              </div>

              {/* code */}
              <pre
                className="p-5 text-sm leading-[1.9] overflow-auto"
                style={{ color: "#777777", whiteSpace: "pre-wrap" }}
              >
                <span style={{ color: "#444444" }}>$ </span>
                <span style={{ color: "#FFCD32" }}>curl</span>
                {" -X POST kanall.app/v1/accounts \\\n"}
                {"   -H "}
                <span style={{ color: "#FFCD32" }}>
                  "X-API-Key: sk_live_..."
                </span>
                {" \\\n"}
                {`   -d '{"externalRef":"Swift Logistics"}'\n\n`}
                <span style={{ color: "#3A3A3A" }}>
                  {"HTTP/1.1 201 Created\n\n"}
                </span>
                {"{\n"}
                {'  "AccountRef": '}
                <span style={{ color: "#FFCD32" }}>"acme-001"</span>
                {",\n"}
                {'  "BankAccountNumber": '}
                <span style={{ color: "#FFCD32" }}>"8094423205"</span>
                {",\n"}
                {'  "BankName": '}
                <span style={{ color: "#555555" }}>"Access Bank"</span>
                {",\n"}
                {'  "Status": '}
                <span style={{ color: "#FFCD32" }}>"active"</span>
                {",\n"}
                {'  "Currency": '}
                <span style={{ color: "#FFCD32" }}>"NGN"</span>
                {"\n}"}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* RULE */}
      <div className="h-px bg-[#181818] mx-6 md:mx-12" />

      {/* PRIMITIVES */}
      <section className="px-6 md:px-12 py-16 md:py-24 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-12">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              letterSpacing: "0.2em",
              color: "#FFCD32",
            }}
          >
            PRIMITIVES
          </span>
          <div className="h-px flex-1 bg-[#181818]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {PRIMITIVES.map(({ label, body }) => (
            <div key={label} className="border-l-2 border-[#FFCD32] pl-5 py-1">
              <div
                className="font-semibold mb-3"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  letterSpacing: "0.15em",
                  color: "#FFCD32",
                }}
              >
                {label}
              </div>
              <p className="text-[#888888] text-base leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RULE */}
      <div className="h-px bg-[#181818] mx-6 md:mx-12" />

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="px-6 md:px-12 py-16 md:py-24 max-w-6xl mx-auto"
      >
        <div className="flex items-center gap-4 mb-12">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              letterSpacing: "0.2em",
              color: "#FFCD32",
            }}
          >
            HOW IT WORKS
          </span>
          <div className="h-px flex-1 bg-[#181818]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {STEPS.map(({ n, title, body }) => (
            <div key={n} className="flex gap-5">
              <div
                className="shrink-0 text-[#FFCD32]"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "1.8rem",
                  fontWeight: 300,
                  lineHeight: 1.1,
                }}
              >
                {n}
              </div>
              <div>
                <div
                  className="font-semibold mb-2 text-[#F5F5F5]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    letterSpacing: "0.15em",
                  }}
                >
                  {title}
                </div>
                <p className="text-[#888888] text-base leading-relaxed">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="border-t border-[#181818]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 py-14 md:py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <h2
              className="text-3xl md:text-4xl font-medium text-[#F5F5F5] mb-2"
              style={{ letterSpacing: "-0.015em" }}
            >
              Ready to provision your first account?
            </h2>
            <p className="text-[#3C3C3C] text-base">
              One API key. Unlimited virtual accounts. No vertical lock-in.
            </p>
          </div>
          <Link
            to={isAuthed ? "/accounts" : "/register"}
            className="shrink-0 bg-[#FFCD32] text-[#0D0D0D] px-8 py-4 text-sm font-semibold tracking-widest hover:opacity-90 transition-opacity"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {isAuthed ? "DASHBOARD →" : "REGISTER →"}
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#111111] px-6 md:px-12 py-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              letterSpacing: "0.18em",
              color: "#3C3C3C",
            }}
          >
            KANALL — POWERED BY NOMBA
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              letterSpacing: "0.1em",
              color: "#3C3C3C",
            }}
          >
            TEAM PRÓTOS
          </span>
        </div>
      </footer>
    </div>
  );
}
