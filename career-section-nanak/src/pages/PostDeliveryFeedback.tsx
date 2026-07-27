import { useMemo, useState } from "react";
import { publicPost } from "@/lib/api";
import feedbackLogo from "@/assets/patliputra-feedback-logo.png";

/**
 * Post-delivery feedback form (Patliputra_VinFast_Feedback_Website_Package).
 *
 * Intentionally URL-only: reachable at /post-delivery-feedback (e.g. via the
 * dealership QR code) and linked from no menu or footer. Standalone layout —
 * no site Navbar/Footer — with its own scoped styles (`.pdfb` prefix) so the
 * delivered design is untouched by the site's Tailwind theme.
 */

type RatingKey =
  | "firstResponse"
  | "consultation"
  | "testDrive"
  | "booking"
  | "deliveryReadiness"
  | "handover"
  | "overallJourney"
  | "recommend";

type RatingSection = {
  title: string;
  sub: string;
  items: [RatingKey, string][];
};

const PAGE1_SECTIONS: RatingSection[] = [
  {
    title: "Enquiry & consultation",
    sub: "Your first conversations with our team",
    items: [
      ["firstResponse", "Speed and quality of our first response"],
      ["consultation", "Understanding your needs and explaining the vehicle"],
    ],
  },
  {
    title: "Decision & booking",
    sub: "Test drive, pricing and coordination",
    items: [
      ["testDrive", "Test-drive and EV guidance"],
      ["booking", "Price clarity, booking and status updates"],
    ],
  },
];

const PAGE2_SECTIONS: RatingSection[] = [
  {
    title: "Delivery & handover",
    sub: "Vehicle readiness and ownership setup",
    items: [
      ["deliveryReadiness", "Vehicle condition and on-time delivery"],
      ["handover", "Features, documents, charging and app explanation"],
    ],
  },
  {
    title: "Overall experience",
    sub: "Your final impression of Patliputra VinFast",
    items: [
      ["overallJourney", "End-to-end buying experience"],
      ["recommend", "Likelihood to recommend us"],
    ],
  },
];

const PAGE1_KEYS: RatingKey[] = ["firstResponse", "consultation", "testDrive", "booking"];
const PAGE2_KEYS: RatingKey[] = ["deliveryReadiness", "handover", "overallJourney", "recommend"];

const RATING_WORDS = ["", "Needs attention", "Could improve", "Good", "Very good", "Excellent"];
const RATING_FACES = ["", "😕", "🙁", "🙂", "😊", "🤩"];
const LEAD_SOURCES = ["Digital", "Walk-in", "Referral", "Call", "Event", "Other"];
const VEHICLE_MODELS = ["VF 6", "VF 7", "MPV 7", "Limo Green"];

