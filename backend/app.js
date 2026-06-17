require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(v => v.trim()) : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    modules: {
      tdLeadCrm: true,
      tdStaffUsers: true,
      tdLeadReports: true,
      customerPortal: true,
      whatsappOtp: true
    }
  });
});

app.use('/api/v1/public', routes.public);
app.use('/api/v1/whatsapp-otp', routes.whatsappOtp);
app.use('/api/v1/leads', formLimiter, routes.publicLeads);
app.use('/api/v1/test-drives', formLimiter, routes.publicTestDrives);
app.use('/api/v1/enquiries', formLimiter, routes.publicEnquiries);

app.use('/api/v1/admin/auth', routes.auth);
app.use('/api/v1/admin/dashboard', routes.dashboard);
app.use('/api/v1/admin/leads', routes.adminLeads);
app.use('/api/v1/admin/meta-leads', routes.adminMetaLeads);
app.use('/api/v1/admin/test-drives', routes.adminTestDrives);
app.use('/api/v1/admin/enquiries', routes.adminEnquiries);
app.use('/api/v1/admin/products', routes.products);
app.use('/api/v1/admin/offers', routes.offers);
app.use('/api/v1/admin/homepage', routes.homepage);
app.use('/api/v1/admin/settings', routes.settings);
app.use('/api/v1/admin/content', routes.content);
app.use('/api/v1/admin/media', routes.media);

// ── Test Drive Management Module ────────────────────────────────────────────
// Public / Customer-facing
app.use('/api/v1/td/branches', routes.tdBranches);
app.use('/api/v1/td/customers', routes.tdCustomers);
app.use('/api/v1/td/vehicles/available', (req, res, next) => { req.url = '/available'; next(); }, routes.tdDemoVehicles);
app.use('/api/v1/td/slots', routes.tdSlots);
app.use('/api/v1/td/bookings', formLimiter, routes.tdBookings);
app.use('/api/v1/td/feedback', routes.tdFeedback);

// Customer portal (test drive bookings)
app.use('/api/v1/customer/auth', formLimiter, routes.customerAuth);
app.use('/api/v1/customer/bookings', formLimiter, routes.customerBookings);

// Admin / Protected
app.use('/api/v1/admin/td/branches', routes.tdBranches);
app.use('/api/v1/admin/td/vehicles', routes.tdDemoVehicles);
app.use('/api/v1/admin/td/bookings', routes.tdBookings);
app.use('/api/v1/admin/td/logs', routes.tdLogs);
app.use('/api/v1/admin/td/feedback', routes.tdFeedback);
app.use('/api/v1/admin/td/reports', routes.tdReports);
app.use('/api/v1/admin/td/leads', routes.tdLeadCrm);
app.use('/api/v1/admin/td/customers', routes.tdCustomers);
app.use('/api/v1/admin/td/slots', routes.tdSlots);
app.use('/api/v1/admin/td/users', routes.tdStaffUsers);
// ────────────────────────────────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

module.exports = app;
