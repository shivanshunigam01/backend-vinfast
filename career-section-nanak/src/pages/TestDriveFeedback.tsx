import { useMemo, useState } from "react";
import { publicPost } from "@/lib/api";
import feedbackLogo from "@/assets/patliputra-feedback-logo.png";

/**
 * Test-drive feedback form (Patliputra_VinFast_Test_Drive_Feedback_Website_Package).
 *
 * Intentionally URL-only: reachable at /test-drive-feedback (e.g. via the
 * dealership QR code) and linked from no menu or footer. Standalone layout —
 * no site Navbar/Footer — with its own scoped styles (`.tdfb` prefix) so the
 * delivered design is untouched by the site's Tailwind theme.
 */

type RatingKey =
  | "designComfort"
  | "rideQuietness"
  | "performanceHandling"
  | "featuresTechnology"
  | "productGuidance"
  | "consultantExperience"
  | "overallTestDrive"
  | "recommend";

const VEHICLE_QUESTIONS: [RatingKey, string][] = [
  ["designComfort", "Design and cabin comfort"],
  ["rideQuietness", "Ride quality and cabin quietness"],
  ["performanceHandling", "Performance, steering and braking"],
  ["featuresTechnology", "Features and technology"],
];

const FINAL_QUESTIONS: [RatingKey, string][] = [
  ["productGuidance", "Product and EV guidance"],
  ["consultantExperience", "Consultant professionalism and hospitality"],
  ["overallTestDrive", "Overall test-drive experience"],
  ["recommend", "Likelihood to recommend Patliputra VinFast"],
];

const RATING_WORDS = ["", "Needs attention", "Could improve", "Good", "Very good", "Excellent"];
const RATING_FACES = ["", "😕", "🙁", "🙂", "😊", "🤩"];
const LEAD_SOURCES = ["Digital", "Walk-in", "Referral", "Call", "Event", "Other"];
const VEHICLE_MODELS = ["VF 6", "VF 7", "MPV 7", "Limo Green"];
const PURCHASE_INTENTS = ["Within 15 days", "Within 1 month", "Within 3 months", "Exploring"];
const MAIN_CONCERNS = ["None", "Price", "Charging", "Range", "Finance", "Family decision"];

/** Brochure-style product highlights — multi-select on the last page. */
const LIKED_PRODUCT_OPTIONS = [
  "Exterior design / styling",
  "Cabin comfort & space",
  "Ride quality & quietness",
  "Performance & handling",
  "Features & technology",
  "Infotainment / connectivity",
  "Range / battery confidence",
  "Charging convenience",
  "Safety / ADAS",
  "Boot / storage space",
  "Value for money",
  "Warranty & after-sales",
] as const;