const STYLES = `
.pdfb{--blue:#0068b5;--deep:#073b64;--pale:#eaf5fd;--ink:#102f49;--muted:#647d91;--line:#d7e4ee;--green:#1fa855;margin:0;color:var(--ink);font-family:Arial,Helvetica,sans-serif;background:radial-gradient(circle at 15% 0,#dff3ff 0,transparent 34%),#eef6fb}
.pdfb *{box-sizing:border-box}
.pdfb button,.pdfb input,.pdfb select,.pdfb textarea{font:inherit}
.pdfb button{-webkit-tap-highlight-color:transparent}
.pdfb .shell{min-height:100vh;padding-bottom:40px}
.pdfb .brand{min-height:86px;padding:10px max(16px,env(safe-area-inset-left));display:flex;align-items:center;gap:12px;color:#fff;background:linear-gradient(115deg,var(--blue),#005b9f 55%,var(--deep));box-shadow:0 12px 28px rgba(7,59,100,.18)}
.pdfb .brand img{width:56px;height:66px;object-fit:contain}
.pdfb .brand p{margin:0}
.pdfb .brand .label{font-size:12px;font-weight:800;letter-spacing:.08em}
.pdfb .brand .sub{margin-top:4px;color:#d8f2ff;font-size:12px}
.pdfb .pill{margin-left:auto;padding:8px 10px;border:1px solid rgba(255,255,255,.35);border-radius:99px;background:rgba(255,255,255,.12);font-size:11px;white-space:nowrap}
.pdfb .card{width:min(calc(100% - 20px),680px);margin:14px auto 0;padding:clamp(20px,5vw,38px);border:1px solid rgba(202,221,234,.92);border-radius:26px;background:rgba(255,255,255,.97);box-shadow:0 22px 55px rgba(23,70,104,.13)}
.pdfb .progress-head{display:flex;align-items:center;gap:12px}
.pdfb .back,.pdfb .badge{width:42px;height:42px;border-radius:50%;display:grid;place-items:center}
.pdfb .back{border:1px solid var(--line);background:#fff;color:var(--deep);font-size:20px;cursor:pointer}
.pdfb .badge{background:var(--blue);color:#fff;font-size:12px;font-weight:900}
.pdfb .progress-copy{flex:1;display:flex;justify-content:space-between;color:var(--muted);font-size:12px}
.pdfb .progress-copy strong{color:var(--blue)}
.pdfb .track{height:8px;margin:16px 0 26px;border-radius:99px;overflow:hidden;background:#e6f0f6}
.pdfb .track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#13a6dc,var(--blue));transition:width .35s}
.pdfb .eyebrow{margin:0 0 9px;color:var(--blue);font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}
.pdfb h1{margin:0;color:var(--deep);font-size:clamp(28px,7vw,42px);line-height:1.04;letter-spacing:-.04em}
.pdfb .intro{margin:10px 0 22px;color:var(--muted);font-size:15px;line-height:1.5}
.pdfb .journey{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 23px;color:var(--blue);font-size:10px;font-weight:700}
.pdfb .journey i{width:clamp(10px,5vw,44px);height:2px;background:linear-gradient(90deg,#9ed9fb,var(--blue))}
.pdfb .section{margin-top:16px;padding:17px;border:1px solid var(--line);border-radius:21px;background:#fafdff}
.pdfb .section-title{display:flex;align-items:center;gap:11px;margin-bottom:15px}
.pdfb .section-title b{flex:0 0 34px;width:34px;height:34px;display:grid;place-items:center;border-radius:11px;color:var(--blue);background:var(--pale);font-size:11px}
.pdfb .section-title h2{margin:0;color:var(--deep);font-size:17px}
.pdfb .section-title p{margin:4px 0 0;color:var(--muted);font-size:11px}
.pdfb .grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.pdfb .field span,.pdfb .lead-source legend,.pdfb .comment span{display:block;margin:0 0 7px;color:#416177;font-size:12px;font-weight:800}
.pdfb .field input,.pdfb .field select,.pdfb .comment textarea{width:100%;padding:13px 14px;border:1.5px solid var(--line);border-radius:14px;outline:0;background:#f9fcfe;color:var(--ink)}
.pdfb .field input:focus,.pdfb .field select:focus,.pdfb .comment textarea:focus{border-color:var(--blue);background:#fff;box-shadow:0 0 0 4px rgba(0,104,181,.1)}
.pdfb .help{display:block;margin:6px 2px 0;color:#7a91a2;font-size:10px}
.pdfb .help.error{color:#c83e3e;font-weight:700}
.pdfb .help.good{color:#17874a;font-weight:700}
.pdfb .lead-source{margin:20px 0 0;padding:0;border:0}
.pdfb .chips{display:flex;flex-wrap:wrap;gap:8px}
.pdfb .chip{padding:10px 13px;border:1px solid var(--line);border-radius:99px;background:#fff;color:#3c6078;font-size:12px;font-weight:700;cursor:pointer}
.pdfb .chip.active{border-color:var(--blue);background:var(--blue);color:#fff}
.pdfb .ratings{display:grid;gap:11px}
.pdfb .rating{padding:14px;border:1.5px solid var(--line);border-radius:17px;background:#fbfdff}
.pdfb .rating.answered{border-color:#a9d5ee;background:#f6fbff}
.pdfb .question{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}
.pdfb .question h3{margin:0;font-size:14px;line-height:1.35}
.pdfb .rating-word{flex:0 0 auto;padding:5px 8px;border-radius:99px;background:var(--pale);color:var(--blue);font-size:9px;font-weight:800}
.pdfb .scores{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.pdfb .score{min-width:0;min-height:58px;padding:4px;border:1px solid #d5e3ec;border-radius:13px;background:#fff;color:#49677b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer}
.pdfb .score span{font-size:17px}
.pdfb .score strong{font-size:12px}
.pdfb .score.active{border-color:var(--blue);background:linear-gradient(145deg,#0a83d3,#0062aa);color:#fff;box-shadow:0 8px 15px rgba(0,104,181,.22);transform:translateY(-2px)}
.pdfb .comment{display:block;margin-top:18px}
.pdfb .comment textarea{min-height:94px;resize:vertical;line-height:1.45}
.pdfb .error-box{margin:16px 0 -4px;padding:12px 14px;border:1px solid #efb4b4;border-radius:13px;background:#fff4f4;color:#a32929;font-size:12px;text-align:center}
.pdfb .primary{width:100%;min-height:55px;margin-top:20px;border:0;border-radius:16px;background:linear-gradient(135deg,#0076c9,#005a9d);color:#fff;font-weight:800;box-shadow:0 13px 26px rgba(0,104,181,.24);cursor:pointer}
.pdfb .primary:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}
.pdfb .hint,.pdfb .privacy{text-align:center;color:#7a91a2;font-size:11px;margin:11px 0 0}
.pdfb .pdfb-hidden{display:none!important}
.pdfb .done{text-align:center}
.pdfb .success{width:88px;height:88px;margin:2px auto 22px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#e5fff0 48%,#b8f0ce 49%,#effff5 68%)}
.pdfb .success span{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:var(--green);color:#fff;font-size:25px}
.pdfb .done-copy{margin:16px 0;color:var(--muted);line-height:1.55}
.pdfb .reference{display:inline-block;padding:8px 13px;border-radius:99px;background:var(--pale);color:var(--blue);font-size:12px;font-weight:800}
.pdfb footer{text-align:center;color:#6f8798;font-size:11px;padding:25px 15px 0}
@media(max-width:560px){.pdfb .brand{min-height:80px}.pdfb .brand img{width:49px;height:60px}.pdfb .pill{font-size:9px}.pdfb .card{width:calc(100% - 14px);padding:21px 15px;border-radius:22px}.pdfb .grid{grid-template-columns:1fr}.pdfb .section{padding:14px 11px}.pdfb .question{display:block}.pdfb .rating-word{display:inline-block;margin-top:7px}.pdfb .scores{gap:5px}}
`;

