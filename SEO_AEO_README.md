# Patliputra VinFast — SEO & AEO README

**Site:** https://patliputravinfast.in  
**Dealership:** Patliputra VinFast, Plot No. 2421, NH 30 Bypass Road, Paijawa, Patna, Bihar 800009  
**Hours:** Monday–Saturday, 10:00–20:00  
**Document date:** 30 August 2026  
**Scope:** Bihar only (38 districts). One physical showroom: **Patna**.

This file is the full picture of **what is implemented in the codebase today**, **how SEO and AEO work in this project**, and **what is still required after deploy**.

A shorter client verification list also lives in [`SEO_DOCUMENTATION.md`](SEO_DOCUMENTATION.md).

---

## 1. What SEO and AEO mean here

### SEO (Search Engine Optimization)

Helping **Google and Bing** find, understand, and rank public pages for Bihar buyers searching things like:

- VinFast dealer Bihar  
- VF 6 price Bihar  
- VinFast test drive Patna / Gaya  
- EV charging Bihar  
- EV running cost Bihar  

SEO in this project is: unique titles, unique on-page copy, clean URLs, sitemap, robots, canonicals, and accurate structured data.

### AEO (Answer Engine Optimization)

Helping **Google AI Overviews, ChatGPT, Gemini, Perplexity and similar tools** extract a **short, factual answer** they can cite.

AEO in this project is **not** a special Google ranking trick. It is:

- A **40–80 word answer** directly under the H1  
- Consistent entity names (company, models, Patna showroom, district)  
- Visible FAQs in Hindi/English where natural  
- “Last updated” + “About this information” on prices, EMI and cost calculators  
- One source of truth for price/range (admin SiteConfig / model master)  
- No fake district showrooms and no invented customer stories  

Google (June 2026) does **not** require `llms.txt` for Search. We keep `llms.txt` as optional documentation only. It is **not** a ranking KPI.

Google retired **FAQ rich results** in 2026. Visible FAQs stay for users and answer engines. We do **not** promise FAQ stars in Google.

---

## 2. Current scenario (before vs after this work)

| Topic | Previous scenario | Current scenario (in code) |
|--------|-------------------|----------------------------|
| District strategy | Auto-generated **152** pages (38 districts × 4 models). Many near-duplicate. | **38 district hubs** + **24** VF 6 / VF 7 pages in 12 high-demand districts only |
| Showroom language | Easy to read as “VinFast in every district” | **Patna is the only physical facility.** Other districts = assistance from Patna |
| Titles | Mixed / older homepage title | Blueprint titles on home, VF 6, VF 7, hubs, A- pages, EMI, charging |
| Meta keywords | Written into the HTML head | **Removed** (obsolete for Google) |
| Blogs | Thin generic posts | **12 Bihar utility articles** with author, dates, answer block, CTA |
| Calculators | Numbers only | Estimate + **methodology note** (EMI ≠ sanctioned loan) |
| Leads | Source = “Website” | District, model, intent and page passed on CTAs and stored on the lead |
| Sitemap | ~195 URLs including mass district×model pages | Static pages + 38 hubs + 24 A- pages + new blogs |
| Schema | AutoDealer sometimes scoped like a local branch; FAQPage as a feature | Organization + **Patna-only AutoDealer** + Product/Offer + Breadcrumbs + Article |
| Old URLs | All 152 indexable | Unused `/{district}/{model}` **301** to the district hub |

**Important:** this is implemented in the **repository**. The live `.in` site shows it only after **frontend + API deploy**, and after the API bootstrap has created hub documents in MongoDB.

---

## 3. What we implemented (detailed)

### 3.1 Titles, descriptions, robots (P0)

Exact public titles:

| Page | Title now in the app |
|------|----------------------|
| Home | VinFast Cars in Bihar \| VF 6, VF 7, MPV 7 & Limo Green \| Patliputra VinFast |
| VF 6 | VinFast VF 6 Price, Range & Test Drive in Bihar \| Patliputra VinFast |
| VF 7 | VinFast VF 7 Price, Range & Test Drive in Bihar \| Patliputra VinFast |
| District hub | VinFast Electric Cars in {District} \| Price & Test Drive Assistance |
| VF 6 A- | VinFast VF 6 in {District} \| Price, Range & Test Drive |
| VF 7 A- | VinFast VF 7 in {District} \| Price, Range & Test Drive |
| Charging guide | EV Charging in Bihar \| Home & Fast Charging Guide \| Patliputra VinFast |
| EMI | VinFast EMI Calculator \| Estimate EV Finance in Bihar |

