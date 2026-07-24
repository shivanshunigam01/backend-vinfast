# Patliputra VinFast — MoM Implementation Documentation

**Project:** Patliputra VinFast – Test Drive Module & CRM Module  
**Source MoM date:** 21 July 2026  
**Documentation date:** 24 July 2026  
**Prepared for:** Patliputra VinFast × Zentroverse Global Pvt. Ltd.

---

## 1. Purpose of this document

This document records:

1. Which MoM action items have been implemented in the codebase  
2. End-to-end **flows** for each completed feature  
3. **Mandatory SMTP / email configuration** required before production email delivery works  
4. Related scripts, admin screens, and API endpoints  

**Primary codebase**

| Layer | Location |
|--------|----------|
| Backend API | Root `src/` + `server.js` |
| Frontend SPA (Public + Admin + Staff + CRM + Customer) | `career-section-nanak/` |

---

## 2. Completion status (MoM items 1–17)

| # | MoM item | Status | Summary |
|---|----------|--------|---------|
| 1 | Automated customer communication | **Done (engine ready)** | Notification engine for WhatsApp + Email with audit log. Emails need SMTP in `.env`. Journey WhatsApp needs campaign flag when templates are ready. |
| 2 | Login architecture (secure multi-step) | **Done** | Staff login: Step 1 email → Step 2 password. Customer login remains WhatsApp OTP. |
| 3 | OTP security improvement | **Done** | Wrong OTP never auto-generates a new code. Retry limit + lock. New OTP only on explicit Resend/Send. |
| 4 | Customer reschedule = 3 preferred slots | **Done** | Customer submits 3 options; dealership assigns one. |
| 5 | Reschedule history report | **Done** | Full audit: original / preferred / approved / requester / approver / reason. |
| 6 | Granular module access | **Done** | Module ACL + optional `allowedActions`; new modules for Calendar, Reschedule History, Fleet Health. |
| 7 | Assignment accept / reject | **Done** | Assigned executive must Accept or Reject; reject returns booking for reassignment. |
| 8 | Official VinFast email integration | **Done (config required)** | Nodemailer wired. **SMTP credentials must be placed in `.env`** (see Section 3). |
| 9 | Mandatory driving licence | **Done** | DL must be uploaded & verified before starting a test drive (API + UI). |
| 10 | Legacy data migration | **Done (scaffold)** | `npm run import:legacy-crm` — drop JSON under `src/data/legacy/`. |
| 11 | Dashboard calendar module | **Done** | `/admin/calendar` — test drives, follow-ups, approvals, reschedule requests with deep links. |
| 12 | Organization hierarchy | **Done** | MD → CEO → GM → SH → SM → SE seeded from org chart; `reportsTo` drives team visibility. |
| 13 | Vehicle charging & maintenance | **Done** | `/admin/td/fleet-health` + charging/maintenance APIs. |
| 14 | Reverse geocoding | **Done** | `GET/POST /api/v1/admin/geocode/reverse` (Nominatim default; Google optional). |
| 15 | Duplicate lead elimination | **Done** | Intake dedupes open leads by mobile; `npm run dedupe:leads` for historical merge. |
| 16 | Lead ID & Opportunity ID | **Already present / confirmed** | `PVLEAD*` / `PVOPP*` via `pvIdGenerator`. |
| 17 | Remove duplicate Pre-Booking entry points | **Done** | Pre-Booking retained on Navbar / Footer (`/book-now`); removed from Test Drive page & Quick Action Bar. |

---

## 3. SMTP / Email configuration (REQUIRED for mail delivery)

Email notifications **will not send** until SMTP is configured on the server `.env` file.

### 3.1 Variables to set

Copy from `.env.example` into the live `.env` (root backend):

