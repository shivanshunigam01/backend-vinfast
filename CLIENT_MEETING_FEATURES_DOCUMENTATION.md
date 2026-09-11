# Patliputra VinFast — Feature Implementation Documentation  
### Sales · Stock / Ops · CRM (Meeting Requirements)

| Field | Detail |
|--------|--------|
| **Prepared for** | Patliputra VinFast (Client) |
| **Prepared by** | Implementation Team |
| **Scope** | Backend APIs + Admin / Staff portals |
| **Document type** | Functional + Technical handover |
| **Status** | Implemented and ready for UAT |
| **API base** | `/api/v1/admin` |

---

## 1. Purpose

This document describes the features agreed in recent internal meetings (Sales Team, Pranay Sir & Harsh Sir, and Priya Ma’am – CRM). It covers:

1. **What was delivered** (business outcome)  
2. **How users will use it** (portal flow)  
3. **Backend APIs** (for technical review / integration)  
4. **Access control** (who can see / edit what)  
5. **UAT checklist** (how the client can verify)

---

## 2. Portals & login

| Portal | Frontend URL | Backend login API | Typical users |
|--------|--------------|-------------------|---------------|
| Admin | `/admin/login` | `POST /api/v1/admin/auth/login` | Super Admin, Manager, Ops |
| Staff / Employee | `/staff/login` | `POST /api/v1/admin/auth/staff-login` | DSE, CRE, field executives |

Both return a JWT token used as `Authorization: Bearer <token>` on subsequent admin APIs.

---

## 3. Delivery status (meeting points)

### A. Points discussed with the Sales Team

| # | Requirement | Status | Notes |
|---|-------------|--------|--------|
| A1 | Back button – Mobile version | **Done** | Frontend navigation fix; prevents awkward jumps / forced re-login feel on mobile |
| A2 | Multiple Opportunity IDs under same Customer ID / Phone | **Done** | Same customer can have separate opportunities (e.g. two test-drive vehicles) |
| A3 | Reopen Lost lead (same DSE vs new lead) | **Done** | Two reopen modes on Lost / Not Interested leads |
| A4 | DSE-wise feedback visibility | **Done** | Executives see only their own customers’ feedback |
| A5 | Customer-wise follow-up tracking | **Done** | Follow-ups viewable for one customer across opportunities |

### B. Points discussed with Pranay Sir & Harsh Sir

| # | Requirement | Status | Notes |
|---|-------------|--------|--------|
| B1 | Requisition Planning module | **Done** | Plan vehicle demand (model / variant / colour / qty) |
| B2 | Delete option in Pipeline | **Done** | Stage-wise delete with safety rules + ACL |
| B3 | Other OEM – additional field | **Done** | Free-text details when Other / OEM campaign is selected |
| B4 | Gate Entry & GRN – edit access | **Done** | Correction APIs; Super Admin enabled in UI |
| B5 | Vehicle tags – Loaner Car & Demo Car | **Done** | Tag / untag on Vehicle Stock |
| B6 | Retail / Delivery Report – Car Model & Variant | **Done** | Extra columns on delivery report |
| B7 | Stock Transfer module | **Done** | Move vehicles across yard / branch / dealer |
| B8 | Technical Hold – Category | **Done** | Category classification under Technical Hold |

### C. Points discussed with Priya Ma’am (CRM)

| # | Requirement | Status | Notes |
|---|-------------|--------|--------|
| C1 | Booking Report – CRM | **Done** | Customer-wise booking details (Name, Model, Variant, Colour) |
| C2 | Complaint Inbound | **Done** | Customer-raised complaints |
| C3 | Complaint Outbound | **Done** | Dealership-initiated complaint / outreach tracking |

---

## 4. Feature details (business + technical)

### A1. Mobile Back Button

**Business need:** On mobile, moving between modules was difficult and sometimes felt like a logout.

**Solution:** Admin shell shows a **Back** control on mobile that returns to the previous screen (history back). No session is cleared by this action.