Also done:

- Unique meta descriptions (not keyword lists)  
- Canonical + Open Graph + Twitter `summary_large_image`  
- `og:title` matches the page title  
- `<meta name="keywords">` stripped from the SPA head helper  
- Approved pages: `index, follow`  
- Admin / staff / customer / API: disallowed in `robots.txt`

**Files:** `career-section-nanak/index.html`, `src/lib/seo.ts`, `src/hooks/usePageSeo.ts`, homepage and model/calculator pages.

### 3.2 Masters: location, serviceability, models (P0)

| Master | Rule |
|--------|------|
| Location | One Patna AutoDealer. Address, phone, hours never cloned onto another district as a branch. |
| Serviceability | All 38 districts = sales / test-drive **assistance** from Patna. |
| A- allowlist | 12 districts may have VF 6 + VF 7 landing pages. |
| Model / price / range | `SEO_MODELS` + SiteConfig fields (`vf6Price`, `vf6Range`, …). Copy must not invent a price. |

**A- districts (24 pages = 12 × VF 6 + VF 7):**

Patna, Gaya, Muzaffarpur, Bhagalpur, Darbhanga, Nalanda, Purnia, Begusarai, Rohtas, Saran, Vaishali, East Champaran.

**Files:** `src/constants/seoLocation.js`, `src/constants/biharDistricts.js`, `src/constants/seoCatalog.js`.

### 3.3 Structured data (P0)

Injected as JSON-LD:

- **Organization** — company name, URL, logo, Bihar as area served  
- **AutoDealer / AutomotiveBusiness** — **Patna address only**  
- **WebSite**  
- **Product** on model-district pages, **Offer** only when a live SiteConfig price exists  
- **BreadcrumbList** on hubs, A- pages, hierarchy  
- **Article** on knowledge pages (author, `datePublished`, `dateModified`)  

Not used as KPIs:

- FAQPage rich results  
- Deprecated Google vehicle-listing rich results  
- `llms.txt` for Google ranking  

**File:** `src/utils/seoSchema.js`.

### 3.4 38 district hubs (P1)

**URL:** `https://patliputravinfast.in/{districtSlug}`  
**Example:** https://patliputravinfast.in/gaya  
**H1:** `VinFast Electric Cars in {District} - Price, Test Drive & Offers`

Each hub includes:

1. 40–80 word AEO answer under the H1  
2. Factual assistance language + nearest **Patna** facility  
3. Live model table (price / range from SiteConfig when present)  
4. CTAs: Test drive, Get price, EMI, Exchange (with tracking query params)  
5. One local use-case (HQ / corridor, e.g. Patna–Gaya, Hajipur–Patna)  
6. FAQs (including a natural Hindi/English test-drive question)  
7. Last updated + methodology note  

**Index of all hubs:** https://patliputravinfast.in/bihar  

**Files:** `src/utils/seoContent.js`, `src/utils/seoBootstrap.js`, `src/models/DistrictPage.js`, `career-section-nanak/src/pages/seo/DistrictHubPage.tsx`.

### 3.5 24 A- model pages + 301 leftovers (P1)

**Keep indexed:**

`/{district}/vinfast-vf6` and `/{district}/vinfast-vf7` for the 12 A- districts only.

**Example:** https://patliputravinfast.in/gaya/vinfast-vf6  

**301 to the district hub:**

- All `/…/vinfast-mpv7` and `/…/vinfast-limo-green`  
- VF 6 / VF 7 URLs **outside** the 12 A- districts  

Redirects are in:

- `career-section-nanak/vercel.json`  
- `career-section-nanak/public/.htaccess`  
- React fallback: missing/non-A page → navigate to `/{district}`  

Bootstrap **deactivates** leftover Mongo documents so they drop out of the sitemap.

### 3.6 Knowledge hub (P1)

New articles (author: Patliputra VinFast editorial team; reviewer: Sales desk, Patna; dated 2026-08-30):

| URL | Intent |
|-----|--------|
| `/blogs/vf6-vs-vf7-bihar` | VF 6 vs VF 7 for city / highway |
| `/blogs/ev-running-cost-bihar` | What 100 km costs |
| `/blogs/home-ev-charging-bihar` | Home charging |
| `/blogs/patna-to-gaya-ev-trip` | Patna–Gaya EV trip |
| `/blogs/patna-to-darbhanga-ev-trip` | Patna–Darbhanga EV trip |
| `/blogs/vf6-ownership-guide-bihar` | VF 6 ownership |
| `/blogs/vf7-highway-guide-bihar` | VF 7 highway users |
| `/blogs/electric-suv-buying-checklist-bihar` | Family buying checklist |
| `/blogs/prepare-home-ev-charger-bihar` | Home charger prep |
| `/blogs/bihar-owner-stories` | Real stories only — no invented reviews |
| `/blogs/ev-monsoon-bihar` | Monsoon driving / charging |
| `/blogs/7-seater-ev-bihar` | MPV 7 & Limo Green |

