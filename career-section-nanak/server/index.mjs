/**
 * Public site API: forms + CMS-style GETs (so the SPA works without the Mongo backend).
 *
 * Mounted at /api/v1, /v1, and root aliases (see app.use below).
 *
 * Run: npm run api
 * Local frontend: VITE_API_URL=http://localhost:2000/api/v1
 * Production: VITE_API_URL=https://apivnfast.patliputragroup.com/api/v1
 */
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const PORT = Number(process.env.FORMS_API_PORT || process.env.PORT || 5000);

const recent = {
  leads: [],
  testDrives: [],
  enquiries: [],
};
const MAX_RECENT = 80;

/** Same shape as Mongo `backend` + React `PublicSiteContext` defaults — keeps the SPA working when only this server is deployed. */
const DEFAULT_SITE_CONFIG = {
  whatsappNumber: "919231445060",
  phoneNumber: "+91 9231445060",
  heroTagline: "Bihar's First VinFast Dealer",
  leadStripTitle: "Ready to Go Electric?",
  leadStripSubtitle: "Leave your details and our EV advisor will reach out in 10 minutes.",
  vf7Price: "₹21,89,000*",
  vf6Price: "₹17,29,000*",
  vf7Range: "532 km",
  vf6Range: "468 km",
};

const DEFAULT_DEALER_SETTINGS = {
  dealerName: "Patliputra VinFast",
  phone: "+91 9231445060",
  whatsapp: "919231445060",
  email: "info@patliputravinfast.com",
  address:
    "Plot No. 2421, NH 30, Bypass Road, Opposite Indian Oil Pump, Paijawa, Patna, Bihar - 800009",
  showroomHours: "10 AM – 8 PM, Mon–Sat",
  gstNo: "",
};