```env
# --- Official email notifications (VinFast / dealership SMTP) ---
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-official-mailbox@domain.com
SMTP_PASS=your-smtp-password-or-app-password
SMTP_FROM="Patliputra VinFast <noreply@patliputravinfast.com>"
VINFAST_EMAIL_FROM=noreply@patliputravinfast.com
OPS_ESCALATION_EMAIL=ops@patliputravinfast.com
```

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST` | SMTP server hostname (e.g. Google Workspace, Microsoft 365, Zoho, custom) |
| `SMTP_PORT` | Usually `587` (STARTTLS) or `465` (SSL) |
| `SMTP_SECURE` | `true` only for port 465 |
| `SMTP_USER` | Mailbox username / full email ID |
| `SMTP_PASS` | Password or **app-specific password** |
| `SMTP_FROM` / `VINFAST_EMAIL_FROM` | From address shown to customers/staff |
| `OPS_ESCALATION_EMAIL` | Receives assignment-reject / escalation alerts |

### 3.2 After updating `.env`

1. Restart the Node API (`npm run start` / process manager).  
2. Trigger a workflow that sends email (e.g. assign executive → Accept path, or approve reschedule).  
3. Confirm delivery in the mailbox and check `TDNotification` collection for `status: SENT` (or `FAILED` with error text).

### 3.3 Related WhatsApp journey flags

```env
WHATSAPP_JOURNEY_ENABLED=false
WHATSAPP_JOURNEY_USE_OTP_CAMPAIGN=false
```

Keep journey WhatsApp **false** until approved BSP/AiSensy **journey templates** (not OTP templates) are live. OTP WhatsApp continues to work via existing AiSensy OTP campaign settings.

---

## 4. Organization hierarchy (seeded)

**Script:** `npm run seed:td-team`  
**Default password (new users only):** `Patliputra@123` (or `SEED_TD_TEAM_PASSWORD`)

```
Managing Director (MD)
  └── CEO
        └── General Manager (GM)
              └── Sales Head — Pranay Ranjan
                    ├── SM Rajan Singh → SE Pranay Singh
                    ├── SM Rahul Singh → SE Jaya
                    ├── SM Dilip Choudhary → SE Sonu
                    ├── SM Rahul Kumar → SE Mayank
                    └── SM Saurav → SE Prashant
```

### Visibility rules (MoM #12)

| Role | Sees |
|------|------|
| Sales Executive | Own assigned leads & test drives only |
| Sales Manager / Sales Head / Branch Manager | Self + reporting subtree (`reportsTo`) |
| GM / CEO / MD / Super Admin | Full dealership |

**User Master:** `/admin/td/users` — set **Reports to** when creating/editing staff.

---

## 5. Feature flows

### 5.1 Staff login (MoM #2)

```
/login → Login as Admin
  → /admin/login
  → Step 1: Enter email / user ID → Continue
  → Step 2: Enter password → Sign in
  → Redirect by role (executives → My Test Drives / My Dashboard)
```

### 5.2 Customer OTP (MoM #3)

```
Customer enters mobile → Send code on WhatsApp (explicit)
  → Enter 4-digit code → Verify
  → Wrong code: same OTP kept; attempts counted; no auto-new OTP
  → Max attempts: locked; customer must tap Resend / Send again
  → Resend cooldown (default 60s)
```

**Key files:** `src/controllers/whatsappOtpController.js`, `WhatsAppOtpVerify.tsx`

### 5.3 Assignment accept / reject (MoM #7)

```
Manager assigns executive (Admin TD Bookings)
  → assignmentStatus = PENDING_ACCEPTANCE
  → Email to executive (if SMTP configured)
  → Executive opens My Test Drives
       ├─ Accept → CONFIRMED + customer slot confirmation notification
       └─ Reject → UNASSIGNED + returns to pool + ops escalation email
```

**APIs**

- `PATCH /api/v1/admin/td/bookings/:id/assign-executive`  
- `PATCH /api/v1/admin/td/bookings/:id/accept-assignment`  
- `PATCH /api/v1/admin/td/bookings/:id/reject-assignment`  

### 5.4 Customer reschedule — 3 preferred slots (MoM #4 & #5)

```
Customer portal → Request reschedule
  → Select Option 1 / 2 / 3 (date + time each)
  → Optional reason → Submit
  → TDRescheduleRequest created (PENDING)
  → Booking keeps current slot until approval
  → Admin: /admin/td/reschedule-history → Review
       ├─ Approve preferredIndex 0|1|2 → booking updated to RESCHEDULED
       └─ Reject → request closed; booking unchanged
  → History stores: original, preferred[3], approved, requestedBy, approvedBy, reason, timestamps
```

**APIs**

- Customer: `PATCH /api/v1/customer/bookings/:id/reschedule` body `{ preferredSlots: [{slotDate,slotTime}×3], reason? }`  
- Admin list: `GET /api/v1/admin/td/bookings/reschedule/history`  
- Admin decide: `PATCH /api/v1/admin/td/bookings/reschedule/:id/decide`  

### 5.5 Driving licence gate (MoM #9)

```
Before Start driving / start TD log:
  → DL image uploaded + dlVerified = true required
  → Else API/UI blocks start