Also upgraded (same template: answer, dates, CTA):

- `/compare-models`, `/ev-buying-guide`, `/charging-infrastructure`  
- `/ownership-experience`, `/customer-stories`, `/faq`, `/blogs`, `/bihar`  

**Old thin blogs 301** to the closest new article (e.g. `/blogs/cost-of-owning-an-ev` → `/blogs/ev-running-cost-bihar`).

Competitor compare URLs stay as **light pages** with a “verify competitor data / last updated” disclaimer. The live compare tool remains at `/compare`.

EMI, charging-cost and running-cost calculators include an **About this information** note.

**Files:** `career-section-nanak/src/pages/seo/seoPageContent.ts`, `SeoMarketingPage.tsx`.

### 3.7 CRM / conversion attribution (P0)

CTAs from hubs and A- pages look like:

```
/test-drive?district=gaya&model=vinfast-vf6&intent=test-drive&page=/gaya
```

| Param | Meaning |
|-------|---------|
| `district` | Bihar district slug or name |
| `model` | `vinfast-vf6`, `vf7`, etc. |
| `intent` | `test-drive`, `get-price`, `emi`, `exchange`, `book-now` |
| `page` | Path the user started from |

Test Drive and Book Now **pre-fill** district and model. Values are appended to lead `remarks` and `pageSource` so CRM can see district-wise organic interest.

Sticky mobile Call / WhatsApp / Book / Test Drive inherit district/model from the current path when it is a hub or A- page.

**Files:** `career-section-nanak/src/lib/seoAttribution.ts`, `TestDrive.tsx`, `BookNow.tsx`, `StickyMobileCTA.tsx`.

---

## 4. Public URL map (current architecture)

```
Homepage /
    ├── Models
    │     /models/vf6  /models/vf7  /models/mpv7  /models/limo-green
    │     aliases: /vinfast-vf6 … /vinfast-limo-green
    ├── Tools
    │     /test-drive  /book-now  /emi-calculator
    │     /charging-calculator  /running-cost-calculator  /compare
    ├── Guides
    │     /ev-buying-guide  /charging-infrastructure  /ownership-experience
    │     /faq  /blogs  + 12 /blogs/… articles
    ├── Trust
    │     /about  /contact  /customer-stories
    └── Bihar
          /bihar
          /{district}                    ← 38 hubs
          /{district}/vinfast-vf6|vf7    ← 24 A- pages only
```

**38 hub slugs:**  
araria, arwal, aurangabad, banka, begusarai, bhagalpur, bhojpur, buxar, darbhanga, east-champaran, gaya, gopalganj, jamui, jehanabad, kaimur, katihar, khagaria, kishanganj, lakhisarai, madhepura, madhubani, munger, muzaffarpur, nalanda, nawada, patna, purnia, rohtas, saharsa, samastipur, saran, sheikhpura, sheohar, sitamarhi, siwan, supaul, vaishali, west-champaran.

---

## 5. Discovery files and APIs

| Asset | URL |
|-------|-----|
| Sitemap | https://patliputravinfast.in/sitemap.xml |
| Robots | https://patliputravinfast.in/robots.txt |
| Optional llms.txt | https://patliputravinfast.in/llms.txt |
| API mirror | https://apivnfast.patliputragroup.com/api/v1/sitemap.xml |

**Public SEO JSON (after API deploy / bootstrap):**

| Purpose | Path |
|---------|------|
| Global meta + org schemas | `/api/v1/public/seo/global` |
| 38 districts (+ `aTier`) | `/api/v1/public/seo/districts` |
| Model catalog | `/api/v1/public/seo/models` |
| Active hubs + A- list | `/api/v1/public/seo/district-pages` |
| One hub | `/api/v1/public/seo/district-pages/gaya` |
| One A- page | `/api/v1/public/seo/district-pages/gaya/vinfast-vf6` |

Sitemap contents: static catalog routes + **active** DistrictPage rows only (hubs + 24 A-), not leftover mass pages.

---

## 6. How the system is wired (for developers)