function publicSuccess(res, data) {
  res.json({ success: true, data });
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function appendRecord(kind, record) {
  ensureDataDir();
  const file = path.join(DATA_DIR, `${kind}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(record) + "\n", "utf8");
}

function pushRecent(kind, entry) {
  const arr = recent[kind];
  arr.unshift(entry);
  if (arr.length > MAX_RECENT) arr.length = MAX_RECENT;
}

function ok(res, data, message) {
  res.status(201).json({ success: true, data: data ?? {}, message: message ?? "Created" });
}

function bad(res, message, status = 400, errors) {
  res.status(status).json({ success: false, message, errors });
}

/** When RECAPTCHA_SECRET_KEY is set, require a valid Google reCAPTCHA token (same as Mongo API). */
async function verifyRecaptchaOrReject(req, res) {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret) return true;

  const token = req.body?.recaptchaToken;
  if (!token || typeof token !== "string" || !token.trim()) {
    bad(res, "Security verification required. Please try again.");
    return false;
  }

  const params = new URLSearchParams();
  params.append("secret", secret);
  params.append("response", token.trim());
  const ip = req.ip || req.socket?.remoteAddress;
  if (ip) params.append("remoteip", String(ip));

  let data;
  try {
    const r = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    data = await r.json();
  } catch {
    bad(res, "Security verification could not be completed. Please try again.");
    return false;
  }

  if (!data.success) {
    bad(res, "Security verification failed. Please try again.");
    return false;
  }

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");
  if (typeof data.score === "number" && !Number.isNaN(minScore) && data.score < minScore) {
    bad(res, "Security verification failed. Please try again.");
    return false;
  }

  delete req.body.recaptchaToken;
  return true;
}

function requireMobile(body) {
  const m = String(body.mobile ?? "").replace(/\D/g, "").slice(0, 10);
  if (!/^[6-9]\d{9}$/.test(m)) {
    return { error: "Valid 10-digit Indian mobile required (starts with 6–9)." };
  }
  return { mobile: m };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON you can open in the browser to confirm the API is live on this host. */
function liveJson(req) {
  const host = req.get("host") || "";
  const xfHost = req.get("x-forwarded-host") || "";
  const xfProto = req.get("x-forwarded-proto") || "";
  const proto = xfProto || req.protocol || "http";
  const visibleHost = xfHost || host;
  return {
    live: true,
    ok: true,
    service: "vinfast-forms-api",
    message: "API is reachable on this host.",
    time: new Date().toISOString(),
    host: host || null,
    forwardedHost: xfHost || null,
    publicBaseUrl: visibleHost ? `${proto}://${visibleHost.split(",")[0].trim()}` : null,
    path: req.path,
    originalUrl: req.originalUrl,
    nodeEnv: process.env.NODE_ENV || "development",
    tryThesePaths: [
      "/ping",
      "/live",
      "/api/v1/live",
      "/api/v1/public/site-config",
      "/api/v1/public/dealer-settings",
    ],
  };
}

function buildV1Router() {
  const r = express.Router();

  r.get("/live", (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(liveJson(req));
  });

  r.get("/health", (req, res) => {
    res.json({
      ok: true,
      live: true,
      service: "vinfast-forms-api",
      time: new Date().toISOString(),
      host: req.get("host") || null,
      port: PORT,
    });
  });

  /* Public CMS reads — same paths as full Mongo backend; static defaults + empty lists (SPA falls back to bundled content). */
  r.get("/public/site-config", (_req, res) => publicSuccess(res, { ...DEFAULT_SITE_CONFIG }));
  r.get("/public/dealer-settings", (_req, res) => publicSuccess(res, { ...DEFAULT_DEALER_SETTINGS }));
  r.get("/public/hero-slides", (_req, res) => publicSuccess(res, []));
  r.get("/public/products", (_req, res) => publicSuccess(res, []));
  r.get("/public/products/:slug", (_req, res) =>
    res.status(404).json({ success: false, message: "Product not found" }),
  );
  r.get("/public/offers", (_req, res) => publicSuccess(res, []));
  r.get("/public/banners", (_req, res) => publicSuccess(res, []));
  r.get("/public/faqs", (_req, res) => publicSuccess(res, []));
  r.get("/public/testimonials", (_req, res) => publicSuccess(res, []));

  r.get("/forms-debug/recent", (_req, res) => {
    res.json({
      leads: recent.leads,
      testDrives: recent.testDrives,
      enquiries: recent.enquiries,
      files: {
        leads: path.join(DATA_DIR, "leads.jsonl"),
        testDrives: path.join(DATA_DIR, "test-drives.jsonl"),
        enquiries: path.join(DATA_DIR, "enquiries.jsonl"),
      },
    });
  });

  r.post("/leads", async (req, res) => {
    if (!(await verifyRecaptchaOrReject(req, res))) return;
    const body = req.body ?? {};
    const name = String(body.name ?? "").trim();
    if (!name) return bad(res, "Name is required.");
    const mob = requireMobile(body);
    if (mob.error) return bad(res, mob.error);

    const id = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const row = {
      id,
      receivedAt: new Date().toISOString(),
      name,
      mobile: mob.mobile,
      email: body.email ? String(body.email).trim() : undefined,
      city: body.city != null ? String(body.city).trim() : undefined,
      otherCity: body.otherCity ? String(body.otherCity).trim() : undefined,
      model: body.model != null ? String(body.model).trim() : undefined,
      interest: body.interest ? String(body.interest).trim() : undefined,
      source: body.source ? String(body.source).trim() : "Website",
      remarks: body.remarks ? String(body.remarks).trim() : undefined,
      financeNeeded: Boolean(body.financeNeeded),
      exchangeNeeded: Boolean(body.exchangeNeeded),
      pageSource: body.pageSource ? String(body.pageSource).trim() : undefined,
    };

    appendRecord("leads", row);
    pushRecent("leads", row);
    console.log("[leads]", row.source, row.name, row.mobile, row.model ?? "");
    ok(res, { id: row.id, receivedAt: row.receivedAt }, "Lead captured");
  });

  r.post("/test-drives", async (req, res) => {
    if (!(await verifyRecaptchaOrReject(req, res))) return;
    const body = req.body ?? {};
    const customerName = String(body.customerName ?? "").trim();
    if (!customerName) return bad(res, "Customer name is required.");
    const mob = requireMobile(body);
    if (mob.error) return bad(res, mob.error);
    const preferredDate = String(body.preferredDate ?? "").trim();
    if (!preferredDate) return bad(res, "Preferred date is required.");

    const id = `td_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const row = {
      id,
      receivedAt: new Date().toISOString(),
      customerName,
      mobile: mob.mobile,
      email: body.email ? String(body.email).trim() : undefined,
      model: body.model != null ? String(body.model).trim() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      preferredDate,
      preferredTime: body.preferredTime ? String(body.preferredTime).trim() : undefined,
      branch: body.branch ? String(body.branch).trim() : undefined,
      remarks: body.remarks ? String(body.remarks).trim() : undefined,
      pageSource: body.pageSource ? String(body.pageSource).trim() : undefined,
    };

    appendRecord("test-drives", row);
    pushRecent("testDrives", row);
    console.log("[test-drives]", row.customerName, row.mobile, row.preferredDate);
    ok(res, { id: row.id, receivedAt: row.receivedAt }, "Test drive request captured");
  });

  r.post("/enquiries", async (req, res) => {
    if (!(await verifyRecaptchaOrReject(req, res))) return;
    const body = req.body ?? {};
    const name = String(body.name ?? "").trim();
    if (!name) return bad(res, "Name is required.");
    const mob = requireMobile(body);
    if (mob.error) return bad(res, mob.error);
    const interest = String(body.interest ?? "").trim();
    if (!interest) return bad(res, "Interest / subject is required.");

    const id = `enq_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const row = {
      id,
      receivedAt: new Date().toISOString(),
      name,
      mobile: mob.mobile,
      email: body.email ? String(body.email).trim() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      model: body.model != null ? String(body.model).trim() : undefined,
      interest,
      message: body.message ? String(body.message).trim() : undefined,
      source: body.source ? String(body.source).trim() : "Contact Form",
    };

    appendRecord("enquiries", row);
    pushRecent("enquiries", row);
    console.log("[enquiries]", row.interest, row.name, row.mobile);
    ok(res, { id: row.id, receivedAt: row.receivedAt }, "Enquiry captured");
  });

  return r;
}

const app = express();
/** Behind nginx / a load balancer, set TRUST_PROXY=1 so req.protocol and host match the public URL. */
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}
app.use(cors({ origin: true }));
app.use(express.json({ limit: "256kb" }));