const STYLES = `
.tdfb{--blue:#0068b5;--deep:#073b64;--pale:#eaf5fd;--ink:#102f49;--muted:#647d91;--line:#d7e4ee;--green:#1fa855;margin:0;color:var(--ink);font-family:Arial,Helvetica,sans-serif;background:radial-gradient(circle at 15% 0,#dff3ff 0,transparent 34%),#eef6fb}
.tdfb *{box-sizing:border-box}
.tdfb button,.tdfb input,.tdfb select,.tdfb textarea{font:inherit}
.tdfb button{-webkit-tap-highlight-color:transparent}
.tdfb .shell{min-height:100vh;padding-bottom:40px}
.tdfb .brand{min-height:86px;padding:10px max(16px,env(safe-area-inset-left));display:flex;align-items:center;gap:12px;color:#fff;background:linear-gradient(115deg,var(--blue),#005b9f 55%,var(--deep));box-shadow:0 12px 28px rgba(7,59,100,.18)}
.tdfb .brand img{width:56px;height:66px;object-fit:contain}
.tdfb .brand p{margin:0}
.tdfb .brand .label{font-size:12px;font-weight:800;letter-spacing:.08em}
.tdfb .brand .sub{margin-top:4px;color:#d8f2ff;font-size:12px}
.tdfb .pill{margin-left:auto;padding:8px 10px;border:1px solid rgba(255,255,255,.35);border-radius:99px;background:rgba(255,255,255,.12);font-size:11px;white-space:nowrap}
.tdfb .card{width:min(calc(100% - 20px),680px);margin:14px auto 0;padding:clamp(20px,5vw,38px);border:1px solid rgba(202,221,234,.92);border-radius:26px;background:rgba(255,255,255,.97);box-shadow:0 22px 55px rgba(23,70,104,.13)}
.tdfb .progress-head{display:flex;align-items:center;gap:12px}
.tdfb .back,.tdfb .badge{width:42px;height:42px;border-radius:50%;display:grid;place-items:center}
.tdfb .back{border:1px solid var(--line);background:#fff;color:var(--deep);font-size:20px;cursor:pointer}
.tdfb .badge{background:var(--blue);color:#fff;font-size:12px;font-weight:900}
.tdfb .progress-copy{flex:1;display:flex;justify-content:space-between;color:var(--muted);font-size:12px}
.tdfb .progress-copy strong{color:var(--blue)}
.tdfb .track{height:8px;margin:16px 0 26px;border-radius:99px;overflow:hidden;background:#e6f0f6}
.tdfb .track span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#13a6dc,var(--blue));transition:width .35s}
.tdfb .eyebrow{margin:0 0 9px;color:var(--blue);font-size:12px;font-weight:800;letter-spacing:.11em;text-transform:uppercase}
.tdfb h1{margin:0;color:var(--deep);font-size:clamp(28px,7vw,42px);line-height:1.04;letter-spacing:-.04em}
.tdfb .intro{margin:10px 0 22px;color:var(--muted);font-size:15px;line-height:1.5}
.tdfb .journey{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 23px;color:var(--blue);font-size:10px;font-weight:700}
.tdfb .journey i{width:clamp(10px,5vw,44px);height:2px;background:linear-gradient(90deg,#9ed9fb,var(--blue))}
.tdfb .section{margin-top:16px;padding:17px;border:1px solid var(--line);border-radius:21px;background:#fafdff}
.tdfb .section-title{display:flex;align-items:center;gap:11px;margin-bottom:15px}
.tdfb .section-title b{flex:0 0 34px;width:34px;height:34px;display:grid;place-items:center;border-radius:11px;color:var(--blue);background:var(--pale);font-size:11px}
.tdfb .section-title h2{margin:0;color:var(--deep);font-size:17px}
.tdfb .section-title p{margin:4px 0 0;color:var(--muted);font-size:11px}
.tdfb .grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.tdfb .field span,.tdfb .chip-set legend,.tdfb .comment span{display:block;margin:0 0 7px;color:#416177;font-size:12px;font-weight:800}
.tdfb .field input,.tdfb .field select,.tdfb .comment textarea{width:100%;padding:13px 14px;border:1.5px solid var(--line);border-radius:14px;outline:0;background:#f9fcfe;color:var(--ink)}
.tdfb .field input:focus,.tdfb .field select:focus,.tdfb .comment textarea:focus{border-color:var(--blue);background:#fff;box-shadow:0 0 0 4px rgba(0,104,181,.1)}
.tdfb .help{display:block;margin:6px 2px 0;color:#7a91a2;font-size:10px}
.tdfb .help.error{color:#c83e3e;font-weight:700}
.tdfb .help.good{color:#17874a;font-weight:700}
.tdfb .chip-set{margin:20px 0 0;padding:0;border:0}
.tdfb .chips{display:flex;flex-wrap:wrap;gap:8px}
.tdfb .chip{padding:10px 13px;border:1px solid var(--line);border-radius:99px;background:#fff;color:#3c6078;font-size:12px;font-weight:700;cursor:pointer}
.tdfb .chip.active{border-color:var(--blue);background:var(--blue);color:#fff}
.tdfb .chip.check{border-radius:14px;padding-left:11px;padding-right:11px;display:inline-flex;align-items:center;gap:7px}
.tdfb .chip.check .mark{width:16px;height:16px;border:1.5px solid #b7cdda;border-radius:5px;display:grid;place-items:center;font-size:11px;line-height:1;background:#fff;color:transparent;flex:0 0 auto}
.tdfb .chip.check.active .mark{border-color:#fff;background:rgba(255,255,255,.22);color:#fff}
.tdfb .ratings{display:grid;gap:11px}
.tdfb .rating{padding:14px;border:1.5px solid var(--line);border-radius:17px;background:#fbfdff}
.tdfb .rating.answered{border-color:#a9d5ee;background:#f6fbff}
.tdfb .question{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}
.tdfb .question h3{margin:0;font-size:14px;line-height:1.35}
.tdfb .rating-word{flex:0 0 auto;padding:5px 8px;border-radius:99px;background:var(--pale);color:var(--blue);font-size:9px;font-weight:800}
.tdfb .scores{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.tdfb .score{min-width:0;min-height:58px;padding:4px;border:1px solid #d5e3ec;border-radius:13px;background:#fff;color:#49677b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer}
.tdfb .score span{font-size:17px}
.tdfb .score strong{font-size:12px}
.tdfb .score.active{border-color:var(--blue);background:linear-gradient(145deg,#0a83d3,#0062aa);color:#fff;box-shadow:0 8px 15px rgba(0,104,181,.22);transform:translateY(-2px)}
.tdfb .comment{display:block;margin-top:18px}
.tdfb .comment textarea{min-height:94px;resize:vertical;line-height:1.45}
.tdfb .error-box{margin:16px 0 -4px;padding:12px 14px;border:1px solid #efb4b4;border-radius:13px;background:#fff4f4;color:#a32929;font-size:12px;text-align:center}
.tdfb .primary{width:100%;min-height:55px;margin-top:20px;border:0;border-radius:16px;background:linear-gradient(135deg,#0076c9,#005a9d);color:#fff;font-weight:800;box-shadow:0 13px 26px rgba(0,104,181,.24);cursor:pointer}
.tdfb .primary:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}
.tdfb .hint,.tdfb .privacy{text-align:center;color:#7a91a2;font-size:11px;margin:11px 0 0}
.tdfb .done{text-align:center}
.tdfb .success{width:88px;height:88px;margin:2px auto 22px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#e5fff0 48%,#b8f0ce 49%,#effff5 68%)}
.tdfb .success span{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:var(--green);color:#fff;font-size:25px}
.tdfb .done-copy{margin:16px 0;color:var(--muted);line-height:1.55}
.tdfb .reference{display:inline-block;padding:8px 13px;border-radius:99px;background:var(--pale);color:var(--blue);font-size:12px;font-weight:800}
.tdfb footer{text-align:center;color:#6f8798;font-size:11px;padding:25px 15px 0}
@media(max-width:560px){.tdfb .brand{min-height:80px}.tdfb .brand img{width:49px;height:60px}.tdfb .pill{font-size:9px}.tdfb .card{width:calc(100% - 14px);padding:21px 15px;border-radius:22px}.tdfb .grid{grid-template-columns:1fr}.tdfb .section{padding:14px 11px}.tdfb .question{display:block}.tdfb .rating-word{display:inline-block;margin-top:7px}.tdfb .scores{gap:5px}}
`;

