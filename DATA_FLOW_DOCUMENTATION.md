# Patliputra VinFast — Data Flow Documentation

**For client / stakeholder review**  
**Primary API:** `https://apivnfast.patliputragroup.com/api/v1`  
**Public site:** `https://patliputravinfast.in`  
**Document date:** 30 July 2026  

This document explains how data moves through the Patliputra VinFast system and how the main modules relate to each other.

---

## 1. System overview

| Layer | Technology | Location |
|--------|------------|----------|
| Public website + Admin / Staff / Customer portals | Vite + React SPA | `career-section-nanak/` |
| Backend API | Express + MongoDB | Root `src/` + `server.js` |

```mermaid
flowchart TB
  subgraph public [Public website]
    WebForms[Lead / Test Drive / Enquiry / Book Now forms]
  end

  subgraph api [API /api/v1]
    PublicAPI[Public endpoints]
    AdminAPI[Admin / Staff endpoints]
  end

  subgraph data [MongoDB]
    Leads[(Leads CRM)]
    TDBookings[(TD Bookings)]
    TDStaff[(TD Staff hierarchy)]
    Customers[(Customers)]
    Feedback[(TD / Delivery Feedback)]
  end

  subgraph portals [Staff portals]
    CRM[Lead CRM]
    TDMgmt[TD Management]
    MyTD[My Test Drives]
    FeedbackUI[Feedback modules]
  end

  WebForms --> PublicAPI
  PublicAPI --> Leads
  PublicAPI --> TDBookings
  PublicAPI --> Customers

  CRM --> AdminAPI
  TDMgmt --> AdminAPI
  MyTD --> AdminAPI
  FeedbackUI --> AdminAPI

  AdminAPI --> Leads
  AdminAPI --> TDBookings
  AdminAPI --> TDStaff
  AdminAPI --> Customers
  AdminAPI --> Feedback
```

---

## 2. Staff roles and visibility

Hierarchy is stored on **`TDStaff.reportsTo`** (not a separate `managerId` field).

| Auth role | Typical designation | What they see |
|-----------|---------------------|---------------|
| `executive` | Sales Executive | Own assigned leads and TD bookings only |
| `manager` | Sales Manager, Sales Head, Branch Manager | Self + everyone in their `reportsTo` subtree |
| `superadmin` / unrestricted | MD, CEO, GM, CRE | Full dealership |

```mermaid
flowchart TD
  MD[MD]
  CEO[CEO]
  GM[GM]
  SH[Sales Head]
  SM[Sales Manager]
  SE1[Sales Executive A]
  SE2[Sales Executive B]

  MD --> CEO --> GM --> SH --> SM
  SM --> SE1
  SM --> SE2
```

**Sales Manager filter behaviour (CRM + TD):**

- Default list = own leads/bookings **plus** reporting Sales Executives.
- Staff dropdown = self + team only (`GET /admin/td/users/assignable`).
- Choosing a specific SE (or “Me”) sends `assignedTo` / `assignedExecutive` and intersects with the team scope.

---

## 3. Public website → CRM / TD intake

```mermaid
sequenceDiagram
  participant Visitor
  participant Website
  participant API
  participant Lead as Lead collection
  participant Booking as TDBooking
  participant Customer as Customer

  Visitor->>Website: Submit Test Drive / Lead / Enquiry
  Website->>API: POST /public/... (OTP / captcha as configured)
  API->>Customer: Upsert by mobile
  API->>Lead: Create or update open lead (dedupe by mobile)
  alt Test Drive booked
    API->>Booking: Create TD booking + slot
    API->>Lead: Status e.g. Test Drive Booked
  end
  API-->>Website: Success response
```

**Typical sources**

| Source | Creates |
|--------|---------|
| Website test drive form | `TDBooking` + CRM `Lead` |
| Book Now / lead forms | CRM `Lead` |
| Enquiry form | Enquiry + often mirrored CRM lead |
| Meta ads ingest | Meta lead CRM pipeline |
| Staff “Add lead” / walk-in TD booking | Lead and/or booking from admin |

Lead IDs use Patliputra conventions (`PVLEAD*` / opportunity ids) via intake utilities.

---

## 4. Lead CRM lifecycle

**Admin screens:** Lead CRM (`/admin/crm/leads`), TD Leads (`/admin/td/leads`) — both use CRM lead APIs.

```mermaid
stateDiagram-v2
  [*] --> NewLead: Intake / Create
  NewLead --> Assigned: Manager assigns SE
  Assigned --> FollowUp: Follow-ups / stage changes
  FollowUp --> TestDriveBooked: Book TD from CRM
  TestDriveBooked --> FollowUp: Drive done / continue nurture
  FollowUp --> Booking: Convert / Booking stage
  Booking --> Delivered: Delivery convert
  FollowUp --> Lost: Lost / closed stages
  Delivered --> [*]
  Lost --> [*]
```

**Assignment**

1. Manager (or ACL user with `crm_leads:assign`) selects staff from assignable list.
2. Lead stores `assignedTo` (TDStaff id) + `assignedToEmail`.
3. Stage history and follow-ups attach to the lead.
4. Completing a TD can sync lead status / assignment from the booking executive.

---

## 5. Test Drive booking lifecycle

**Admin screens:** TD Bookings (`/admin/td/bookings`), My Test Drives (`/admin/td/my-bookings`).

