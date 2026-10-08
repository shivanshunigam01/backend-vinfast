const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const hpp = require('hpp');
const morgan = require('morgan');

const { notFound } = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const publicRoutes = require('./routes/public');
const metaLeadsRoutes = require('./routes/metaLeads');
const adminRoutes = require('./routes/admin');
const tdFeedbackRoutes = require('./routes/tdFeedbackRoutes');
const customerAuthRoutes = require('./routes/customerAuth');
const customerBookingsRoutes = require('./routes/customerBookings');

const app = express();

/** Always allow these in production even if CLIENT_URL is missing after a deploy. */
const BUILTIN_CORS_ORIGINS = [
  'https://patliputravinfast.in',
  'https://www.patliputravinfast.in',
  'http://localhost:5173',
  'http://localhost:8080',
];

/** Comma-separated origins, no trailing slash. Browsers send exact Origin (e.g. https://patliputravinfast.in). */
function corsAllowedOrigins() {
  const raw = process.env.CLIENT_URL || '';
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return [...new Set([...BUILTIN_CORS_ORIGINS, ...fromEnv])];
}

function isPatliputraVinfastOrigin(origin) {
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && protocol !== 'http:') return false;
    if (hostname === 'localhost') return true;
    return (
      hostname === 'patliputravinfast.in' ||
      hostname === 'www.patliputravinfast.in' ||
      hostname.endsWith('.patliputravinfast.in')
    );
  } catch {
    return false;
  }
}

function corsOriginAllowed(origin) {
  if (!origin) return true;
  const list = corsAllowedOrigins();
  if (list.includes(origin)) return true;
  return isPatliputraVinfastOrigin(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (corsOriginAllowed(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[CORS] blocked origin:', origin);
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(helmet());
app.use(compression());
app.use(hpp());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

const healthPayload = () => ({
  success: true,
  status: 'ok',
  service: 'Patliputra Group Showroom API',
  message: 'Server is healthy very healthy',
  timestamp: new Date().toISOString(),
  version: '2.1.0',
  modules: {
    pvLeadCrm: true,
    tdLeadCrm: true,
    tdStaffUsers: true,
    tdLeadReports: true,
    customerPortal: true,
    whatsappOtp: true,
  },
});

/** Root — for load balancers / uptime checks when proxy forwards `/health` only. */
app.get('/health', (req, res) => {
  res.status(200).json(healthPayload());
});

/** Same check under API prefix — use this if you only expose `/api/v1/*` to the internet. */
app.get('/api/v1/health', (req, res) => {
  res.status(200).json(healthPayload());
});

/**
 * SEO crawler files. The frontend host (patliputravinfast.in) should rewrite
 * /sitemap.xml and /robots.txt to these endpoints (also exposed under /api/v1
 * in case only that prefix is publicly reachable).
 */
const seoController = require('./controllers/seoController');
app.get('/sitemap.xml', seoController.getSitemap);
app.get('/robots.txt', seoController.getRobots);
app.get('/llms.txt', seoController.getLlmsTxt);
app.get('/api/v1/sitemap.xml', seoController.getSitemap);
app.get('/api/v1/robots.txt', seoController.getRobots);
app.get('/api/v1/llms.txt', seoController.getLlmsTxt);

app.use('/api/v1', metaLeadsRoutes);
app.use('/api/v1', publicRoutes);
app.use('/api/v1/td/feedback', tdFeedbackRoutes);
app.use('/api/v1/customer/auth', customerAuthRoutes);
app.use('/api/v1/customer/bookings', customerBookingsRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
