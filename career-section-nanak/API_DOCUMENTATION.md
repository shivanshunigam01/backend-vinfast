# Patliputra VinFast — API Documentation

**Version:** 1.0.0  
**Date:** March 2026  
**Prepared for:** Backend Developer  
**Project:** Patliputra VinFast Dealer Website & Admin Panel  
**Stack:** Node.js · Express.js · MongoDB · Mongoose · JWT · Cloudinary

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Project File Structure](#3-project-file-structure)
4. [Environment Variables (.env)](#4-environment-variables-env)
5. [server.js & app.js](#5-serverjs--appjs)
6. [Database Connection](#6-database-connection)
7. [Middleware](#7-middleware)
8. [MongoDB Models / Schemas](#8-mongodb-models--schemas)
9. [API Endpoints — Public (User Panel)](#9-api-endpoints--public-user-panel)
10. [API Endpoints — Admin Panel](#10-api-endpoints--admin-panel)
11. [Dashboard Stats API](#11-dashboard-stats-api)
12. [Cloudinary Integration](#12-cloudinary-integration)
13. [Error Handling](#13-error-handling)
14. [Frontend Integration Map](#14-frontend-integration-map)
15. [HTTP Status Code Reference](#15-http-status-code-reference)

---

## 1. Project Overview

Patliputra VinFast is Bihar's first authorized VinFast dealer. This backend API serves:

- **Public Website** — Product pages, lead capture form, test drive booking, contact/enquiry form, hero slides, offers, FAQs, testimonials.
- **Admin Panel** — Full CRM including leads, test drives, enquiries, product management (with Cloudinary image upload), offers, homepage/content management, media library, and dealer settings.

---

## 2. Tech Stack & Dependencies

### Install all packages:

```bash
npm install express mongoose bcryptjs jsonwebtoken cors helmet
            express-rate-limit express-validator cloudinary dotenv multer
npm install --save-dev nodemon
```

### package.json scripts:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

---

## 3. Project File Structure

```
server/
├── server.js
├── app.js
├── .env
├── config/
│   └── db.js
├── middleware/
│   ├── auth.js
│   ├── errorHandler.js
│   └── validate.js
├── models/
│   ├── Admin.js
│   ├── Lead.js
│   ├── TestDrive.js
│   ├── Enquiry.js
│   ├── Product.js
│   ├── Offer.js
│   ├── HeroSlide.js
│   ├── Banner.js
│   ├── FAQ.js
│   ├── Testimonial.js
│   ├── MediaItem.js
│   └── SiteConfig.js
├── controllers/
│   ├── authController.js
│   ├── dashboardController.js
│   ├── leadController.js
│   ├── testDriveController.js
│   ├── enquiryController.js
│   ├── productController.js
│   ├── offerController.js
│   ├── homepageController.js
│   ├── contentController.js
│   └── mediaController.js
└── routes/
    ├── index.js
    ├── auth.js
    ├── public.js
    ├── leads.js
    ├── testDrives.js
    ├── enquiries.js
    ├── products.js
    ├── offers.js
    ├── homepage.js
    ├── content.js
    ├── media.js
    └── dashboard.js
```

---

## 4. Environment Variables (.env)

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/patliputra-vinfast

# JWT
JWT_SECRET=your_super_secret_key_minimum_32_characters
JWT_EXPIRES_IN=7d

# Client (CORS)
CLIENT_URL=https://patliputravinfast.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 5. server.js & app.js

### server.js

```js
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
```

### app.js

```js
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');
require('dotenv').config();

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Rate limiter for public form submissions
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: { success: false, message: 'Too many requests. Please try again later.' }
});

// ── Public routes (no auth required) ───────────────────────────
app.use('/api/v1/public',      require('./routes/public'));
app.use('/api/v1/leads',       formLimiter, require('./routes/leads'));
app.use('/api/v1/test-drives', formLimiter, require('./routes/testDrives'));
app.use('/api/v1/enquiries',   formLimiter, require('./routes/enquiries'));

// ── Admin routes (JWT protected) ───────────────────────────────
app.use('/api/v1/admin/auth',        require('./routes/auth'));
app.use('/api/v1/admin/dashboard',   require('./routes/dashboard'));
app.use('/api/v1/admin/leads',       require('./routes/leads'));
app.use('/api/v1/admin/test-drives', require('./routes/testDrives'));
app.use('/api/v1/admin/enquiries',   require('./routes/enquiries'));
app.use('/api/v1/admin/products',    require('./routes/products'));
app.use('/api/v1/admin/offers',      require('./routes/offers'));
app.use('/api/v1/admin/homepage',    require('./routes/homepage'));
app.use('/api/v1/admin/content',     require('./routes/content'));
app.use('/api/v1/admin/media',       require('./routes/media'));

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
```

---

## 6. Database Connection

### config/db.js

```js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
```

---

## 7. Middleware

### middleware/auth.js

```js
const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Protect route — verify JWT
exports.protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ success: false, message: 'Not authorized. No token.' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select('-password');
    if (!req.admin)
      return res.status(401).json({ success: false, message: 'Admin not found.' });
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
};

// Authorize specific roles
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.admin.role))
    return res.status(403).json({ success: false, message: 'Access denied. Insufficient role.' });
  next();
};
```

### middleware/errorHandler.js

```js
module.exports = (err, req, res, next) => {
  console.error(err.stack);

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ success: false, message: `${field} already exists.` });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
```

---

## 8. MongoDB Models / Schemas

### models/Admin.js

```js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  name:     { type: String, required: [true, 'Name is required'], trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false, minlength: 8 },
  role:     { type: String, enum: ['superadmin', 'manager', 'executive'], default: 'executive' },
  active:   { type: Boolean, default: true },
}, { timestamps: true });

// Hash password before save
AdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare password
AdminSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('Admin', AdminSchema);
```

---

### models/Lead.js

```js
const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  mobile:         { type: String, required: true },
  email:          { type: String, lowercase: true, trim: true },
  city:           { type: String },
  otherCity:      { type: String },
  model:          { type: String, enum: ['VF 6', 'VF 7', 'Both'], required: true },
  interest:       { type: String, enum: ['Test Drive', 'Price Enquiry', 'Finance', 'General'], default: 'Test Drive' },
  source:         { type: String, enum: ['Website', 'Google Ads', 'Meta Ads', 'WhatsApp', 'Walk-in', 'Referral'], default: 'Website' },
  status:         {
    type: String,
    enum: ['New Lead', 'Contact Attempted', 'Interested', 'Negotiation', 'Booked', 'Delivered', 'Lost', 'Not Interested'],
    default: 'New Lead'
  },
  assignedTo:     { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  nextFollowUp:   { type: Date },
  remarks:        { type: String },
  financeNeeded:  { type: Boolean, default: false },
  exchangeNeeded: { type: Boolean, default: false },
  utmSource:      { type: String },
  utmMedium:      { type: String },
  utmCampaign:    { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Lead', LeadSchema);
```

---

### models/TestDrive.js

```js
const mongoose = require('mongoose');

const TestDriveSchema = new mongoose.Schema({
  leadId:            { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  customerName:      { type: String, required: true },
  mobile:            { type: String, required: true },
  email:             { type: String },
  model:             { type: String, enum: ['VF 6', 'VF 7'], required: true },
  preferredDate:     { type: Date, required: true },
  preferredTime:     { type: String, required: true },
  branch:            { type: String, default: 'Patna Showroom' },
  status:            { type: String, enum: ['Pending', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled'], default: 'Pending' },
  assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  feedback:          { type: String },
  feedbackRating:    { type: Number, min: 1, max: 5 },
}, { timestamps: true });

module.exports = mongoose.model('TestDrive', TestDriveSchema);
```

---

### models/Enquiry.js

```js
const mongoose = require('mongoose');

const EnquirySchema = new mongoose.Schema({
  name:    { type: String, required: true },
  mobile:  { type: String, required: true },
  email:   { type: String },
  city:    { type: String },
  model:   { type: String },
  message: { type: String },
  type:    { type: String, enum: ['General', 'Price', 'Finance', 'Service', 'Complaint', 'Other'], default: 'General' },
  status:  { type: String, enum: ['Open', 'Responded', 'Closed'], default: 'Open' },
  source:  { type: String, default: 'Contact Form' },
}, { timestamps: true });

module.exports = mongoose.model('Enquiry', EnquirySchema);
```

---

### models/Product.js

```js
const mongoose = require('mongoose');

const ColorVariantSchema = new mongoose.Schema({
  name:  { type: String },
  hex:   { type: String },
  image: { type: String }, // Cloudinary URL
}, { _id: false });

const ProductSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  slug:     { type: String, required: true, unique: true, lowercase: true }, // 'vf7' or 'vf6'
  tagline:  { type: String },
  priceFrom: { type: String },
  active:   { type: Boolean, default: true },
  order:    { type: Number, default: 0 },

  specs: {
    range:       String,
    battery:     String,
    power:       String,
    torque:      String,
    topSpeed:    String,
    driveType:   String,
    fastCharge:  String,
    homeCharge:  String,
    safety:      String,
    airbags:     String,
    adas:        String,
    touchscreen: String,
    bootSpace:   String,
    variants:    String,
  },

  heroImage:     { type: String },        // Cloudinary URL
  galleryImages: [{ type: String }],      // Array of Cloudinary URLs
  colorVariants: [ColorVariantSchema],
  brochureUrl:   { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
```

---

### models/Offer.js

```js
const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  model:       { type: String, default: 'All Models' },
  type:        { type: String, enum: ['Launch', 'Exchange', 'Finance', 'Accessory', 'Seasonal', 'Other'], default: 'Launch' },
  validTill:   { type: Date },
  active:      { type: Boolean, default: true },
  imageUrl:    { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Offer', OfferSchema);
```

---

### models/HeroSlide.js

```js
const mongoose = require('mongoose');

const HeroSlideSchema = new mongoose.Schema({
  title:            { type: String },
  subtitle:         { type: String },
  badge:            { type: String },
  ctaPrimary:       { type: String },
  ctaPrimaryLink:   { type: String },
  ctaSecondary:     { type: String },
  ctaSecondaryLink: { type: String },
  bgImage:          { type: String }, // Cloudinary URL
  active:           { type: Boolean, default: true },
  order:            { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('HeroSlide', HeroSlideSchema);
```

---

### models/Banner.js

```js
const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema({
  title:    { type: String },
  subtitle: { type: String },
  imageUrl: { type: String }, // Cloudinary URL
  link:     { type: String },
  active:   { type: Boolean, default: true },
  order:    { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Banner', BannerSchema);
```

---

### models/FAQ.js

```js
const mongoose = require('mongoose');

const FAQSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answer:   { type: String, required: true },
  category: { type: String, default: 'General' },
  order:    { type: Number, default: 0 },
  active:   { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('FAQ', FAQSchema);
```

---

### models/Testimonial.js

```js
const mongoose = require('mongoose');

const TestimonialSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  city:   { type: String },
  model:  { type: String },
  rating: { type: Number, min: 1, max: 5 },
  text:   { type: String },
  photo:  { type: String }, // Cloudinary URL
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Testimonial', TestimonialSchema);
```

---

### models/MediaItem.js

```js
const mongoose = require('mongoose');

const MediaSchema = new mongoose.Schema({
  name:       { type: String },
  url:        { type: String, required: true }, // Cloudinary secure_url
  publicId:   { type: String },                  // Cloudinary public_id (for deletion)
  tag:        { type: String, default: 'Other' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

module.exports = mongoose.model('MediaItem', MediaSchema);
```

---

### models/SiteConfig.js

```js
const mongoose = require('mongoose');

// Key-value store for site-wide settings
const SiteConfigSchema = new mongoose.Schema({
  key:   { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('SiteConfig', SiteConfigSchema);

/*
  Keys used by the frontend:
  ─────────────────────────────────────
  whatsappNumber     → "919231445060"
  phoneNumber        → "+91 9231445060"
  vf7Price           → "₹21.89L*"
  vf6Price           → "₹17.29L*"
  vf7Range           → "431 km"
  vf6Range           → "381 km"
  leadStripTitle     → "Ready to Go Electric?"
  leadStripSubtitle  → "Our EV advisor will reach out in 10 minutes."
  ─────────────────────────────────────
*/
```

---

## 9. API Endpoints — Public (User Panel)

> **Base:** `https://apivnfast.patliputragroup.com/api/v1` (or your deployed API URL)
> No authentication required for public endpoints.

---

### 9.1 GET `/public/config`

Returns site-wide configuration (prices, phone, WhatsApp number, etc.)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "whatsappNumber": "919231445060",
    "phoneNumber": "+91 9231445060",
    "vf7Price": "₹21.89L*",
    "vf6Price": "₹17.29L*",
    "vf7Range": "431 km",
    "vf6Range": "381 km",
    "leadStripTitle": "Ready to Go Electric?",
    "leadStripSubtitle": "Our EV advisor will reach out in 10 minutes."
  }
}
```

---

### 9.2 GET `/public/products`

Returns all active products with full specs and color variants.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64abc...",
      "name": "VinFast VF 7",
      "slug": "vf7",
      "tagline": "Bold. Intelligent. Unstoppable.",
      "priceFrom": "₹21.89 Lakh*",
      "specs": {
        "range": "431 km",
        "battery": "75.3 kWh",
        "power": "349 HP",
        "torque": "500 Nm",
        "topSpeed": "200 km/h",
        "driveType": "AWD",
        "fastCharge": "10-70% in 24 min",
        "homeCharge": "0-100% in 11 hrs",
        "safety": "5-Star NCAP",
        "airbags": "6 Airbags",
        "adas": "Level 2+",
        "touchscreen": "15.6\"",
        "bootSpace": "655 L",
        "variants": "Plus, Max"
      },
      "heroImage": "https://res.cloudinary.com/...",
      "galleryImages": ["https://res.cloudinary.com/..."],
      "colorVariants": [
        { "name": "Crimson Red", "hex": "#C80F1E", "image": "https://res.cloudinary.com/..." },
        { "name": "Jet Black",   "hex": "#18191D", "image": "https://res.cloudinary.com/..." }
      ],
      "brochureUrl": "/brochures/VF7-Brochure.pdf"
    }
  ]
}
```

---

### 9.3 GET `/public/products/:slug`

Returns a single product by slug (`vf7` or `vf6`).

**Response `200`:** Same structure as single item above.  
**Response `404`:**
```json
{ "success": false, "message": "Product not found" }
```

---

### 9.4 GET `/public/hero-slides`

Returns active hero slides sorted by `order`.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "VinFast VF 7",
      "subtitle": "Bold. Intelligent. Unstoppable.",
      "badge": "Now Available in Bihar",
      "ctaPrimary": "Book Test Drive",
      "ctaPrimaryLink": "/test-drive",
      "ctaSecondary": "Explore VF 7",
      "ctaSecondaryLink": "/models/vf7",
      "bgImage": "https://res.cloudinary.com/...",
      "order": 1
    }
  ]
}
```

---

### 9.5 GET `/public/offers`

Returns all active offers.

**Query params:** `?model=VF+7`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Launch Bonus — ₹2 Lakh Off",
      "description": "Exclusive discount for first 50 customers",
      "model": "VF 7",
      "type": "Launch",
      "validTill": "2026-04-30T00:00:00.000Z",
      "imageUrl": "https://res.cloudinary.com/..."
    }
  ]
}
```

---

### 9.6 GET `/public/banners`

Returns active banners sorted by `order`.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "_id": "...", "title": "VinFast Bihar Launch", "imageUrl": "https://res.cloudinary.com/...", "link": "/test-drive" }
  ]
}
```

---

### 9.7 GET `/public/faqs`

Returns active FAQs.

**Query params:** `?category=VF+7`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "_id": "...", "question": "What is the range of VF 7?", "answer": "431 km on a single charge.", "category": "VF 7" }
  ]
}
```

---

### 9.8 GET `/public/testimonials`

Returns active testimonials.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    { "_id": "...", "name": "Rahul Kumar", "city": "Patna", "model": "VF 7", "rating": 5, "text": "Amazing car!", "photo": "https://res.cloudinary.com/..." }
  ]
}
```

---

### 9.9 POST `/leads` — Lead Capture Form

Submitted from the "Ready to Go Electric?" strip on the website.

**Request Body:**
```json
{
  "name": "Rahul Kumar",
  "mobile": "9876543210",
  "city": "Patna",
  "otherCity": "",
  "model": "VF 7",
  "interest": "Test Drive",
  "source": "Website",
  "utmSource": "google",
  "utmMedium": "cpc",
  "utmCampaign": "vf7-launch-2026"
}
```

**Validation Rules:**
- `name` — required, min 2 chars
- `mobile` — required, 10 digits, starts with 6–9
- `model` — required, must be `VF 6` or `VF 7`

**Response `201`:**
```json
{
  "success": true,
  "message": "Thank you! Our EV advisor will contact you within 10 minutes.",
  "leadId": "64abc123..."
}
```

**Response `400` (validation fail):**
```json
{ "success": false, "message": "Mobile number must be 10 digits starting with 6–9" }
```

---

### 9.10 POST `/test-drives` — Test Drive Booking

Submitted from `/test-drive` page.

**Request Body:**
```json
{
  "customerName": "Priya Singh",
  "mobile": "9876543211",
  "email": "priya@example.com",
  "model": "VF 6",
  "preferredDate": "2026-04-10",
  "preferredTime": "11:00 AM",
  "branch": "Patna Showroom"
}
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Test drive booked! We'll confirm your slot within 2 hours.",
  "bookingId": "64td001..."
}
```

---

### 9.11 POST `/enquiries` — Contact Form

Submitted from `/contact` page.

**Request Body:**
```json
{
  "name": "Amit Sharma",
  "mobile": "9123456789",
  "email": "amit@email.com",
  "city": "Gaya",
  "model": "VF 7",
  "message": "I want to know about finance options.",
  "type": "Finance"
}
```

**Response `201`:**
```json
{ "success": true, "message": "We've received your enquiry and will respond within 24 hours." }
```

---

## 10. API Endpoints — Admin Panel

> **Base:** `https://apivnfast.patliputragroup.com/api/v1/admin` (or your deployed API URL)
> 🔒 All routes require: `Authorization: Bearer <jwt_token>`

---

### 10.1 AUTH — `/admin/auth`

#### POST `/admin/auth/login`

**Request Body:**
```json
{ "email": "admin@patliputravinfast.com", "password": "yourpassword" }
```

**Response `200`:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "admin": {
    "_id": "64admin001",
    "name": "Admin",
    "email": "admin@patliputravinfast.com",
    "role": "superadmin"
  }
}
```

**Response `401`:**
```json
{ "success": false, "message": "Invalid credentials" }
```

**Controller (authController.js):**
```js
const jwt   = require('jsonwebtoken');
const Admin = require('../models/Admin');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin || !(await admin.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    res.json({
      success: true,
      token,
      admin: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (err) { next(err); }
};
```

#### GET `/admin/auth/me` 🔒

Returns current logged-in admin.

**Response `200`:**
```json
{ "success": true, "admin": { "_id": "...", "name": "Admin", "role": "superadmin" } }
```

---

### 10.2 LEADS — `/admin/leads`

#### GET `/admin/leads` 🔒

**Query Parameters:**

| Param | Type | Example |
|---|---|---|
| `status` | string | `New Lead` |
| `model` | string | `VF 7` |
| `source` | string | `Google Ads` |
| `assignedTo` | ObjectId | `64admin001` |
| `search` | string | `rahul` |
| `from` | date | `2026-01-01` |
| `to` | date | `2026-03-31` |
| `page` | number | `1` |
| `limit` | number | `20` |

**Response `200`:**
```json
{
  "success": true,
  "count": 20,
  "total": 300,
  "pages": 15,
  "currentPage": 1,
  "data": [
    {
      "_id": "64lead001",
      "name": "Rahul Kumar",
      "mobile": "9876543210",
      "email": "rahul@email.com",
      "city": "Patna",
      "model": "VF 7",
      "source": "Google Ads",
      "status": "Interested",
      "assignedTo": { "_id": "...", "name": "Sales Executive" },
      "nextFollowUp": "2026-04-05T00:00:00.000Z",
      "remarks": "Very interested in VF 7 Max variant",
      "financeNeeded": true,
      "exchangeNeeded": false,
      "createdAt": "2026-03-28T10:30:00.000Z"
    }
  ]
}
```

#### GET `/admin/leads/:id` 🔒

Single lead detail.

#### PUT `/admin/leads/:id` 🔒

Update lead status, remarks, assignedTo, nextFollowUp.

**Request Body:**
```json
{
  "status": "Interested",
  "assignedTo": "64admin002",
  "nextFollowUp": "2026-04-05",
  "remarks": "Very interested in VF 7 Max. Needs finance.",
  "financeNeeded": true
}
```

**Response `200`:**
```json
{ "success": true, "data": { "...updated lead..." } }
```

#### DELETE `/admin/leads/:id` 🔒 *(superadmin only)*

**Response `200`:**
```json
{ "success": true, "message": "Lead deleted successfully" }
```

---

### 10.3 TEST DRIVES — `/admin/test-drives`

#### GET `/admin/test-drives` 🔒

**Query params:** `?status=Pending`, `?model=VF 7`, `?date=2026-04-10`, `?page=1&limit=20`

**Response `200`:**
```json
{
  "success": true,
  "count": 10,
  "total": 80,
  "data": [
    {
      "_id": "64td001",
      "customerName": "Priya Singh",
      "mobile": "9876543211",
      "model": "VF 6",
      "preferredDate": "2026-04-10T00:00:00.000Z",
      "preferredTime": "11:00 AM",
      "branch": "Patna Showroom",
      "status": "Pending",
      "assignedExecutive": { "_id": "...", "name": "Sales Executive" },
      "createdAt": "2026-03-30T08:00:00.000Z"
    }
  ]
}
```

#### GET `/admin/test-drives/:id` 🔒

#### PUT `/admin/test-drives/:id` 🔒

**Request Body:**
```json
{
  "status": "Confirmed",
  "assignedExecutive": "64admin002",
  "feedback": "Customer loved the VF 6. Likely to book.",
  "feedbackRating": 5
}
```

#### DELETE `/admin/test-drives/:id` 🔒

---

### 10.4 ENQUIRIES — `/admin/enquiries`

#### GET `/admin/enquiries` 🔒

**Query params:** `?status=Open`, `?type=Finance`, `?search=amit`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64enq001",
      "name": "Amit Sharma",
      "mobile": "9123456789",
      "email": "amit@email.com",
      "city": "Gaya",
      "model": "VF 7",
      "message": "I want to know about finance options.",
      "type": "Finance",
      "status": "Open",
      "createdAt": "2026-03-30T09:00:00.000Z"
    }
  ]
}
```

#### PUT `/admin/enquiries/:id` 🔒

```json
{ "status": "Responded" }
```

#### DELETE `/admin/enquiries/:id` 🔒

---

### 10.5 PRODUCTS — `/admin/products`

#### GET `/admin/products` 🔒

Returns all products including inactive.

#### POST `/admin/products` 🔒

**Request Body:**
```json
{
  "name": "VinFast VF 7",
  "slug": "vf7",
  "tagline": "Bold. Intelligent. Unstoppable.",
  "priceFrom": "₹21.89 Lakh*",
  "active": true,
  "order": 1,
  "specs": {
    "range": "431 km",
    "battery": "75.3 kWh",
    "power": "349 HP",
    "torque": "500 Nm",
    "topSpeed": "200 km/h",
    "driveType": "AWD",
    "fastCharge": "10-70% in 24 min",
    "homeCharge": "0-100% in 11 hrs",
    "safety": "5-Star NCAP",
    "airbags": "6 Airbags",
    "adas": "Level 2+",
    "touchscreen": "15.6\"",
    "bootSpace": "655 L",
    "variants": "Plus, Max"
  },
  "heroImage": "https://res.cloudinary.com/patliputra/image/upload/vf7_hero.jpg",
  "galleryImages": [
    "https://res.cloudinary.com/patliputra/image/upload/vf7_gallery_1.jpg",
    "https://res.cloudinary.com/patliputra/image/upload/vf7_gallery_2.jpg"
  ],
  "colorVariants": [
    { "name": "Crimson Red",   "hex": "#C80F1E", "image": "https://res.cloudinary.com/.../vf7_crimson.png" },
    { "name": "Infinity Blanc","hex": "#E6E6E2", "image": "https://res.cloudinary.com/.../vf7_blanc.png" },
    { "name": "Jet Black",     "hex": "#18191D", "image": "https://res.cloudinary.com/.../vf7_black.png" },
    { "name": "Desat Silver",  "hex": "#D8D9D4", "image": "https://res.cloudinary.com/.../vf7_silver.png" },
    { "name": "Zenith Grey",   "hex": "#61656B", "image": "https://res.cloudinary.com/.../vf7_grey.png" },
    { "name": "Urban Mint",    "hex": "#727A67", "image": "https://res.cloudinary.com/.../vf7_mint.png" }
  ],
  "brochureUrl": "/brochures/VF7-Brochure.pdf"
}
```

**Response `201`:**
```json
{ "success": true, "data": { "...created product..." } }
```

#### PUT `/admin/products/:id` 🔒

Partial or full update — same fields as POST body.

**Response `200`:**
```json
{ "success": true, "data": { "...updated product..." } }
```

#### DELETE `/admin/products/:id` 🔒

```json
{ "success": true, "message": "Product deleted" }
```

---

### 10.6 OFFERS — `/admin/offers`

#### GET `/admin/offers` 🔒

All offers including inactive.

#### POST `/admin/offers` 🔒

**Request Body:**
```json
{
  "title": "Launch Bonus — ₹2 Lakh Off",
  "description": "Exclusive launch discount on VF 7 Plus variant for first 50 customers",
  "model": "VF 7",
  "type": "Launch",
  "validTill": "2026-04-30",
  "active": true,
  "imageUrl": "https://res.cloudinary.com/..."
}
```

#### PUT `/admin/offers/:id` 🔒

```json
{ "active": false }
```

#### DELETE `/admin/offers/:id` 🔒

---

### 10.7 HOMEPAGE — `/admin/homepage`

#### GET `/admin/homepage/slides` 🔒

All hero slides.

#### POST `/admin/homepage/slides` 🔒

**Request Body:**
```json
{
  "title": "VinFast VF 7",
  "subtitle": "Bold. Intelligent. Unstoppable. Bihar's favourite EV.",
  "badge": "Now Available in Bihar",
  "ctaPrimary": "Book Test Drive",
  "ctaPrimaryLink": "/test-drive",
  "ctaSecondary": "Explore VF 7",
  "ctaSecondaryLink": "/models/vf7",
  "bgImage": "https://res.cloudinary.com/...",
  "active": true,
  "order": 1
}
```

#### PUT `/admin/homepage/slides/:id` 🔒

#### DELETE `/admin/homepage/slides/:id` 🔒

#### GET `/admin/homepage/config` 🔒

#### PUT `/admin/homepage/config` 🔒

**Request Body:**
```json
{
  "whatsappNumber": "919231445060",
  "phoneNumber": "+91 9231445060",
  "vf7Price": "₹21.89L*",
  "vf6Price": "₹17.29L*",
  "vf7Range": "431 km",
  "vf6Range": "381 km",
  "leadStripTitle": "Ready to Go Electric?",
  "leadStripSubtitle": "Our EV advisor will reach out in 10 minutes."
}
```

**Response `200`:**
```json
{ "success": true, "message": "Configuration updated successfully" }
```

---

### 10.8 CONTENT — `/admin/content`

#### Banners

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/content/banners` | Get all banners |
| POST | `/admin/content/banners` | Create banner |
| PUT | `/admin/content/banners/:id` | Update banner |
| DELETE | `/admin/content/banners/:id` | Delete banner |

**POST Body:**
```json
{
  "title": "VF Series Launch",
  "subtitle": "Explore the VF 6 & VF 7 lineup",
  "imageUrl": "https://res.cloudinary.com/...",
  "link": "/models/vf7",
  "active": true,
  "order": 1
}
```

#### FAQs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/content/faqs` | Get all FAQs |
| POST | `/admin/content/faqs` | Create FAQ |
| PUT | `/admin/content/faqs/:id` | Update FAQ |
| DELETE | `/admin/content/faqs/:id` | Delete FAQ |

**POST Body:**
```json
{
  "question": "What is the range of VF 7?",
  "answer": "The VF 7 offers up to 431 km on a single charge (WLTP).",
  "category": "VF 7",
  "order": 1,
  "active": true
}
```

#### Testimonials

| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/content/testimonials` | Get all testimonials |
| POST | `/admin/content/testimonials` | Create testimonial |
| PUT | `/admin/content/testimonials/:id` | Update testimonial |
| DELETE | `/admin/content/testimonials/:id` | Delete testimonial |

**POST Body:**
```json
{
  "name": "Rahul Kumar",
  "city": "Patna",
  "model": "VF 7",
  "rating": 5,
  "text": "Amazing car! The performance and tech features are unmatched.",
  "photo": "https://res.cloudinary.com/...",
  "active": true
}
```

---

### 10.9 MEDIA — `/admin/media`

#### GET `/admin/media` 🔒

**Query params:** `?tag=VF+7`

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64media001",
      "name": "VF7 Crimson Red",
      "url": "https://res.cloudinary.com/patliputra/image/upload/v1/.../vf7_crimson.png",
      "publicId": "patliputra-vinfast/vf7_crimson",
      "tag": "VF 7",
      "uploadedBy": { "_id": "...", "name": "Admin" },
      "createdAt": "2026-03-31T10:00:00.000Z"
    }
  ]
}
```

#### POST `/admin/media` 🔒

Saves a Cloudinary URL reference to the DB **after** the frontend uploads to Cloudinary directly using the upload widget.

**Request Body:**
```json
{
  "name": "VF7 Crimson Red",
  "url": "https://res.cloudinary.com/patliputra/image/upload/v1/vf7_crimson.png",
  "publicId": "patliputra-vinfast/vf7_crimson",
  "tag": "VF 7"
}
```

**Response `201`:**
```json
{ "success": true, "data": { "...created media item..." } }
```

#### DELETE `/admin/media/:id` 🔒

Deletes the DB record AND the image from Cloudinary.

**Controller snippet:**
```js
const cloudinary = require('cloudinary').v2;

exports.deleteMedia = async (req, res, next) => {
  try {
    const item = await MediaItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Media not found' });

    // Delete from Cloudinary
    if (item.publicId) {
      await cloudinary.uploader.destroy(item.publicId);
    }

    await item.deleteOne();
    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (err) { next(err); }
};
```

---

## 11. Dashboard Stats API

### GET `/admin/dashboard/stats` 🔒

Returns all metrics for the admin dashboard.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "totalLeads": 300,
    "newLeadsToday": 12,
    "hotLeads": 45,
    "bookings": 18,
    "pendingFollowUps": 23,
    "totalTestDrives": 80,
    "testDrivesThisWeek": 8,
    "totalEnquiries": 150,
    "openEnquiries": 30,
    "leadsBySource": {
      "Google Ads": 90,
      "Website": 70,
      "WhatsApp": 60,
      "Meta Ads": 45,
      "Walk-in": 20,
      "Referral": 15
    },
    "leadsByModel": {
      "VF 7": 190,
      "VF 6": 110
    },
    "leadsByStatus": {
      "New Lead": 80,
      "Contact Attempted": 40,
      "Interested": 60,
      "Negotiation": 40,
      "Booked": 18,
      "Lost": 30,
      "Not Interested": 32
    },
    "testDrivesByStatus": {
      "Pending": 15,
      "Confirmed": 25,
      "Completed": 35,
      "Cancelled": 5
    }
  }
}
```

**Controller snippet:**
```js
exports.getStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLeads, newLeadsToday, hotLeads, bookings,
           pendingFollowUps, totalTestDrives, totalEnquiries, openEnquiries]
      = await Promise.all([
        Lead.countDocuments(),
        Lead.countDocuments({ createdAt: { $gte: today } }),
        Lead.countDocuments({ status: { $in: ['Interested', 'Negotiation'] } }),
        Lead.countDocuments({ status: 'Booked' }),
        Lead.countDocuments({ nextFollowUp: { $lte: new Date() } }),
        TestDrive.countDocuments(),
        Enquiry.countDocuments(),
        Enquiry.countDocuments({ status: 'Open' }),
      ]);

    const sourceAgg = await Lead.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    const modelAgg = await Lead.aggregate([
      { $group: { _id: '$model', count: { $sum: 1 } } }
    ]);

    const leadsBySource = Object.fromEntries(sourceAgg.map(s => [s._id, s.count]));
    const leadsByModel  = Object.fromEntries(modelAgg.map(m => [m._id, m.count]));

    res.json({
      success: true,
      data: {
        totalLeads, newLeadsToday, hotLeads, bookings,
        pendingFollowUps, totalTestDrives, totalEnquiries, openEnquiries,
        leadsBySource, leadsByModel,
      }
    });
  } catch (err) { next(err); }
};
```

---

## 12. Cloudinary Integration

### config/cloudinary.js

```js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
```

### How Image Upload Works

```
Frontend (React)               Cloudinary                Backend (Node.js)
─────────────────────────────────────────────────────────────────────────
1. User clicks "Upload"
2. Cloudinary Widget opens  →  Image uploaded directly
3. Widget returns secure_url ←  Upload complete
4. Frontend sends url + publicId  ──────────────────────→  POST /admin/media
5. Backend saves URL to DB                                  DB record created
```

> The frontend uses **unsigned upload presets** so images go directly to Cloudinary without passing through your Node.js server. Your server only stores the returned URL.

### Frontend .env

```env
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