const MOBILE_OK = /^\d{10}$/;

const PostDeliveryFeedback = () => {
  const [page, setPage] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileTouched, setMobileTouched] = useState(false);
  const [model, setModel] = useState(VEHICLE_MODELS[0]);
  const [colour, setColour] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [leadSource, setLeadSource] = useState("Digital");
  const [comment, setComment] = useState("");
  const [ratings, setRatings] = useState<Partial<Record<RatingKey, number>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [reference, setReference] = useState("");

  const mobileGood = MOBILE_OK.test(mobile);

  const pageComplete = useMemo(() => {
    const keys = page === 1 ? PAGE1_KEYS : PAGE2_KEYS;
    const rated = keys.every((key) => ratings[key]);
    if (page === 2) return rated;
    return rated && Boolean(name.trim()) && mobileGood;
  }, [page, ratings, name, mobileGood]);

  const setRating = (key: RatingKey, score: number) => {
    setRatings((prev) => ({ ...prev, [key]: score }));
  };

  const showPage = (number: 1 | 2) => {
    setPage(number);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = async () => {
    if (!pageComplete) {
      if (page === 1) setMobileTouched(true);
      return;
    }
    if (page === 1) {
      showPage(2);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const result = await publicPost("/post-delivery-feedback", {
        name: name.trim(),
        mobile,
        model,
        colour: colour.trim(),
        deliveryDate,
        leadSource,
        comment: comment.trim(),
        ratings,
      });
      const data = (result.data ?? {}) as { id?: unknown; reference?: unknown };
      setReference(String(data.reference ?? data.id ?? ""));
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("We could not submit your feedback. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  const mobileHelpClass = mobileGood ? "help good" : mobileTouched ? "help error" : "help";
  const mobileHelpText = mobileGood
    ? "10-digit number verified ✓"
    : mobileTouched
      ? "Enter exactly 10 digits."
      : "Digits only—no country code or spaces.";

  const renderSections = (sections: RatingSection[], start: number) =>
    sections.map((section, index) => (
      <section className="section" key={section.title}>
        <div className="section-title">
          <b>{String(start + index).padStart(2, "0")}</b>
          <div>
            <h2>{section.title}</h2>
            <p>{section.sub}</p>
          </div>
        </div>
        <div className="ratings">
          {section.items.map(([key, label]) => (
            <article className={`rating ${ratings[key] ? "answered" : ""}`} key={key}>
              <div className="question">
                <h3>{label}</h3>
                <span className="rating-word">{ratings[key] ? RATING_WORDS[ratings[key] as number] : "Rate 1–5"}</span>
              </div>
              <div className="scores" role="radiogroup" aria-label={label}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    type="button"
                    className={`score ${ratings[key] === score ? "active" : ""}`}
                    role="radio"
                    aria-checked={ratings[key] === score}
                    onClick={() => setRating(key, score)}
                  >
                    <span>{RATING_FACES[score]}</span>
                    <strong>{score}</strong>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    ));

  return (
    <div className="pdfb">
      <style>{STYLES}</style>
      <main className="shell">
        <header className="brand">
          <img src={feedbackLogo} alt="Patliputra VinFast" />
          <div>
            <p className="label">POST-DELIVERY EXPERIENCE</p>
            <p className="sub">Patliputra VinFast</p>
          </div>
          <span className="pill">2 quick pages</span>
        </header>

        {!done ? (
          <section className="card">
            <div className="progress-head">
              {page === 2 && (
                <button className="back" type="button" aria-label="Previous page" onClick={() => showPage(1)}>
                  ←
                </button>
              )}
              {page === 1 && <span className="badge">01</span>}
              <div className="progress-copy">
                <span>Page {page} of 2</span>
                <strong>{page === 1 ? "50%" : "100%"}</strong>
              </div>
            </div>
            <div className="track">
              <span style={{ width: page === 1 ? "50%" : "100%" }} />
            </div>

            {page === 1 ? (
              <div>
                <div className="journey">
                  <span>Enquiry</span>
                  <i />
                  <span>Test drive</span>
                  <i />
                  <span>Booking</span>
                  <i />
                  <span>Delivery</span>
                </div>
                <p className="eyebrow">Page 1 · Sales journey</p>
                <h1>From enquiry to booking</h1>
                <p className="intro">A quick look at the most important moments before your VinFast delivery.</p>
                <section className="section">
                  <div className="section-title">
                    <b>01</b>
                    <div>
                      <h2>Customer & vehicle details</h2>
                      <p>Only the essentials for dealership follow-up</p>
                    </div>
                  </div>
                  <div className="grid">
                    <label className="field">
                      <span>Your name *</span>
                      <input
                        autoComplete="name"
                        placeholder="Customer name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Mobile number *</span>
                      <input
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        placeholder="10-digit number"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        onBlur={() => setMobileTouched(true)}
                      />
                      <small className={mobileHelpClass}>{mobileHelpText}</small>
                    </label>
                    <label className="field">
                      <span>Vehicle</span>
                      <select value={model} onChange={(e) => setModel(e.target.value)}>
                        {VEHICLE_MODELS.map((m) => (
                          <option key={m}>{m}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Vehicle colour</span>
                      <input placeholder="e.g. Crimson Red" value={colour} onChange={(e) => setColour(e.target.value)} />
                    </label>
                    <label className="field">
                      <span>Delivery date</span>
                      <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
                    </label>
                  </div>
                  <fieldset className="lead-source">
                    <legend>How did you first hear about us?</legend>
                    <div className="chips">
                      {LEAD_SOURCES.map((source) => (
                        <button
                          key={source}
                          type="button"
                          className={`chip ${source === leadSource ? "active" : ""}`}
                          onClick={() => setLeadSource(source)}
                        >
                          {source}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </section>
                {renderSections(PAGE1_SECTIONS, 2)}
              </div>
            ) : (
              <div>
                <p className="eyebrow">Page 2 · Delivery</p>
                <h1>Delivery & final verdict</h1>
                <p className="intro">Tell us how the handover felt and rate your complete experience.</p>
                {renderSections(PAGE2_SECTIONS, 1)}
                <label className="comment">
                  <span>One thing you loved—or one thing we should improve</span>
                  <textarea
                    placeholder="Optional: share a highlight, suggestion or pending concern…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </label>
              </div>
            )}

            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            <button className="primary" type="button" disabled={!pageComplete || submitting} onClick={() => void next()}>
              {submitting ? "Submitting…" : page === 1 ? "Continue to delivery →" : "Submit feedback"}
            </button>
            {!pageComplete && <p className="hint">Add your name, a valid 10-digit mobile number and all ratings.</p>}
            <p className="privacy">Your feedback is submitted securely to Patliputra VinFast.</p>
          </section>
        ) : (
          <section className="card done">
            <div className="success">
              <span>✓</span>
            </div>
            <p className="eyebrow">Feedback received</p>
            <h1>Thank you, {name.trim().split(/\s+/)[0]}.</h1>
            <p className="done-copy">
              Your response has been submitted to Patliputra VinFast. No further action is needed.
            </p>
            {reference && <p className="reference">Reference #{reference}</p>}
            <p className="done-copy">You may safely close this page.</p>
          </section>
        )}
        <footer>Patliputra VinFast · Customer Experience</footer>
      </main>
    </div>
  );
};

export default PostDeliveryFeedback;