**Backend:** Not required (frontend-only UX).

**Where to check:** Staff/Admin on phone width → open Lead CRM or Stock → use **← Back**.

---

### A2. Multiple Opportunity IDs (same Customer / Phone)

**Business need:** Same customer may take test drives for two different vehicles. Each must be tracked separately without creating a duplicate customer master.

**Behaviour:**
- One customer record is retained against the same mobile / Customer ID.
- By default, creating another **open** lead for the same mobile is blocked.
- User can explicitly choose **Create as new opportunity**.
- System allocates a new unique **Opportunity ID** while keeping the same customer linkage.

**APIs**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/admin/crm/leads` | Create lead; send `forceNewOpportunity: true` for a new opportunity |
| `POST` | `/api/v1/admin/crm/leads/bulk` | Bulk create with same rules |
| `GET` | `/api/v1/admin/crm/leads/:id` | Lead detail includes related / sibling opportunities where applicable |

**Important request field**

```json
{
  "name": "Customer Name",
  "mobile": "9876543210",
  "model": "VF 7",
  "forceNewOpportunity": true
}
```

**Permission:** `crm_leads:create`

**Frontend:** Admin / Staff → **Lead CRM** → Add Lead → enable **Create as new opportunity**.

---

### A3. Reopen Lost Lead

**Business need:**
- If a Lost customer returns to the **same DSE** → reopen the existing lead/opportunity.
- If assigned to a **different DSE** → reopen as a **new lead** while retaining customer details.

**API**

| Method | Path |
|--------|------|
| `POST` | `/api/v1/admin/crm/leads/:id/reopen` |

**Request body**

```json
{
  "mode": "same",
  "status": "Open",
  "executiveId": "<optional>"
}
```

| `mode` | Result |
|--------|--------|
| `same` | Existing opportunity is reopened; history retained |
| `new` | New lead + new opportunity created; old lead stays Lost; customer details carried forward |

**Rules**
- Allowed only when lead status is **Lost** or **Not Interested**.
- Permission: `crm_leads:update`

**Frontend:** Lead CRM → open Lost lead → **Reopen lead** / **Reopen as new lead**.

---

### A4. DSE-wise Feedback Visibility

**Business need:** One DSE must not see feedback submitted for another DSE’s customers.

**APIs**

| Method | Path |
|--------|------|
| `GET` | `/api/v1/admin/feedback/test-drive` |
| `GET` | `/api/v1/admin/feedback/post-delivery` |

**Visibility rules**
- **DSE / executive:** only feedback linked to their assignment (sales consultant match and/or mobiles of leads assigned to them).
- **Super Admin / Manager / CRE / Admin users:** full visibility for supervision.

**Permissions:** `feedback_test_drive:view`, `feedback_post_delivery:view`

**Frontend:** **TD Feedback** / **Delivery Feedback**.

---

### A5. Customer-wise Follow-up Tracking

**Business need:** Follow-up filters should support reviewing **all follow-ups for one customer**, not a mixed global dump only.

**APIs**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/admin/crm/leads/follow-ups/by-customer?customerId=` or `?pvCustomerId=` | All follow-ups for one customer |
| `GET` | `/api/v1/admin/crm/leads/:id/follow-ups` | Follow-ups for one lead |
| `POST` | `/api/v1/admin/crm/leads/:id/follow-ups` | Add follow-up |
| `PATCH` | `/api/v1/admin/crm/leads/:id/follow-ups/:followUpId` | Update / complete follow-up |

**Permission:** view → `crm_leads:view`; write → `crm_leads:update`

**Frontend:** Lead CRM → open customer/lead → **Customer follow-ups**.

---

### B1. Requisition Planning Module

**Business need:** Plan and manage vehicle requirements before / alongside purchase flow.

