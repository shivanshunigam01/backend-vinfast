# Patliputra Group × VinFast Backend

Production-ready Express + MongoDB backend scaffold aligned to the API documentation shared by the user.

## Stack
- Node.js
- Express.js
- MongoDB + Mongoose
- JWT auth
- Cloudinary metadata/delete support
- Express Validator
- Rate limiting

## Quick start
1. Copy `.env.example` to `.env`
2. Install dependencies
   ```bash
   npm install
   ```
3. Seed first admin
   ```bash
   npm run seed:admin
   ```
4. Start server
   ```bash
   npm run dev
   ```

## Deploy vs seeds (live server)

**Do not** enable startup seeds on production. After `git pull`, only restart the API (`npm start`).  
Live pricing, CRM, TD fleet, and SEO pages are managed in admin — they must not be overwritten on deploy.

| Purpose | Command (run manually on staging/dev only) |
|--------|---------------------------------------------|
| First admin | `npm run seed:admin` |
| Org / TD team | `npm run seed:td-team` |
| Full TD demo data | `SEED_TD_MODULE_CONFIRM=yes npm run seed:td-module` |
| Vehicle pricing rows (insert missing only) | `npm run seed:pricing` |
| CRM pipeline stages (empty DB only) | `npm run seed:lead-stages` |
| Homepage products | `npm run seed:homepage-products` |
| Stock demo pipeline | `npm run seed:stock-pipeline-demo` |

Optional `.env` flags (all default **off**; set to `true` only for empty local DB):

- `SEO_AUTO_BOOTSTRAP` — district SEO page generator on server start  
- `TD_AUTO_BOOTSTRAP` — TD branch/slots; demo fleet/staff only with `TD_DEMO_SEED=true`  
- `TD_SYNC_LEGACY=false` — disable legacy empty-DB staff/fleet import on startup (recommended on production)  
- `STOCK_AUTO_BOOTSTRAP` — default stock config if none exists  

## Base URLs
- Public: `/api/v1`
- Admin: `/api/v1/admin`

## Meta Lead (no JWT)

Set `META_LEADS_UPSTREAM_URL` in `.env` to your Meta / whitelisted leads API.  
This server proxies that URL and returns `{ success, data, meta }` — it does **not** read MongoDB for these routes.

Public endpoints (no `Authorization` header):

- `GET /api/v1/public/All_leads`
- `GET /api/v1/meta-leads`
- `GET /api/v1/admin/All_leads` (same handler, registered before admin `protect`)

## Notes
- Media upload is assumed to happen directly from frontend to Cloudinary using an unsigned preset.
- Backend stores metadata and can delete Cloudinary assets using server credentials.
- Singleton collections (`SiteConfig`, `DealerSettings`) are upserted on update and lazily defaulted on first read.
