# Patliputra VinFast — SEO Documentation

**For client verification on the live site**  
**Primary domain:** [https://patliputravinfast.in](https://patliputravinfast.in)  
**Document date:** 29 July 2026  
**Last implementation update:** 29 July 2026  

This document lists every SEO asset, URL, and keyword strategy applied in the Patliputra VinFast project so you can open each link on the live site and verify it.

---

## Implementation & verification status

| Area | Status | Notes |
|------|--------|--------|
| Backend SEO APIs | **PASS (live)** | Verified on `https://apivnfast.patliputragroup.com/api/v1` |
| Backend sitemap / robots / llms | **PASS (live)** | Served at API root + `/api/v1/*` |
| District pages in DB (152) | **PASS (live)** | Bootstrap via `SEO_AUTO_BOOTSTRAP`; APIs return meta + JSON-LD |
| Frontend routes for all catalog URLs | **IMPLEMENTED (needs deploy)** | District pages, blogs, compare SEO, guides, calculators |
| Per-page meta (title/desc/canonical/OG/Twitter) | **IMPLEMENTED (needs deploy)** | `usePageSeo` on public pages |
| Homepage meta + JSON-LD + Twitter | **IMPLEMENTED (needs deploy)** | Canonical aligned to `.in` |
| `robots.txt` / `llms.txt` on frontend | **IMPLEMENTED (needs deploy)** | Matches backend rules + Sitemap line |
| `/sitemap.xml` on frontend host | **IMPLEMENTED (needs deploy)** | Vercel rewrite + Apache redirect → API sitemap |
| Keyword strategy | **PASS** | Catalog in backend + district templates + page keywords |

**Direct API checks (work before frontend redeploy):**

- https://apivnfast.patliputragroup.com/api/v1/sitemap.xml  
- https://apivnfast.patliputragroup.com/api/v1/robots.txt  
- https://apivnfast.patliputragroup.com/api/v1/llms.txt  
- https://apivnfast.patliputragroup.com/api/v1/public/seo/global  
- https://apivnfast.patliputragroup.com/api/v1/public/seo/district-pages/patna/vinfast-vf6  

After deploying the frontend build, re-check the same paths on **https://patliputravinfast.in**.

---

## How to verify (quick checklist)

1. Open each **Discovery** URL below in a browser — sitemap and robots should load as plain text/XML.
2. Open homepage and inspect **View Source** for title, description, Open Graph, Twitter, and JSON-LD.
3. Spot-check several **district landing** URLs (e.g. Patna VF6, Gaya VF7) — page content + unique browser title.
4. Call the **Public SEO APIs** (JSON responses) to confirm meta and schema data.
5. Confirm Google Search Console / crawl uses **patliputravinfast.in** as the property.

---

## 1. Core discovery URLs (verify first)

| # | Asset | Live URL | What you should see |
|---|--------|----------|---------------------|
| 1 | Homepage | https://patliputravinfast.in/ | Site loads; title & meta in View Source |
| 2 | Sitemap | https://patliputravinfast.in/sitemap.xml | XML list of all public URLs |
| 3 | Sitemap (API mirror) | https://apivnfast.patliputragroup.com/api/v1/sitemap.xml | Same XML (always available from API) |
| 4 | Robots.txt | https://patliputravinfast.in/robots.txt | Allow /; Disallow admin/staff/customer/api; Sitemap line |
| 5 | Robots (API mirror) | https://apivnfast.patliputragroup.com/api/v1/robots.txt | Same content |
| 6 | LLMs / AI discovery | https://patliputravinfast.in/llms.txt | Plain-text site summary for AI crawlers |
| 7 | LLMs (API mirror) | https://apivnfast.patliputragroup.com/api/v1/llms.txt | Same content |
| 8 | OG / social preview image | https://patliputravinfast.in/preview.jpg | Image used for social sharing |

**Expected `robots.txt` content:**

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /staff
Disallow: /customer
Disallow: /api/
Sitemap: https://patliputravinfast.in/sitemap.xml
```

---

## 2. Homepage meta tags (View Source on live site)

Open: https://patliputravinfast.in/ → right-click → **View Page Source**.

| Tag | Expected value |
|-----|----------------|
| **Title** | Patliputra VinFast — Authorized VinFast Dealer in Bihar \| VF 6 & VF 7 Electric SUVs |
| **Meta description** | Explore VinFast electric vehicles with Patliputra VinFast. Book your test drive today. |
| **Meta keywords** | VinFast Bihar, VinFast Patna, VF 7 price Bihar, VF 6 price Patna, electric SUV Bihar, Patliputra VinFast, VinFast dealer Bihar, EV test drive Patna |
| **Canonical** | https://patliputravinfast.in/ |
| **og:title** | Patliputra VinFast - Premium EV Experience |
| **og:description** | Explore VinFast electric vehicles with Patliputra VinFast. Book your test drive today. |
| **og:image** | https://patliputravinfast.in/preview.jpg |
| **og:url** | https://patliputravinfast.in/ |
| **og:type** | website |
| **twitter:card** | summary_large_image |
| **lang** | `en` |

### Structured data on homepage (JSON-LD)

Type: **AutoDealer** (schema.org)

| Field | Value |
|-------|--------|
| name | Patliputra VinFast |
| description | Bihar's authorized VinFast electric vehicle dealer |
| url | https://patliputravinfast.in |
| telephone | +919231445060 |
| address | Plot No. 2421, NH 30, Bypass Road, Paijawa, Patna, Bihar 800009, IN |
| brand | VinFast |
| hours | Monday–Saturday, 10:00–20:00 |

> Canonical, Open Graph, schema `url`, and sitemap all use **patliputravinfast.in**. If `.com` is still reachable, set a 301 redirect to `.in` in DNS/hosting.


---

## 3. Public SEO APIs (JSON — verify in browser)

**Live API host:** `https://apivnfast.patliputragroup.com/api/v1`  
(Public site paths below also work once the frontend host proxies `/api` or you use the API host directly.)

| # | Purpose | Live URL |
|---|---------|----------|
| 1 | Global SEO (default title, description, verification, org schemas) | https://apivnfast.patliputragroup.com/api/v1/public/seo/global |
| 2 | All Bihar districts (38) | https://apivnfast.patliputragroup.com/api/v1/public/seo/districts |
| 3 | SEO model catalog (VF6, VF7, MPV7, Limo Green) | https://apivnfast.patliputragroup.com/api/v1/public/seo/models |
| 4 | All district landing pages (list) — **152 pages live** | https://apivnfast.patliputragroup.com/api/v1/public/seo/district-pages |
| 5 | Single district page example (Patna VF6) | https://apivnfast.patliputragroup.com/api/v1/public/seo/district-pages/patna/vinfast-vf6 |
| 6 | Single district page example (Gaya VF7) | https://apivnfast.patliputragroup.com/api/v1/public/seo/district-pages/gaya/vinfast-vf7 |
| 7 | Single district page example (Muzaffarpur MPV7) | https://apivnfast.patliputragroup.com/api/v1/public/seo/district-pages/muzaffarpur/vinfast-mpv7 |
| 8 | Single district page example (Bhagalpur Limo Green) | https://apivnfast.patliputragroup.com/api/v1/public/seo/district-pages/bhagalpur/vinfast-limo-green |

**Pattern for any district × model:**

```
https://apivnfast.patliputragroup.com/api/v1/public/seo/district-pages/{districtSlug}/{modelSlug}
```

Each district-page API response includes meta title, description, keywords, canonical URL, content blocks, FAQs, and JSON-LD schemas (dealer, vehicle, FAQ, breadcrumbs).

**Live sitemap size (verified):** ~195 URLs (static catalog + 152 district pages).

---

## 4. Static sitemap URLs (open from sitemap or directly)

These paths are registered in the SEO catalog and included in **sitemap.xml**.

### 4.1 Homepage & model pages

| Priority | Live URL |
|----------|----------|
| 1.0 | https://patliputravinfast.in/ |
| 0.9 | https://patliputravinfast.in/vinfast-vf6 |
| 0.9 | https://patliputravinfast.in/vinfast-vf7 |
| 0.9 | https://patliputravinfast.in/vinfast-mpv7 |
| 0.9 | https://patliputravinfast.in/vinfast-limo-green |
| 0.9 | https://patliputravinfast.in/models/vf6 |
| 0.9 | https://patliputravinfast.in/models/vf7 |
| 0.9 | https://patliputravinfast.in/models/mpv7 |
| 0.9 | https://patliputravinfast.in/models/limo-green |

### 4.2 Compare pages

| Priority | Live URL |
|----------|----------|
| 0.8 | https://patliputravinfast.in/compare-models |
| 0.7 | https://patliputravinfast.in/compare |
| 0.7 | https://patliputravinfast.in/compare/vinfast-vf6-vs-tata-curvv-ev |
| 0.7 | https://patliputravinfast.in/compare/vinfast-vf6-vs-mahindra-be-6 |
| 0.7 | https://patliputravinfast.in/compare/vinfast-vf6-vs-mg-zs-ev |
| 0.7 | https://patliputravinfast.in/compare/vinfast-vf7-vs-byd-atto-3 |
| 0.7 | https://patliputravinfast.in/compare/vinfast-vf7-vs-hyundai-creta-electric |
| 0.7 | https://patliputravinfast.in/compare/vinfast-vf7-vs-mahindra-xev-9e |

### 4.3 Tools & conversion pages

| Priority | Live URL |
|----------|----------|
| 0.8 | https://patliputravinfast.in/emi-calculator |
| 0.7 | https://patliputravinfast.in/charging-calculator |
| 0.7 | https://patliputravinfast.in/running-cost-calculator |
| 0.7 | https://patliputravinfast.in/ev-buying-guide |
| 0.9 | https://patliputravinfast.in/test-drive |
| 0.8 | https://patliputravinfast.in/book-now |

### 4.4 Content & trust pages

| Priority | Live URL |
|----------|----------|
| 0.7 | https://patliputravinfast.in/charging-infrastructure |
| 0.6 | https://patliputravinfast.in/ownership-experience |
| 0.6 | https://patliputravinfast.in/customer-stories |
| 0.7 | https://patliputravinfast.in/faq |
| 0.8 | https://patliputravinfast.in/bihar |
| 0.6 | https://patliputravinfast.in/about |
| 0.8 | https://patliputravinfast.in/contact |

### 4.5 Blog index & posts

| Priority | Live URL |
|----------|----------|
| 0.7 | https://patliputravinfast.in/blogs |
| 0.6 | https://patliputravinfast.in/blogs/why-electric-vehicles-are-the-future-of-bihar |
| 0.6 | https://patliputravinfast.in/blogs/how-to-choose-the-right-electric-suv |
| 0.6 | https://patliputravinfast.in/blogs/charging-infrastructure-in-bihar |
| 0.6 | https://patliputravinfast.in/blogs/cost-of-owning-an-ev |
| 0.6 | https://patliputravinfast.in/blogs/top-10-reasons-to-buy-the-vf6 |
| 0.6 | https://patliputravinfast.in/blogs/is-the-vf6-worth-buying |
| 0.6 | https://patliputravinfast.in/blogs/vf6-running-cost-analysis |
| 0.6 | https://patliputravinfast.in/blogs/why-the-vf7-stands-out |
| 0.6 | https://patliputravinfast.in/blogs/adas-explained |
| 0.6 | https://patliputravinfast.in/blogs/best-electric-mpv-in-india |
| 0.6 | https://patliputravinfast.in/blogs/family-road-trips-with-mpv7 |
| 0.6 | https://patliputravinfast.in/blogs/corporate-fleet-benefits-electric-mpv |

---

## 5. Hyperlocal district SEO pages (152 pages)

**Architecture:** 38 Bihar districts × 4 models = **152 landing pages**  
**URL pattern:**

```
https://patliputravinfast.in/{districtSlug}/{modelSlug}
```

**Model slugs:**

| Model | Slug | Example |
|-------|------|---------|
| VinFast VF6 | `vinfast-vf6` | https://patliputravinfast.in/patna/vinfast-vf6 |
| VinFast VF7 | `vinfast-vf7` | https://patliputravinfast.in/patna/vinfast-vf7 |
| VinFast VF MPV7 | `vinfast-mpv7` | https://patliputravinfast.in/patna/vinfast-mpv7 |
| VinFast Limo Green | `vinfast-limo-green` | https://patliputravinfast.in/patna/vinfast-limo-green |

**Meta title pattern:**  
`{Model} Price in {District} – From {price} | Patliputra VinFast`  
(or booking/test-drive variant when price is not emphasized)

### 5.1 All district base paths (append `/{modelSlug}`)

| District | Slug | Base URL |
|----------|------|----------|
| Araria | araria | https://patliputravinfast.in/araria |
| Arwal | arwal | https://patliputravinfast.in/arwal |
| Aurangabad | aurangabad | https://patliputravinfast.in/aurangabad |
| Banka | banka | https://patliputravinfast.in/banka |
| Begusarai | begusarai | https://patliputravinfast.in/begusarai |
| Bhagalpur | bhagalpur | https://patliputravinfast.in/bhagalpur |
| Bhojpur | bhojpur | https://patliputravinfast.in/bhojpur |
| Buxar | buxar | https://patliputravinfast.in/buxar |
| Darbhanga | darbhanga | https://patliputravinfast.in/darbhanga |
| East Champaran | east-champaran | https://patliputravinfast.in/east-champaran |
| Gaya | gaya | https://patliputravinfast.in/gaya |
| Gopalganj | gopalganj | https://patliputravinfast.in/gopalganj |
| Jamui | jamui | https://patliputravinfast.in/jamui |
| Jehanabad | jehanabad | https://patliputravinfast.in/jehanabad |
| Kaimur | kaimur | https://patliputravinfast.in/kaimur |
| Katihar | katihar | https://patliputravinfast.in/katihar |
| Khagaria | khagaria | https://patliputravinfast.in/khagaria |
| Kishanganj | kishanganj | https://patliputravinfast.in/kishanganj |
| Lakhisarai | lakhisarai | https://patliputravinfast.in/lakhisarai |
| Madhepura | madhepura | https://patliputravinfast.in/madhepura |
| Madhubani | madhubani | https://patliputravinfast.in/madhubani |
| Munger | munger | https://patliputravinfast.in/munger |
| Muzaffarpur | muzaffarpur | https://patliputravinfast.in/muzaffarpur |
| Nalanda | nalanda | https://patliputravinfast.in/nalanda |
| Nawada | nawada | https://patliputravinfast.in/nawada |
| Patna | patna | https://patliputravinfast.in/patna |
| Purnia | purnia | https://patliputravinfast.in/purnia |
| Rohtas | rohtas | https://patliputravinfast.in/rohtas |
| Saharsa | saharsa | https://patliputravinfast.in/saharsa |
| Samastipur | samastipur | https://patliputravinfast.in/samastipur |
| Saran | saran | https://patliputravinfast.in/saran |
| Sheikhpura | sheikhpura | https://patliputravinfast.in/sheikhpura |
| Sheohar | sheohar | https://patliputravinfast.in/sheohar |
| Sitamarhi | sitamarhi | https://patliputravinfast.in/sitamarhi |
| Siwan | siwan | https://patliputravinfast.in/siwan |
| Supaul | supaul | https://patliputravinfast.in/supaul |
| Vaishali | vaishali | https://patliputravinfast.in/vaishali |
| West Champaran | west-champaran | https://patliputravinfast.in/west-champaran |

### 5.2 Spot-check links (recommended for client demo)

| Check | Live URL |
|-------|----------|
| Patna × VF6 | https://patliputravinfast.in/patna/vinfast-vf6 |
| Patna × VF7 | https://patliputravinfast.in/patna/vinfast-vf7 |
| Patna × MPV7 | https://patliputravinfast.in/patna/vinfast-mpv7 |
| Patna × Limo Green | https://patliputravinfast.in/patna/vinfast-limo-green |
| Gaya × VF6 | https://patliputravinfast.in/gaya/vinfast-vf6 |
| Gaya × VF7 | https://patliputravinfast.in/gaya/vinfast-vf7 |
| Muzaffarpur × VF7 | https://patliputravinfast.in/muzaffarpur/vinfast-vf7 |
| Bhagalpur × Limo Green | https://patliputravinfast.in/bhagalpur/vinfast-limo-green |
| Nalanda × VF6 | https://patliputravinfast.in/nalanda/vinfast-vf6 |
| Darbhanga × MPV7 | https://patliputravinfast.in/darbhanga/vinfast-mpv7 |

**Full set:** every district slug above × each of the 4 model slugs (152 total). All active district pages are also listed inside https://patliputravinfast.in/sitemap.xml.

### 5.3 Schemas on district pages

Each district page is generated with:

| Schema type | Purpose |
|-------------|---------|
| AutomotiveBusiness | Local dealer identity |
| Car (+ Offer when price is available) | Vehicle + pricing |
| FAQPage | Local FAQs |
| BreadcrumbList | Home → District → Model path |

---

## 6. Keyword strategy

### 6.1 Model primary keywords

**VinFast VF6**
- VinFast VF6  
- VinFast VF6 Price Bihar  
- Buy VinFast VF6  
- VinFast VF6 Booking  
- VinFast VF6 Test Drive  
- VinFast VF6 Review  
- VinFast VF6 Range  
- VinFast VF6 Specifications  
- VinFast VF6 Features  
- VinFast VF6 On Road Price  

**VinFast VF7**
- VinFast VF7  
- VinFast VF7 Price  
- VinFast VF7 Bihar  
- VinFast VF7 Booking  
- VinFast VF7 Test Drive  
- VinFast VF7 Review  
- VinFast VF7 Range  
- VinFast VF7 ADAS  
- VinFast VF7 Interior  
- VinFast VF7 On Road Price  

**VinFast VF MPV7**
- VinFast MPV7  
- VinFast MPV7 Price  
- VinFast MPV7 Booking  
- VinFast MPV7 Review  
- VinFast MPV7 Features  
- VinFast MPV7 Range  
- 7 Seater Electric Car  
- VinFast VF MPV7 Bihar  

**VinFast Limo Green**
- VinFast Limo Green  
- VinFast Limo Green Price  
- VinFast Limo Green Bihar  
- VinFast Limo Green Booking  
- VinFast Limo Green Review  
- VinFast Limo Green Range  
- Limo Green 7 Seater EV  
- VinFast Limo Green Test Drive  

### 6.2 Intent / category keywords (examples)

- Best Electric SUV under 20 lakh  
- Premium Electric SUV Bihar  
- ADAS Electric SUV  
- Best Electric MPV  
- Electric Car for Large Family  
- Electric MPV for taxi fleet  
- Fleet Electric MPV Bihar  

### 6.3 District keyword templates

Applied with each district name substituted:

- VinFast Dealer {district}  
- VinFast Showroom {district}  
- Electric SUV {district}  
- Premium EV {district}  
- Electric Car Showroom {district}  
- EV Showroom {district}  
- Electric SUV Test Drive {district}  
- Buy Electric SUV {district}  
- Electric Car Price {district}  

**Example (Patna):** VinFast Dealer Patna, VinFast Showroom Patna, Electric SUV Patna, …

---

## 7. Live SPA routes currently wired in the frontend

These routes exist in the React app and share the homepage shell meta today:

| Live URL |
|----------|
| https://patliputravinfast.in/ |
| https://patliputravinfast.in/models/vf6 |
| https://patliputravinfast.in/models/vf7 |
| https://patliputravinfast.in/models/mpv7 |
| https://patliputravinfast.in/models/limo-green |
| https://patliputravinfast.in/book-now |
| https://patliputravinfast.in/test-drive |
| https://patliputravinfast.in/emi-calculator |
| https://patliputravinfast.in/compare |
| https://patliputravinfast.in/about |
| https://patliputravinfast.in/contact |
| https://patliputravinfast.in/privacy-policy |
| https://patliputravinfast.in/terms-of-service |
| https://patliputravinfast.in/terms-and-conditions |
| https://patliputravinfast.in/payment-refund-policy |

---

## 8. What is blocked from indexing (robots)

These paths are **disallowed** for crawlers in the backend robots.txt:

| Path | Reason |
|------|--------|
| `/admin` | Internal admin panel |
| `/staff` | Staff portal |
| `/customer` | Customer portal |
| `/api/` | API endpoints |

---

## 9. Domain & configuration summary

| Setting | Value |
|---------|--------|
| Canonical site URL (`SITE_URL`) | https://patliputravinfast.in |
| CORS / client origins | https://patliputravinfast.in , https://www.patliputravinfast.in |
| SEO auto-bootstrap | 38 districts × 4 models = 152 pages created on server startup when enabled |
| Alternate domain | Redirect `.com` → `.in` recommended if both resolve |

**Client action recommended:** Keep **patliputravinfast.in** as the Search Console property; 301-redirect `.com` if it still serves content.

---

## 10. Verification checklist for the client

Use this as a sign-off sheet.

| # | Check | Pass? |
|---|--------|-------|
| 1 | https://patliputravinfast.in/sitemap.xml opens and lists URLs | ☐ |
| 2 | https://patliputravinfast.in/robots.txt shows Sitemap + Disallow rules | ☐ |
| 3 | Homepage title/description match Section 2 | ☐ |
| 4 | Homepage View Source shows AutoDealer JSON-LD | ☐ |
| 5 | https://patliputravinfast.in/api/v1/public/seo/global returns JSON | ☐ |
| 6 | https://patliputravinfast.in/api/v1/public/seo/districts returns 38 districts | ☐ |
| 7 | https://patliputravinfast.in/api/v1/public/seo/models returns 4 models | ☐ |
| 8 | District API example (Patna VF6) returns meta + schemas | ☐ |
| 9 | Spot-check 5+ district page URLs from Section 5.2 | ☐ |
| 10 | OG image https://patliputravinfast.in/preview.jpg loads | ☐ |
| 11 | Test drive & book-now pages load | ☐ |
| 12 | Model pages `/models/vf6` and `/models/vf7` load | ☐ |
| 13 | Primary domain chosen (.in or .com) and documented | ☐ |
| 14 | Google Search Console property matches primary domain | ☐ |
| 15 | Sitemap submitted in Google Search Console | ☐ |

---

## 11. Important notes for live verification

1. **Backend SEO is live today** — sitemap (~195 URLs), robots, `llms.txt`, global SEO API, and **152 district page** documents with titles, descriptions, keywords, FAQs, and JSON-LD (verified on the API host).
2. **Frontend now includes matching routes** for catalog URLs: model aliases, blogs, compare SEO pages, guides, FAQ, Bihar hub, charging/running-cost calculators, and `/{district}/{model}` landings that load content from the SEO API with unique meta tags.
3. **Redeploy the frontend** for `patliputravinfast.in` so clients see working district/blog pages and updated `robots.txt` / sitemap rewrite. Until then, verify APIs on `apivnfast.patliputragroup.com`.
4. For ranking, Google needs: one primary domain (`.in`), working sitemap, unique meta per URL, crawlable content, and Search Console monitoring.
5. SPA caveat: initial HTML shell still has homepage meta; React updates `document.title` and meta tags on navigation. For strongest crawler support later, consider prerender/SSR — not required for client link verification of routes.

---

## 12. Contact / technical source (internal)

| Module | Project path |
|--------|----------------|
| SEO catalog & static routes | `src/constants/seoCatalog.js` |
| Bihar districts | `src/constants/biharDistricts.js` |
| District content & meta | `src/utils/seoContent.js` |
| JSON-LD schemas | `src/utils/seoSchema.js` |
| Sitemap & robots builders | `src/utils/sitemap.js` |
| Public SEO controller | `src/controllers/seoController.js` |
| Frontend shell meta | `career-section-nanak/index.html` |
| Frontend SEO hook | `career-section-nanak/src/hooks/usePageSeo.ts` |
| District landing UI | `career-section-nanak/src/pages/seo/DistrictLandingPage.tsx` |
| Marketing / blog SEO pages | `career-section-nanak/src/pages/seo/seoPageContent.ts` |
| Host sitemap rewrite | `career-section-nanak/vercel.json` + `public/.htaccess` |

---

*End of SEO documentation — prepared for Patliputra VinFast client review and live-site verification.*