const MOBILE_OK = /^\d{10}$/;

const PAGE_TITLES: Record<1 | 2 | 3, { eyebrow: string; heading: string; intro: string }> = {
  1: {
    eyebrow: "Page 1 · Your visit",
    heading: "Let’s start with you",
    intro: "Just the essentials from today’s VinFast test drive.",
  },
  2: {
    eyebrow: "Page 2 · The vehicle",
    heading: "How did it feel?",
    intro: "Four quick ratings covering the complete drive experience.",
  },
  3: {
    eyebrow: "Page 3 · Your decision",
    heading: "Your final impression",
    intro: "Rate our team, tell us what you liked, and share any feedback for Patliputra VinFast.",
  },
};

const TestDriveFeedback = () => {
  const [page, setPage] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileTouched, setMobileTouched] = useState(false);
  const [city, setCity] = useState("");
  const [model, setModel] = useState(VEHICLE_MODELS[0]);
  const [testDriveDate, setTestDriveDate] = useState("");
  const [salesConsultant, setSalesConsultant] = useState("");
  const [leadSource, setLeadSource] = useState("Digital");
  const [purchaseIntent, setPurchaseIntent] = useState("");
  const [mainConcern, setMainConcern] = useState("None");
  const [likedFeatures, setLikedFeatures] = useState<string[]>([]);
  const [dislikedAboutProduct, setDislikedAboutProduct] = useState("");
  const [dealerSuggestions, setDealerSuggestions] = useState("");
  const [comment, setComment] = useState("");
  const [ratings, setRatings] = useState<Partial<Record<RatingKey, number>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [reference, setReference] = useState("");

  const mobileGood = MOBILE_OK.test(mobile);

  const pageComplete = useMemo(() => {
    if (page === 1) return Boolean(name.trim()) && mobileGood;
    if (page === 2) return VEHICLE_QUESTIONS.every(([key]) => ratings[key]);
    return FINAL_QUESTIONS.every(([key]) => ratings[key]) && Boolean(purchaseIntent);
  }, [page, ratings, name, mobileGood, purchaseIntent]);

  const hint =
    page === 1
      ? "Add your name and a valid 10-digit mobile number."
      : page === 2
        ? "Please rate all four vehicle items."
        : "Please complete all four ratings and select purchase intent.";

  const setRating = (key: RatingKey, score: number) => {
    setRatings((prev) => ({ ...prev, [key]: score }));
  };

  const showPage = (number: 1 | 2 | 3) => {
    setPage(number);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = async () => {
    if (!pageComplete) {
      if (page === 1) setMobileTouched(true);
      return;
    }
    if (page < 3) {
      showPage((page + 1) as 2 | 3);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const result = await publicPost("/test-drive-feedback", {
        name: name.trim(),
        mobile,
        city: city.trim(),
        model,
        testDriveDate,
        salesConsultant: salesConsultant.trim(),
        leadSource,
        ratings,
        purchaseIntent,
        mainConcern,
        likedFeatures,
        dislikedAboutProduct: dislikedAboutProduct.trim(),
        dealerSuggestions: dealerSuggestions.trim(),
        comment: comment.trim(),
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

  const renderRatings = (questions: [RatingKey, string][]) => (
    <div className="ratings">
      {questions.map(([key, label]) => (
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
  );

  const renderChips = (options: string[], selected: string, onSelect: (value: string) => void) => (
    <div className="chips">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={`chip ${option === selected ? "active" : ""}`}
          onClick={() => onSelect(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );

  const toggleLikedFeature = (option: string) => {
    setLikedFeatures((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option],
    );
  };

  const renderMultiCheckChips = (options: readonly string[], selected: string[]) => (
    <div className="chips" role="group" aria-label="What did you like about the product">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            className={`chip check ${active ? "active" : ""}`}
            aria-pressed={active}
            onClick={() => toggleLikedFeature(option)}
          >
            <span className="mark" aria-hidden>
              ✓
            </span>
            {option}
          </button>
        );
      })}
    </div>
  );

  const titles = PAGE_TITLES[page];

  return (
    <div className="tdfb">
      <style>{STYLES}</style>
      <main className="shell">
        <header className="brand">
          <img src={feedbackLogo} alt="Patliputra VinFast" />
          <div>
            <p className="label">TEST-DRIVE FEEDBACK</p>
            <p className="sub">Patliputra VinFast</p>
          </div>
          <span className="pill">3 quick pages</span>
        </header>

        {!done ? (
          <section className="card">
            <div className="progress-head">
              {page > 1 && (
                <button className="back" type="button" aria-label="Previous page" onClick={() => showPage((page - 1) as 1 | 2)}>
                  ←
                </button>
              )}
              {page === 1 && <span className="badge">01</span>}
              <div className="progress-copy">
                <span>Page {page} of 3</span>
                <strong>{Math.round((page / 3) * 100)}%</strong>
              </div>
            </div>
            <div className="track">
              <span style={{ width: `${Math.round((page / 3) * 100)}%` }} />
            </div>

            {page === 1 && (
              <div className="journey">
                <span>Visit</span>
                <i />
                <span>Drive</span>
                <i />
                <span>Decision</span>
              </div>
            )}
            <p className="eyebrow">{titles.eyebrow}</p>
            <h1>{titles.heading}</h1>
            <p className="intro">{titles.intro}</p>

            {page === 1 && (
              <section className="section">
                <div className="section-title">
                  <b>01</b>
                  <div>
                    <h2>Customer & test-drive details</h2>
                    <p>Short, practical and easy to complete</p>
                  </div>
                </div>
                <div className="grid">
                  <label className="field">
                    <span>Your name *</span>
                    <input
                      autoComplete="name"
                      maxLength={100}
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
                    <span>City</span>
                    <input maxLength={80} placeholder="Your city" value={city} onChange={(e) => setCity(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Vehicle tested</span>
                    <select value={model} onChange={(e) => setModel(e.target.value)}>
                      {VEHICLE_MODELS.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Test-drive date</span>
                    <input type="date" value={testDriveDate} onChange={(e) => setTestDriveDate(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Sales consultant</span>
                    <input
                      maxLength={100}
                      placeholder="Consultant name"
                      value={salesConsultant}
                      onChange={(e) => setSalesConsultant(e.target.value)}
                    />
                  </label>
                </div>
                <fieldset className="chip-set">
                  <legend>How did you reach us?</legend>
                  {renderChips(LEAD_SOURCES, leadSource, setLeadSource)}
                </fieldset>
              </section>
            )}

            {page === 2 && (
              <section className="section">
                <div className="section-title">
                  <b>02</b>
                  <div>
                    <h2>Vehicle experience</h2>
                    <p>Tap one rating for each item</p>
                  </div>
                </div>
                {renderRatings(VEHICLE_QUESTIONS)}
              </section>
            )}

            {page === 3 && (
              <>
                <section className="section">
                  <div className="section-title">
                    <b>03</b>
                    <div>
                      <h2>Consultant & overall experience</h2>
                      <p>Your final view of today’s visit</p>
                    </div>
                  </div>
                  {renderRatings(FINAL_QUESTIONS)}
                </section>
                <section className="section">
                  <div className="section-title">
                    <b>04</b>
                    <div>
                      <h2>Your next step</h2>
                      <p>Helps us support you without repeated calls</p>
                    </div>
                  </div>
                  <fieldset className="chip-set" style={{ margin: 0 }}>
                    <legend>When are you planning to purchase? *</legend>
                    {renderChips(PURCHASE_INTENTS, purchaseIntent, setPurchaseIntent)}
                  </fieldset>
                  <fieldset className="chip-set">
                    <legend>Your main concern</legend>
                    {renderChips(MAIN_CONCERNS, mainConcern, setMainConcern)}
                  </fieldset>
                </section>
                <section className="section">
                  <div className="section-title">
                    <b>05</b>
                    <div>
                      <h2>Product & dealership feedback</h2>
                      <p>Tick what you liked — then share anything else</p>
                    </div>
                  </div>
                  <fieldset className="chip-set" style={{ margin: 0 }}>
                    <legend>What did you like about the product? (select all that apply)</legend>
                    {renderMultiCheckChips(LIKED_PRODUCT_OPTIONS, likedFeatures)}
                  </fieldset>
                  <label className="comment">
                    <span>What did you not like about the product?</span>
                    <textarea
                      maxLength={1000}
                      placeholder="Share anything that could be better…"
                      value={dislikedAboutProduct}
                      onChange={(e) => setDislikedAboutProduct(e.target.value)}
                    />
                  </label>
                  <label className="comment">
                    <span>Any suggestions or feedback for Patliputra VinFast?</span>
                    <textarea
                      maxLength={1000}
                      placeholder="Ideas, service notes, or anything we should improve…"
                      value={dealerSuggestions}
                      onChange={(e) => setDealerSuggestions(e.target.value)}
                    />
                  </label>
                  <label className="comment">
                    <span>Anything else you’d like us to know?</span>
                    <textarea
                      maxLength={1000}
                      placeholder="Optional comment or pending question…"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </label>
                </section>
              </>
            )}

            {error && (
              <p className="error-box" role="alert">
                {error}
              </p>
            )}
            <button className="primary" type="button" disabled={!pageComplete || submitting} onClick={() => void next()}>
              {submitting
                ? "Submitting…"
                : page === 1
                  ? "Continue to vehicle →"
                  : page === 2
                    ? "Continue to final step →"
                    : "Submit feedback"}
            </button>
            {!pageComplete && <p className="hint">{hint}</p>}
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
              Your test-drive feedback has been submitted. No further action is needed.
            </p>
            {reference && <p className="reference">Reference {reference}</p>}
            <p className="done-copy">You may safely close this page.</p>
          </section>
        )}
        <footer>Patliputra VinFast · Test-Drive Experience</footer>
      </main>
    </div>
  );
};

export default TestDriveFeedback;