```mermaid
flowchart TD
  Create[Booking created PENDING]
  Assign[Manager assigns executive]
  PendingAcc[assignmentStatus PENDING_ACCEPTANCE]
  Accept[SE Accepts]
  Reject[SE Rejects]
  Confirmed[bookingStatus CONFIRMED]
  Vehicle[Assign demo vehicle]
  Start[Start drive IN_PROGRESS]
  Complete[COMPLETED + feedback]
  Cancel[CANCELLED]
  Delete[Hard DELETE managers only]

  Create --> Assign --> PendingAcc
  PendingAcc --> Accept --> Confirmed
  PendingAcc --> Reject --> Assign
  Confirmed --> Vehicle --> Start --> Complete
  Create --> Cancel
  Confirmed --> Cancel
  Create --> Delete
  Cancel --> Delete
```

| Action | Who | API (prefix `/api/v1`) |
|--------|-----|-------------------------|
| List bookings | Manager / scoped staff | `GET /admin/td/bookings` |
| My bookings | Assigned executive (+ team for managers) | `GET /admin/td/bookings/my` |
| Assign executive | Manager | `PATCH /admin/td/bookings/:id/assign-executive` |
| Accept | Assigned SE (or manager) | `PATCH /admin/td/bookings/:id/accept-assignment` |
| Reject | Assigned SE (or manager) | `PATCH /admin/td/bookings/:id/reject-assignment` |
| Cancel | Permitted roles | `PATCH /admin/td/bookings/:id/cancel` |
| Delete permanently | Manager / admin | `DELETE /admin/td/bookings/:id` |

**Cancel vs Delete**

- **Cancel** keeps the record with status `CANCELLED` (history preserved).
- **Delete** removes the row from MongoDB (managers only; blocked while `IN_PROGRESS`).

---

## 6. Relationship between modules

```mermaid
flowchart LR
  subgraph crm [Lead CRM]
    LeadRec[Lead]
    FollowUps[Follow-ups]
    History[Stage history]
  end

  subgraph td [TD Management]
    Booking[TD Booking]
    Vehicle[Demo vehicle]
    Fleet[Fleet health]
    MyBookings[My Test Drives]
  end

  subgraph feedback [Feedback]
    TDFb[Test Drive feedback]
    DelFb[Post-delivery feedback]
  end

  LeadRec -->|"Book TD from CRM"| Booking
  Booking -->|"assigned executive"| MyBookings
  Booking -->|"on complete"| LeadRec
  Booking --> Vehicle
  Booking --> TDFb
  LeadRec -->|"Delivered"| DelFb
  Vehicle --> Fleet
```

| Module | Primary data | Depends on |
|--------|--------------|------------|
| Lead CRM | `Lead` | `TDStaff` (assignment) |
| TD Bookings | `TDBooking` | Customer, vehicle, assigned executive |
| TD Leads | Same CRM `Lead` APIs | Same as Lead CRM |
| My Test Drives | Bookings assigned to logged-in staff | Assignment accept/reject |
| Fleet / vehicles | Demo fleet inventory | Used when starting a drive |
| Feedback | Form submissions keyed to booking / delivery | Completed TD or delivered lead |
| User Master | `TDStaff` + `reportsTo` | Gates visibility and assignable lists |
| Calendar | Aggregated events | Bookings, follow-ups, approvals |

---

## 7. Customer portal

Customers authenticate with WhatsApp OTP and can view/manage their own bookings (including reschedule with preferred slots where enabled). Staff still own assignment, vehicle allocation, and drive completion in the admin portal.

---

## 8. Feedback modules

| Module | Path | Trigger |
|--------|------|---------|
| Test Drive Feedback | Public QR / form + `/admin/feedback/test-drive` | After TD completion |
| Post-delivery Feedback | Public form + `/admin/feedback/post-delivery` | After delivery conversion |

Feedback records are stored separately from CRM stage history but may reference booking or customer ids.

---

## 9. Key API map (admin)

Base: `/api/v1/admin`

| Area | Examples |
|------|----------|
| Auth | `POST /auth/login`, `POST /auth/staff-login`, `GET /auth/me` |
| CRM leads | `GET/POST /td/leads`, assign, stage, follow-ups |
| TD bookings | `GET /td/bookings`, assign-executive, accept-assignment, cancel, `DELETE /td/bookings/:id` |
| Staff | `GET /td/users`, `GET /td/users/assignable` (team-scoped for SM) |
| Vehicles / fleet | `/td/vehicles`, `/td/fleet-health`, `/stock` |
| Feedback | Feedback submission list endpoints under admin feedback modules |
| Dashboard | `/dashboard/stats`, `/dashboard/calendar`, `/my-dashboard` |

Public intake lives under `/api/v1/public/...` (leads, test-drives, enquiries, OTP, site config).

---

## 10. Notifications (side effects)

When configured (SMTP / WhatsApp), the notification engine can emit:

- Booking created / confirmed  
- Assignment rejection escalations  
- Customer OTP and journey messages  

Mail will not leave the server until SMTP env vars are set (see `MOM_IMPLEMENTATION_DOCUMENTATION.md`).

---

## 11. End-to-end example: website TD → SE acceptance

1. Visitor books a test drive on the website → `TDBooking` (`PENDING`) + CRM lead.  
2. Sales Manager opens **TD Bookings**, filters team if needed, assigns a Sales Executive.  
3. `assignmentStatus` becomes `PENDING_ACCEPTANCE`.  
4. SE opens **My Test Drives** and taps **Accept**.  
5. Booking becomes `CONFIRMED` / `ACCEPTED`; manager assigns a demo vehicle.  
6. SE starts drive → `IN_PROGRESS` → completes with odometer / feedback.  
7. CRM lead status updates from completion sync; optional TD Feedback form is available.

---

*End of data flow documentation — Patliputra VinFast.*
