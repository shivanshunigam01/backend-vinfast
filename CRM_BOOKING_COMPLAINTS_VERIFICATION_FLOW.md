# CRM verification flow — Booking Report & Complaints

Use this checklist after deploy to verify the **Priya Ma’am (CRM)** features on staging/live.

**Commit:** `5c5a1ee` (and later) · **Author:** shivanshunigam01  

**Who can test:** Super Admin / Manager (or any user with modules `booking_reports`, `complaint_inbound`, `complaint_outbound` in User Master).

---

## 0. Before you start

1. Deploy **backend** + **frontend** with the latest `main`.
2. Open Admin portal and sign in.
3. Confirm sidebar shows:
   - **Reports → Booking Report**
   - **Feedback → Complaint Inbound**
   - **Feedback → Complaint Outbound**

| Feature | Direct URL (after `/admin`) |
|--------|------------------------------|
| Booking Report | `/admin/reports/bookings` |
| Complaint Inbound | `/admin/complaints/inbound` |
| Complaint Outbound | `/admin/complaints/outbound` |

If a menu item is missing, open **User Master → Roles / user** and grant:

- `booking_reports` → view (+ export)
- `complaint_inbound` → view / create / update / delete
- `complaint_outbound` → view / create / update / delete

---

## 1. Booking Report — customer-wise list

### Goal
See a **customer-wise** list with at least:

- Customer Name  
- Car Model  
- Variant  
- Colour  

### Happy path

1. Go to **Reports → Booking Report** (`/admin/reports/bookings`).
2. Page should load without error (not “Booking reports unavailable”).
3. Set period to **Monthly** (or **Yearly** if you need a wider window).
4. Leave Source = **All sources**.
5. Check summary cards:
   - Total bookings  
   - Executives with bookings  
   - Models booked  
6. Scroll to **Customer-wise bookings** table.
7. Confirm columns: **Customer Name | Car Model | Variant | Colour | Mobile | Executive | Booking Date**.
8. Click **CSV** — file downloads; open it and confirm the same columns.

### How to get rows if the table is empty

Bookings come from:

- Vehicle orders (stock orders linked to a lead), **or**
- CRM leads in stage **Booking** / `creSheet.bookingDone`

**Quick seed via CRM UI:**

1. Open **Lead CRM** → pick or create a lead.
2. Move stage to **Booking** (or convert / open vehicle order if your flow does that).
3. Ideally set model / variant / colour on the order or CRE sheet (`finalModel`, `finalVariant`, `finalColour`).
4. Return to Booking Report → Refresh → row should appear for that customer.

**Hints**

- Model/variant/colour prefer: order `preferred*` → else lead `creSheet.final*` → else lead `model`.
- Date filter uses order created date or `creSheet.bookingDate`.
- Source filter only shows bookings whose **lead source** matches.

### Pass / fail

| Check | Pass? |
|-------|-------|
| Page opens from sidebar | ☐ |
| Table columns Name / Model / Variant / Colour | ☐ |
| CSV export works | ☐ |
| At least one real booking row after seeding | ☐ |

---

## 2. Complaint Inbound — list + track

### Goal
Separate **Inbound** list to log customer-raised complaints and update status/comms.

### Happy path

1. Go to **Feedback → Complaint Inbound** (`/admin/complaints/inbound`).
2. Click **New complaint**.
3. Fill:
   - Customer name  
   - Mobile (10-digit, starts 6–9)  
   - Subject  
   - Optional: description, channel, priority, model, category  
4. **Save** → toast “Complaint logged”.
5. New card appears with complaint no. like `CMP-YYYYMMDD-001`, status **OPEN**.
6. Change status dropdown → **IN_PROGRESS** → toast confirms.
7. Click the card → detail dialog opens.
8. Add a communication note → **Log update** → note appears under Communications.
9. Set status **RESOLVED** / **CLOSED**.
10. Use search (name/mobile/subject) and status filter — list updates.
11. (Optional) Delete with trash icon → confirm → row gone.

### Pass / fail

| Check | Pass? |
|-------|-------|
| Inbound page opens | ☐ |
| Create inbound complaint | ☐ |
| Status change works | ☐ |
| Communication log works | ☐ |
| Search / status filter works | ☐ |

---

## 3. Complaint Outbound — list + track

### Goal
Separate **Outbound** list for dealership-initiated complaint follow-ups / calls.

### Happy path

1. Go to **Feedback → Complaint Outbound** (`/admin/complaints/outbound`).
2. Confirm header says **Complaint Outbound** (not Inbound).
3. **New complaint** → save one outbound row (same fields as inbound).
4. Confirm it appears **only** on Outbound — it must **not** show on Inbound list.
5. Repeat status + communication steps from Inbound.

### Pass / fail

| Check | Pass? |
|-------|-------|
| Outbound page opens | ☐ |
| Create outbound complaint | ☐ |
| Row does **not** appear on Inbound | ☐ |
| Status + communication work | ☐ |

---

## 4. API smoke checks (optional)

Base: your API host + `/api/v1` (e.g. `https://apivnfast.patliputragroup.com/api/v1`).  
Use a valid admin JWT (`Authorization: Bearer …`).

```http
GET /admin/reports/bookings?period=monthly
GET /admin/complaints?direction=INBOUND&limit=20
GET /admin/complaints?direction=OUTBOUND&limit=20
POST /admin/complaints
Content-Type: application/json

{
  "direction": "INBOUND",
  "customerName": "Test Customer",
  "mobile": "9876543210",
  "subject": "Verification complaint",
  "description": "Created from verification flow",
  "priority": "MEDIUM",
  "channel": "Phone"
}
```

Expect `success: true` and data payload (not 404 / 403).

---

## 5. Common issues

| Symptom | Likely fix |
|--------|------------|
| Menu item missing | Grant module in User Master; re-login |
| Booking report empty | Widen period; create a Booking-stage lead / vehicle order |
| 403 on complaints | Grant `complaint_inbound` / `complaint_outbound` create+view |
| 404 on `/reports/bookings` | Backend not redeployed with latest `main` |
| Frontend old UI | Hard refresh / redeploy frontend build |

---

## 6. Sign-off

Tester: _________________  
Date: _________________  
Environment: ☐ Local ☐ Staging ☐ Live  

- Booking Report verified: ☐  
- Complaint Inbound verified: ☐  
- Complaint Outbound verified: ☐  

Notes: _______________________________________________