### Cloudinary Setup Steps

1. Sign up at [cloudinary.com](https://cloudinary.com) (free tier works)
2. Dashboard → **Settings → Upload → Add upload preset**
3. Set signing mode to **Unsigned**
4. Set folder to `patliputra-vinfast`
5. Copy **Cloud Name** and **Upload Preset** to both `.env` files

---

## 13. Error Handling

All API errors follow this consistent format:

```json
{
  "success": false,
  "message": "Human-readable error message"
}
```

### Standard HTTP Status Codes Used

| Code | Meaning | When used |
|---|---|---|
| `200` | OK | Successful GET, PUT |
| `201` | Created | Successful POST |
| `400` | Bad Request | Validation errors, bad input |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Valid token but insufficient role |
| `404` | Not Found | Resource not found |
| `409` | Conflict | Duplicate entry (email, slug) |
| `429` | Too Many Requests | Rate limit exceeded on forms |
| `500` | Internal Server Error | Unexpected server error |

---

## 14. Frontend Integration Map

Replace these hardcoded values in the React frontend with API calls once the backend is ready:

| Frontend File | Currently Hardcoded | API to Call |
|---|---|---|
| `LeadCaptureStrip.tsx` | `toast.success()` only | `POST /api/v1/leads` |
| `TestDrive.tsx` | `toast.success()` only | `POST /api/v1/test-drives` |
| `Contact.tsx` | `toast.success()` only | `POST /api/v1/enquiries` |
| `HeroSection.tsx` | Static slides array | `GET /api/v1/public/hero-slides` |
| `ModelVF7.tsx` | Hardcoded specs + colors | `GET /api/v1/public/products/vf7` |
| `ModelVF6.tsx` | Hardcoded specs + colors | `GET /api/v1/public/products/vf6` |
| `ModelDiscovery.tsx` | Hardcoded product cards | `GET /api/v1/public/products` |
| `Compare.tsx` | Hardcoded compare table | `GET /api/v1/public/products` |
| `Navbar.tsx` | Hardcoded WhatsApp number | `GET /api/v1/public/config` |
| `Footer.tsx` | Hardcoded contact info | `GET /api/v1/public/config` |
| `LeadCaptureStrip.tsx` | Hardcoded strip text | `GET /api/v1/public/config` |
| Offers section | Hardcoded offers | `GET /api/v1/public/offers` |
| FAQ section | Hardcoded FAQs | `GET /api/v1/public/faqs` |
| Testimonials section | Hardcoded reviews | `GET /api/v1/public/testimonials` |
| Admin Dashboard | `mockData.ts` | `GET /api/v1/admin/dashboard/stats` |
| Admin Leads | `mockData.ts` | `GET/POST/PUT/DELETE /admin/leads` |
| Admin Test Drives | `mockData.ts` | `GET/POST/PUT/DELETE /admin/test-drives` |
| Admin Enquiries | `mockData.ts` | `GET/PUT/DELETE /admin/enquiries` |
| Admin Products | Local state | `GET/POST/PUT/DELETE /admin/products` |
| Admin Offers | Local state | `GET/POST/PUT/DELETE /admin/offers` |
| Admin Content | Local state | `GET/POST/PUT/DELETE /admin/content/*` |
| Admin Homepage | Local state | `GET/PUT /admin/homepage/*` |
| Admin Media | Local state | `GET/POST/DELETE /admin/media` |

---

## 15. HTTP Status Code Reference

```
200 OK              → Request successful, data returned
201 Created         → New resource created successfully
400 Bad Request     → Validation failed or bad input
401 Unauthorized    → JWT token missing, invalid, or expired
403 Forbidden       → Token valid but role not permitted
404 Not Found       → Resource with that ID does not exist
409 Conflict        → Duplicate key (email, slug, etc.)
429 Too Many Req.   → Rate limit hit on public form endpoints
500 Server Error    → Unhandled exception on the server
```

---

*End of API Documentation — Patliputra VinFast v1.0*  
*For backend queries contact the frontend team for schema clarifications.*