```

### 5.6 Automated notifications (MoM #1 & #8)

**Engine:** `src/utils/notifications.js`  
**Audit model:** `TDNotification`

| Event | Typical channels |
|-------|------------------|
| Registration confirmation | WhatsApp + Email |
| Slot / booking confirmation | WhatsApp + Email |
| Assignment pending acceptance | Email to executive |
| Reschedule request received | WhatsApp + Email |
| Reschedule approved | WhatsApp + Email |
| Test drive completed | WhatsApp |
| Assignment rejected | Email to `OPS_ESCALATION_EMAIL` |

Flow:

```
Business event → notify*() → build template message
  → persist TDNotification (PENDING)
  → attempt EMAIL (SMTP) and/or WHATSAPP (journey flag)
  → mark SENT | SKIPPED | FAILED
```

### 5.7 Calendar dashboard (MoM #11)

**UI:** `/admin/calendar`  
**API:** `GET /api/v1/admin/dashboard/calendar?from=&to=`

Aggregates:

- Test drives  
- Lead follow-ups  
- Pending repeat-TD approvals  
- Pending reschedule requests  

Each event includes an `href` deep link into the relevant admin module.

### 5.8 Fleet charging & health (MoM #13)

**UI:** `/admin/td/fleet-health`  
**API base:** `/api/v1/admin/td/fleet/`

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Readiness, battery, maintenance, upcoming TDs |
| `GET/POST /charging` | Charging schedule logs |
| `PATCH /charging/:id` | Update charge status |
| `POST/PATCH /maintenance` | Maintenance / repair logs |

### 5.9 Reverse geocoding (MoM #14)

```
lat,lng → GET/POST /api/v1/admin/geocode/reverse
  → Nominatim (default) or Google (if GEOCODING_PROVIDER=google + key)
  → formattedAddress
```

Customer booking location: `PATCH /api/v1/customer/bookings/:id/location`

### 5.10 Duplicate leads (MoM #15)

**Runtime:** `pvLeadIntake` — same mobile with an open lead updates that lead (does not create a second open opportunity).

**Historical cleanup:**

```bash
npm run dedupe:leads          # dry-run
APPLY=1 npm run dedupe:leads  # apply soft-merge
```

### 5.11 Pre-Booking navigation (MoM #17)

| Kept | Removed / reduced |
|------|-------------------|
| Navbar **Book Now** → `/book-now` | Test Drive page Pre-Booking hyperlinks |
| Footer Pre-Booking | Quick Action Bar Pre-Booking tile |

---

## 6. New / updated admin screens

| Screen | Path |
|--------|------|
| Calendar | `/admin/calendar` |
| Reschedule History | `/admin/td/reschedule-history` |
| Fleet Health | `/admin/td/fleet-health` |
| User Master (Reports to) | `/admin/td/users` |
| My Test Drives (Accept/Reject) | `/admin/td/my-bookings` |
| Staff login (2-step) | `/admin/login` |
| Customer reschedule (3 options) | `/customer/bookings` |

---

## 7. Useful npm scripts

```bash
# Org hierarchy seed (Patliputra chart)
npm run seed:td-team

# Deduplicate CRM leads by mobile
npm run dedupe:leads
APPLY=1 npm run dedupe:leads

# Legacy CRM JSON import scaffold
npm run import:legacy-crm
# Place files in: src/data/legacy/leads.json (and future exports)
```

---

## 8. Production checklist (email + messaging)

- [ ] Place official VinFast / dealership **SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM** in server `.env`  
- [ ] Set `OPS_ESCALATION_EMAIL` for reject/escalation alerts  
- [ ] Restart API process after `.env` change  
- [ ] Send a test assignment and confirm email arrives  
- [ ] Confirm WhatsApp OTP still works (`WHATSAPP_OTP_ENABLED=true`)  
- [ ] Keep `WHATSAPP_JOURNEY_ENABLED=false` until journey templates are approved  
- [ ] Re-run `npm run seed:td-team` on each environment that needs the org chart  
- [ ] Verify Sales Manager only sees their team’s CRM/TD data  
- [ ] Verify MD/CEO/GM see unrestricted data  

---

## 9. Technical notes

- Notification failures are **non-blocking** for core booking/CRM transactions (logged + `TDNotification` row).  
- Without SMTP, email channel status is `SKIPPED` with reason `email_not_configured`.  
- Parallel/legacy folder `backend/` is not the live primary API; use root `src/`.  
- Frontend API base defaults to production host via `career-section-nanak/src/lib/apiConfig.ts`.

---

## 10. Document control

| Field | Value |
|-------|--------|
| MoM prepared by | Manmohan Jha, Zentroverse Global Pvt. Ltd. |
| Implementation phase | Post-MoM development (July 2026) |
| Systems covered | Public website, Customer portal, Admin panel, Staff panel, CRM, Test Drive module |

For SMTP mailbox credentials, share only via secure channel with the DevOps/backend owner — **do not commit real passwords to git**.
