# Patliputra VinFast — SEO / AEO Documentation

**Primary domain:** [https://patliputravinfast.in](https://patliputravinfast.in)  
**Blueprint:** Bihar SEO + AEO + AI Search Master Developer Blueprint (2026)  
**Last implementation update:** 30 August 2026

This document matches the live URL architecture after the 2026 blueprint: **38 district hubs**, **24 selective VF 6 / VF 7 A- pages**, knowledge-hub articles, and **no mass 152-page indexation**.

---

## Implementation status

| Area | Status | Notes |
|------|--------|--------|
| Title templates (home, VF 6, VF 7, hubs, A-, charging, EMI) | Implemented | Exact blueprint strings |
| Meta keywords | Removed | Obsolete for Google; not written to `<head>` |
| Location master | Implemented | One Patna AutoDealer only |
| 38 district hubs `/{district}` | Implemented | Assistance language; nearest facility = Patna |
| VF 6 / VF 7 A- pages (12 districts) | Implemented | 24 indexable model-district URLs |
| Leftover `/{district}/{model}` URLs | 301 → hub | MPV7, Limo Green, and non-A VF 6/7 |
| Knowledge hub (12 articles) | Implemented | Author, dates, Article JSON-LD |
| CRM attribution | Implemented | `district`, `model`, `intent`, `page` on CTAs/forms |
| FAQ rich results | Not a KPI | Visible FAQs only; Google retired FAQ rich results (2026) |
| `llms.txt` | Optional | Not a Google ranking mechanism |

---

## 1. Core discovery URLs

| Asset | URL |
|-------|-----|
| Homepage | https://patliputravinfast.in/ |
| Sitemap | https://patliputravinfast.in/sitemap.xml |
| Robots | https://patliputravinfast.in/robots.txt |
| LLMs (optional) | https://patliputravinfast.in/llms.txt |

**`robots.txt`**

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

## 2. Homepage meta

| Tag | Value |
|-----|--------|
| Title | VinFast Cars in Bihar \| VF 6, VF 7, MPV 7 & Limo Green \| Patliputra VinFast |
| Description | Authorised VinFast dealer in Bihar. Explore VF 6, VF 7, MPV 7 and Limo Green — price, range, EMI and test drive assistance from Patliputra VinFast, Patna. |
| Canonical | https://patliputravinfast.in/ |
| og:title | Same as title |
| Schema | Organization + AutoDealer (Patna) + WebSite |

---

## 3. Title templates

| Page | Title |
|------|--------|
| VF 6 | VinFast VF 6 Price, Range & Test Drive in Bihar \| Patliputra VinFast |
| VF 7 | VinFast VF 7 Price, Range & Test Drive in Bihar \| Patliputra VinFast |
| District hub | VinFast Electric Cars in {District} \| Price & Test Drive Assistance |
| VF 6 A- | VinFast VF 6 in {District} \| Price, Range & Test Drive |
| VF 7 A- | VinFast VF 7 in {District} \| Price, Range & Test Drive |
| Charging guide | EV Charging in Bihar \| Home & Fast Charging Guide \| Patliputra VinFast |
| EMI | VinFast EMI Calculator \| Estimate EV Finance in Bihar |

---

## 4. District hubs (38)

Pattern: `https://patliputravinfast.in/{districtSlug}`  
H1: `VinFast Electric Cars in {District} - Price, Test Drive & Offers`

All 38 official Bihar districts. Physical showroom is **Patna only**. Other districts receive sales / test-drive **assistance**.

---

## 5. A- model pages (24)

**Districts:** Patna, Gaya, Muzaffarpur, Bhagalpur, Darbhanga, Nalanda, Purnia, Begusarai, Rohtas, Saran, Vaishali, East Champaran.

**Models:** `vinfast-vf6`, `vinfast-vf7` only.

Example: https://patliputravinfast.in/gaya/vinfast-vf6

Unused combinations **301** to the district hub (e.g. `/gaya/vinfast-mpv7` → `/gaya`).

---

## 6. Knowledge hub

| Path | Intent |
|------|--------|
| /blogs/vf6-vs-vf7-bihar | VF6 vs VF7 |
| /blogs/ev-running-cost-bihar | 100 km cost |
| /blogs/home-ev-charging-bihar | Home charging |
| /blogs/patna-to-gaya-ev-trip | Route planning |
| /blogs/patna-to-darbhanga-ev-trip | Route planning |
| /blogs/vf6-ownership-guide-bihar | VF6 ownership |
| /blogs/vf7-highway-guide-bihar | VF7 highway |
| /blogs/electric-suv-buying-checklist-bihar | Family checklist |
| /blogs/prepare-home-ev-charger-bihar | Charger prep |
| /blogs/bihar-owner-stories | First-party stories only |
| /blogs/ev-monsoon-bihar | Monsoon |
| /blogs/7-seater-ev-bihar | MPV / Limo Green |

Old thin blog slugs 301 to the closest new article.

---

## 7. Public SEO APIs

**API host:** `https://apivnfast.patliputragroup.com/api/v1`

| Purpose | Path |
|---------|------|
| Global SEO | `/public/seo/global` |
| 38 districts (+ aTier) | `/public/seo/districts` |
| Models | `/public/seo/models` |
| Active pages list | `/public/seo/district-pages` |
| Hub example | `/public/seo/district-pages/gaya` |
| A- example | `/public/seo/district-pages/gaya/vinfast-vf6` |

Sitemap includes static routes + **38 hubs + 24 A- pages** + knowledge URLs (not ~195 mass pages).

---

## 8. CRM attribution

CTAs use query params: `district`, `model`, `intent`, `page`.  
Example: `/test-drive?district=gaya&model=vinfast-vf6&intent=test-drive&page=/gaya`

Values are stored on lead / test-drive `remarks` and `pageSource`.

---

## 9. Technical source

| Module | Path |
|--------|------|
| Location master | `src/constants/seoLocation.js` |
| Districts + A- allowlist | `src/constants/biharDistricts.js` |
| Model master | `src/constants/seoCatalog.js` |
| Hub / A- copy | `src/utils/seoContent.js` |
| JSON-LD | `src/utils/seoSchema.js` |
| Bootstrap | `src/utils/seoBootstrap.js` |
| Frontend hub | `career-section-nanak/src/pages/seo/DistrictHubPage.tsx` |
| Articles | `career-section-nanak/src/pages/seo/seoPageContent.ts` |

---

*Prepared for Patliputra VinFast — Bihar SEO + AEO blueprint verification.*