| Layer | Path |
|-------|------|
| Location master | `src/constants/seoLocation.js` |
| Districts + A- flag | `src/constants/biharDistricts.js` |
| Model master + sitemap static routes | `src/constants/seoCatalog.js` |
| Hub / A- copy + FAQs | `src/utils/seoContent.js` |
| JSON-LD builders | `src/utils/seoSchema.js` |
| Create hubs, A- pages; deactivate leftovers | `src/utils/seoBootstrap.js` |
| Sitemap / robots | `src/utils/sitemap.js` |
| Public SEO controller | `src/controllers/seoController.js` |
| SPA titles / OG / JSON-LD | `career-section-nanak/src/lib/seo.ts` |
| District hub UI | `career-section-nanak/src/pages/seo/DistrictHubPage.tsx` |
| A- landing UI | `career-section-nanak/src/pages/seo/DistrictLandingPage.tsx` |
| Articles | `career-section-nanak/src/pages/seo/seoPageContent.ts` |
| Attribution helper | `career-section-nanak/src/lib/seoAttribution.ts` |
| Host 301s | `career-section-nanak/vercel.json`, `public/.htaccess` |

On API startup, `ensureSeoReady()` upserts 38 hubs + 24 A- pages and sets leftover DistrictPage rows to `active: false`.

---

## 7. Current AEO quality (honest)

**In place**

- Direct answers under H1 on hubs, A- pages and knowledge articles  
- Same entity names everywhere (Patliputra VinFast, VinFast VF 6 / VF 7, Patna showroom)  
- Dynamic price/range when SiteConfig is filled  
- Methodology on EMI and cost tools  
- Hindi + English FAQ on district pages  
- Crawlable public HTML routes (SPA still updates meta in the browser)

**Not claimed / not built as magic**

- We cannot guarantee AI citations or Google AI Overview placement  
- Owner-stories page is a **placeholder for consented real stories** — no fake reviews  
- No original video transcripts / VideoObject unless video is actually embedded  
- `llms.txt` does not improve Google ranking  
- This is a **React SPA**: the first HTML download still has homepage meta; React then sets the correct title/description. Google generally executes JS, but prerender/SSR would be stronger later if needed  

---

## 8. Current SEO quality (honest)

**Strong now (in code)**

- Unique titles and URLs for Bihar + 38 districts  
- No doorway farm of 152 near-identical pages  
- Self-canonicals, OG, robots, sitemap architecture  
- Honest local business markup (one address)  
- Internal links: hubs ↔ models ↔ test drive ↔ blogs  

**Depends on ops, not code**

- Deploy frontend + API  
- Mongo bootstrap has run (hubs exist in DB)  
- Google Search Console property is **patliputravinfast.in**  
- Sitemap submitted  
- If `.com` still resolves, 301 it to `.in` (hosting/DNS)  
- Keep SiteConfig prices/ranges current so copy and Offer schema stay true  

---

## 9. What to do after this commit (go-live)

1. **Deploy the API** so bootstrap creates hubs / A- pages and shrinks the sitemap.  
2. **Deploy the frontend** (`career-section-nanak`) to patliputravinfast.in.  
3. Spot-check:  
   - https://patliputravinfast.in/  
   - https://patliputravinfast.in/gaya  
   - https://patliputravinfast.in/patna/vinfast-vf6  
   - https://patliputravinfast.in/blogs/vf6-vs-vf7-bihar  
   - https://patliputravinfast.in/sitemap.xml  
   - https://patliputravinfast.in/robots.txt  
4. Confirm a leftover URL redirects, e.g. `/gaya/vinfast-mpv7` → `/gaya`.  
5. Submit sitemap in Search Console.  
6. After 2–4 weeks, review queries by district / page type — not vanity rankings only. Measure **leads → test drives → bookings**.

---

## 10. Out of scope (by design)

- No 38 × 4 auto pages  
- No fake district AutoDealer addresses  
- No hreflang / machine-translated doorway pages  
- No FAQ-rich-result KPI  
- No `llms.txt` as a Google SEO task  
- No invented customer testimonials  
- GSC property and `.com` → `.in` DNS/hosting are **not** app-code tasks  

---

## 11. Quick client one-liner

> We replaced 152 thin district×model pages with **38 real district hubs**, **24 VF 6/VF 7 pages in high-demand districts**, **Bihar-specific guides**, **honest Patna-only showroom data**, and **lead tracking by district**. The site is set up for both classic Google SEO and answer/AI engines, without fake local stores or keyword stuffing.

---

*Maintained with the Patliputra VinFast codebase. Update this README when A- districts, titles, or article slugs change.*