**APIs** (prefix `/api/v1/admin/stock/pipeline`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/requisitions` | List |
| `POST` | `/requisitions` | Create (model, variant, colour, qty, priority, neededBy, remarks) |
| `PUT` | `/requisitions/:id` | Edit (Draft / Submitted) |
| `POST` | `/requisitions/:id/submit` | Submit |
| `POST` | `/requisitions/:id/approve` | Approve |
| `DELETE` | `/requisitions/:id` | Delete Draft only |

**Statuses:** `DRAFT` → `SUBMITTED` → `APPROVED` (plus closed/cancelled states in model)

**Permission module:** `stock_requisition` (`view`, `create`, `update`, `delete`, `approve`)

**Frontend:** Stock → **Requisition Planning** → `/admin/stock/requisitions`

---

### B2. Delete Option in Pipeline

**Business need:** Allow authorised users to delete pipeline documents when a correction is needed, without breaking downstream records.

**Delete endpoints** (prefix `/api/v1/admin/stock/pipeline`)

| Method | Path |
|--------|------|
| `DELETE` | `/purchase-orders/:id` |
| `DELETE` | `/dispatches/:id` |
| `DELETE` | `/gate-entries/:id` |
| `DELETE` | `/grns/:id` |
| `DELETE` | `/receipts/:id` |
| `DELETE` | `/pdi/:id` |
| `DELETE` | `/rectifications/:id` |

**Safety rules (examples)**
- PO: only Draft and only if no dispatches exist  
- Gate: blocked if GRN already exists  
- GRN: blocked if receipt already exists  

**Permission:** matching stage module `*:delete` (or equivalent stock delivery delete rights)

---

### B3. Other OEM – Additional Field

**Business need:** When hold / vendor context is **Other OEM** (or OEM campaign), capture free-text detail.

**Where stored**
- Vehicle hold: `otherOemDetails`
- Vendor master: `otherOemDetails`

**APIs**
- Hold: `POST /api/v1/admin/stock/pipeline/vehicles/:id/hold` with `otherOemDetails`
- Vendors: create/update under `/api/v1/admin/stock/vendors`

**Frontend:** Vendor Master + Pre-Stock PDI / Hold flows when Other OEM is selected.

---

### B4. Gate Entry & GRN – Edit Access

**Business need:** Super Admin must correct Gate Entry / GRN data after creation.

**APIs**

| Method | Path | Editable fields (key) |
|--------|------|------------------------|
| `PUT` | `/api/v1/admin/stock/pipeline/gate-entries/:id` | truck/seal details, remarks, arrival photo/datetime |
| `PUT` | `/api/v1/admin/stock/pipeline/grns/:id` | remarks, invoice number, GRN datetime, status |

**Permission:** `stock_gate:update` / `stock_grn:update` (Super Admin UI is enabled for corrections)

**Frontend:** Stock pipeline → **3 · Gate Entry** / **4 · GRN** → Edit.

---

### B5. Vehicle Tags — Loaner Car & Demo Car

**Business need:** Identify vehicles used as **Demo** (test-drive fleet) or **Loaner**.

**APIs**

| Method | Path | Body |
|--------|------|------|
| `PATCH` | `/api/v1/admin/stock/vehicles/:id/demo` | `{ "demo": true }` or `{ "demo": false }` |
| `POST` | `/api/v1/admin/stock/vehicles/:id/tag-loaner` | `{ "loaner": true }` / `{ "loaner": false }` |

**Notes**
- Demo tagging can link the unit into the Test Drive demo fleet.
- Sold / delivered units cannot be tagged.
- Untagging demo may be blocked if an active TD booking exists.

**Permissions**
- Demo: `vehicle_stock:tag_demo`
- Loaner: `vehicle_stock:update`

**Frontend:** Stock → **7 · Vehicle Stock** → Tag as demo / Tag as loaner.

---

### B6. Retail / Delivery Report — Car Model & Variant

**Business need:** Delivery / retail reporting must show **Car Model** and **Car Variant** clearly.

**APIs**

| Method | Path |
|--------|------|
| `GET` | `/api/v1/admin/reports/deliveries` |
| `GET` | `/api/v1/admin/crm/reports/deliveries` *(alias)* |

**Row fields include:** `carModel`, `carVariant`, `colour`, customer name/mobile, executive, dates.

**Permission:** `delivery_reports:view`

**Frontend:** Reports → **Delivery Reports**.

---

### B7. Stock Transfer Module

**Business need:** Track transfer of vehicles between locations / branches / dealers.

**APIs**

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/admin/stock/pipeline/vehicles/:id/move` | Execute transfer |
| `GET` | `/api/v1/admin/stock/pipeline/transfers` | Transfer history |

**Move body (key fields):** `transferType` (`LOCATION` | `BRANCH` | `DEALER`), yard/zone/bay, branch IDs, `toDealerName`, `remarks`.

**Permission:** `stock_inventory:update` or `vehicle_stock:update`

**Frontend:** Stock → **Stock Transfer** → `/admin/stock/transfer`

---

### B8. Technical Hold — Category

**Business need:** Classify technical holds by reason type.

**API:** `POST /api/v1/admin/stock/pipeline/vehicles/:id/hold`

**When** `holdReason = "TECHNICAL"`, send:

```json
{
  "holdReason": "TECHNICAL",
  "technicalHoldCategory": "ELECTRICAL"
}
```

**Allowed categories:**  
`ELECTRICAL` · `MECHANICAL` · `SOFTWARE` · `BATTERY_HV` · `BODY` · `DIAGNOSTIC` · `OTHER`

**Release:** `POST /api/v1/admin/stock/pipeline/vehicles/:id/release-hold`

**Frontend:** Pre-Stock PDI / Hold flow → select Technical Hold → choose Category.

---

### C1. Booking Report (CRM)

**Business need:** CRM team needs a customer-wise booking report with:

- Customer Name  
- Car Model  
- Variant  
- Colour  

**APIs**

| Method | Path |
|--------|------|
| `GET` | `/api/v1/admin/reports/bookings` |
| `GET` | `/api/v1/admin/crm/reports/bookings` *(alias)* |

**Query support:** period presets / `from`–`to` / `source`

**Response highlights:** `totalBookings`, breakdowns by executive / model / source / period, plus `rows[]` (customer-wise detail).

**Permission:** `booking_reports:view` (export available in ACL)

**Frontend:** Reports → **Booking Report** → `/admin/reports/bookings`

---

### C2 / C3. Complaint Inbound & Outbound

**Business need:** Separate tracking for:
- **Inbound** — customer raised  
- **Outbound** — dealership initiated  

**APIs** (prefix `/api/v1/admin/complaints`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | List (`direction`, `status`, `priority`, `search`) |
| `POST` | `/` | Create |
| `GET` | `/:id` | Detail |
| `PUT` | `/:id` | Update |
| `POST` | `/:id/communications` | Add communication / status note |
| `DELETE` | `/:id` | Delete (authorised roles) |

**Create example**

```json
{
  "direction": "INBOUND",
  "customerName": "Rahul Kumar",
  "mobile": "9876543210",
  "subject": "Delayed delivery follow-up",
  "priority": "MEDIUM",
  "channel": "PHONE"
}
```

**Statuses:** `OPEN` · `IN_PROGRESS` · `RESOLVED` · `CLOSED`  
**Priorities:** `LOW` · `MEDIUM` · `HIGH` · `URGENT`

**Permissions:** `complaint_inbound:*` and/or `complaint_outbound:*`

**Frontend**
- Feedback → **Complaint Inbound** → `/admin/complaints/inbound`
- Feedback → **Complaint Outbound** → `/admin/complaints/outbound`

---

## 5. Access control (module keys)

Grant modules from **User Master / Roles**. Token style: `moduleKey:action`.

| Area | Module key(s) | Typical actions |
|------|----------------|-----------------|
| Lead CRM / reopen / multi-opp / follow-ups | `crm_leads` | view, create, update, delete, assign, export |
| TD feedback | `feedback_test_drive` | view, delete |
| Delivery feedback | `feedback_post_delivery` | view, delete |
| Booking report | `booking_reports` | view, export |
| Delivery report | `delivery_reports` | view, export |
| Complaints | `complaint_inbound`, `complaint_outbound` | view, create, update, delete |
| Requisitions | `stock_requisition` | view, create, update, delete, approve |
| Gate / GRN | `stock_gate`, `stock_grn` | view, create, update, delete |
| Vehicle stock / tags | `vehicle_stock` | view, create, update, delete, **tag_demo** |
| Stock inventory / transfers | `stock_inventory` | view, update, export |

If a menu item is missing for a user, grant the matching module in Roles / User Master.

---

## 6. Frontend screen map (quick reference)

| Feature | Admin path |
|---------|------------|
| Lead CRM | `/admin/crm/leads` |
| TD Feedback | `/admin/feedback/test-drive` |
| Delivery Feedback | `/admin/feedback/post-delivery` |
| Booking Report | `/admin/reports/bookings` |
| Delivery Reports | `/admin/reports/deliveries` |
| Complaint Inbound | `/admin/complaints/inbound` |
| Complaint Outbound | `/admin/complaints/outbound` |
| Requisition Planning | `/admin/stock/requisitions` |
| Gate Entry | `/admin/stock/gate-entry` |
| GRN | `/admin/stock/grn` |
| Vehicle Stock (Demo / Loaner) | `/admin/stock` |
| Stock Transfer | `/admin/stock/transfer` |
| Pre-Stock PDI / Technical Hold | `/admin/stock/pre-stock-pdi` |
| Vendor Master (Other OEM) | `/admin/stock/vendors` |

---

## 7. Client UAT checklist

Use **Super Admin** first to confirm each feature works. Then re-test with a **DSE** account for Sales items A4/A5 and mobile Back.

### Sales

- [ ] Mobile: navigate CRM → use **Back** → session remains active  
- [ ] Create second opportunity for same phone with **Create as new opportunity**  
- [ ] Mark lead Lost → **Reopen lead** (same opportunity)  
- [ ] Mark lead Lost → **Reopen as new lead** (new opportunity; customer retained)  
- [ ] DSE A cannot see DSE B’s feedback  
- [ ] Open one customer → **Customer follow-ups** shows only that customer  

### Stock / Ops

- [ ] Create → submit → approve a requisition  
- [ ] Delete a Draft pipeline document (where allowed)  
- [ ] Other OEM details save on vendor / hold  
- [ ] Super Admin edits Gate Entry and GRN  
- [ ] Tag Demo and Loaner on Vehicle Stock; untag works  
- [ ] Delivery report shows Car Model & Variant  
- [ ] Stock Transfer creates a movement record  
- [ ] Technical Hold requires / stores Category  

### CRM (Priya)

- [ ] Booking Report lists Customer Name, Model, Variant, Colour  
- [ ] Create / update Inbound complaint + communication  
- [ ] Create / update Outbound complaint separately  

---

## 8. Deployment note

For verification on staging / production:

1. Deploy **latest Backend** (`main`)  
2. Deploy **latest Frontend** (`career-section-nanak` `main`)  
3. Confirm environment API base URL points to the updated backend  
4. Run Section 7 checklist  
5. Share any defect with: screen name, user role, steps, expected vs actual, screenshot  

---

## 9. Summary for management

All meeting items listed in Sections **A, B, and C** are implemented in the current codebase:

- Sales CRM continuity (multi-opportunity, reopen, DSE feedback scope, customer follow-ups, mobile back)  
- Stock operations (requisition planning, pipeline delete, OEM detail, Gate/GRN edit, demo/loaner tags, transfer, technical hold category, retail/delivery model-variant reporting)  
- CRM reporting & complaints (Booking Report; Inbound / Outbound complaints)

The system is ready for **client UAT** as per Section 7.

---

*End of document*