const v1 = buildV1Router();

/** Plain-text ping (load balancers, quick curl). */
app.get("/ping", (req, res) => {
  res.type("text/plain").send("pong");
});

/** Browser-friendly home (only exact `/`). */
app.get("/", (req, res) => {
  const j = liveJson(req);
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>API live — Patliputra VinFast</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    .ok { color: #0a0; font-weight: 700; }
    code { background: #f4f4f5; padding: 0.15rem 0.4rem; border-radius: 4px; }
    a { color: #c41230; }
    ul { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <p class="ok">Live</p>
  <p>This server is running and reached you at <code>${escapeHtml(j.host || "—")}</code>.</p>
  <p>Server time (UTC): <code>${escapeHtml(j.time)}</code></p>
  <p>If one URL 404s (proxy path), try another:</p>
  <ul>
    <li><a href="/live"><code>/live</code></a> (JSON)</li>
    <li><a href="/api/v1/live"><code>/api/v1/live</code></a></li>
    <li><a href="/v1/live"><code>/v1/live</code></a></li>
    <li><a href="/ping"><code>/ping</code></a> (text: pong)</li>
  </ul>
</body>
</html>`);
});

app.use("/api/v1", v1);
app.use("/v1", v1);
app.use(v1);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Not found: ${req.method} ${req.path}`,
    hint: "Try GET /ping, /live, /api/v1/live, or /v1/live — your reverse proxy may strip path prefixes.",
    originalUrl: req.originalUrl,
  });
});

ensureDataDir();
app.listen(PORT, () => {
  console.log(`Forms API on port ${PORT}`);
  console.log(`  GET  /ping  /live  /public/site-config  …`);
  console.log(`  POST /leads  /test-drives  /enquiries`);
  console.log(`  JSONL: ${DATA_DIR}`);
});
