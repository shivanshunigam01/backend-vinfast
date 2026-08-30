export type SeoArticle = {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  answerBlock?: string;
  sections: { heading: string; body: string }[];
  author?: string;
  reviewer?: string;
  datePublished?: string;
  dateModified?: string;
  sources?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

const AUTHOR = "Patliputra VinFast editorial team";
const REVIEWER = "Sales desk, Patna showroom";
const UPDATED = "2026-08-30";
const DEALER = "Patliputra VinFast, Paijawa, NH 30 Bypass, Patna";

export const BLOG_REDIRECTS: { from: string; to: string }[] = [
  { from: "/blogs/why-electric-vehicles-are-the-future-of-bihar", to: "/blogs/electric-suv-buying-checklist-bihar" },
  { from: "/blogs/how-to-choose-the-right-electric-suv", to: "/blogs/electric-suv-buying-checklist-bihar" },
  { from: "/blogs/charging-infrastructure-in-bihar", to: "/blogs/home-ev-charging-bihar" },
  { from: "/blogs/cost-of-owning-an-ev", to: "/blogs/ev-running-cost-bihar" },
  { from: "/blogs/top-10-reasons-to-buy-the-vf6", to: "/blogs/vf6-ownership-guide-bihar" },
  { from: "/blogs/is-the-vf6-worth-buying", to: "/blogs/vf6-vs-vf7-bihar" },
  { from: "/blogs/vf6-running-cost-analysis", to: "/blogs/ev-running-cost-bihar" },
  { from: "/blogs/why-the-vf7-stands-out", to: "/blogs/vf7-highway-guide-bihar" },
  { from: "/blogs/adas-explained", to: "/blogs/vf7-highway-guide-bihar" },
  { from: "/blogs/best-electric-mpv-in-india", to: "/blogs/7-seater-ev-bihar" },
  { from: "/blogs/family-road-trips-with-mpv7", to: "/blogs/7-seater-ev-bihar" },
  { from: "/blogs/corporate-fleet-benefits-electric-mpv", to: "/blogs/7-seater-ev-bihar" },
];

const articleMeta = {
  author: AUTHOR,
  reviewer: REVIEWER,
  datePublished: UPDATED,
  dateModified: UPDATED,
};

export const SEO_ARTICLES: SeoArticle[] = [
  {
    path: "/compare-models",
    title: "Compare VinFast EV Models | VF6, VF7, MPV7 & Limo Green | Patliputra VinFast",
    description:
      "Compare VinFast VF 6, VF 7, MPV 7 and Limo Green for Bihar city, highway, family and fleet use. Open the live compare tool next.",
    h1: "Compare VinFast electric models",
    intro:
      "VF 6 suits city and family SUV use. VF 7 adds premium ADAS and highway presence. VF MPV 7 and Limo Green cover seven-seat family and executive travel. Confirm live specs on the compare tool.",
    answerBlock:
      "Patliputra VinFast sells four VinFast EVs in Bihar from the Patna showroom: VF 6, VF 7, VF MPV 7 and Limo Green. Pick by seats, range need and budget, then book a test drive in Patna — we do not operate other district branches.",
    ...articleMeta,
    ctaHref: "/compare",
    ctaLabel: "Open compare tool",
    sections: [
      {
        heading: "Which model fits you?",
        body: "City commuters and first-time EV families usually start with VF 6. Buyers who want more presence and ADAS look at VF 7. Seven-seat households and fleets compare MPV 7 and Limo Green. All test drives are coordinated from Patna.",
      },
      {
        heading: "Verified data note",
        body: "Competitor comparisons on this site are positioning notes, not a live national spec dump. VinFast figures follow our model master. Last reviewed " + UPDATED + ".",
      },
    ],
  },
  {
    path: "/ev-buying-guide",
    title: "EV Buying Guide for Bihar | How to Choose an Electric Car | Patliputra VinFast",
    description:
      "A practical EV buying guide for Bihar — range, charging, running cost, finance and how to choose between VinFast VF 6, VF 7 and MPVs.",
    h1: "EV buying guide for Bihar",
    intro: "Map daily kilometres, home charging and on-road budget before you book. Then confirm with a Patna test drive.",
    answerBlock:
      "Bihar buyers should plan daily range, overnight home charging and a highway buffer. Patliputra VinFast in Patna helps with price, EMI estimates and test drives for VF 6, VF 7 and seven-seat models. Lender EMI and on-road tax are separate from brochure price.",
    ...articleMeta,
    sections: [
      { heading: "1. Map daily range", body: "Most Patna and district commuting fits modern EV range. Keep a reserve for monsoon traffic and unplanned detours." },
      { heading: "2. Plan charging", body: "A wall charger at home covers overnight top-ups. Public DC is useful for longer corridors, not a substitute for home charging." },
      { heading: "3. Total cost", body: "Energy, maintenance and finance often beat petrol over 3–5 years. Use the running-cost calculator; it is an estimate." },
      { heading: "4. Book a drive", body: `Visit ${DEALER} or book online.` },
    ],
  },
  {
    path: "/charging-infrastructure",
    title: "EV Charging in Bihar | Home & Fast Charging Guide | Patliputra VinFast",
    description:
      "How home charging and public DC fast charging work for VinFast cars in Bihar. Practical guidance from Patliputra VinFast, Patna.",
    h1: "EV charging in Bihar",
    intro: "Overnight home charging covers most days. Public fast charging supports longer Bihar trips when you plan stops.",
    answerBlock:
      "VinFast owners in Bihar typically charge at home on a compatible AC charger. Public DC fast charging exists on some corridors and is still uneven. Patliputra VinFast in Patna can explain current product charging specs; installation depends on your meter and building.",
    ...articleMeta,
    ctaHref: "/blogs/home-ev-charging-bihar",
    ctaLabel: "Read the home charging guide",
    sections: [
      { heading: "Home charging", body: "Ask about recommended charger capacity for your variant. We do not install every site ourselves — partners and electricians vary." },
      { heading: "On the road", body: "Plan DC stops on highway corridors. Our advisors help map Patna-to-district routes using current public maps, not a guaranteed charger list." },
    ],
  },
  {
    path: "/ownership-experience",
    title: "VinFast Ownership Experience in Bihar | Service & Support | Patliputra VinFast",
    description:
      "What VinFast ownership looks like with Patliputra VinFast — sales, service and after-sales care from the Patna showroom.",
    h1: "Ownership experience",
    intro: "From booking to scheduled service, support is based at the Patna dealership for customers across Bihar.",
    ...articleMeta,
    sections: [
      { heading: "Showroom to driveway", body: "Transparent quotes, test drives, finance assistance and delivery coordination." },
      { heading: "Ongoing care", body: "Service bookings and parts guidance run from Patna. We do not claim a workshop in every district." },
    ],
  },
  {
    path: "/customer-stories",
    title: "Customer Stories | VinFast Owners in Bihar | Patliputra VinFast",
    description:
      "How Bihar customers evaluate VinFast EVs with Patliputra VinFast, Patna. We publish first-party stories only when we have consent.",
    h1: "Customer stories",
    intro: "We will publish named delivery and ownership stories when customers consent. Until then, this page stays factual — no invented reviews.",
    answerBlock:
      "Patliputra VinFast serves Bihar from Patna. This page does not invent customer names or quotes. When we have permission, we will add real delivery and ownership notes here and date them.",
    ...articleMeta,
    sections: [
      { heading: "What we will publish", body: "Consented delivery photos, route notes and running-cost examples tied to a date and model." },
      { heading: "What we will not publish", body: "Stock testimonials presented as Bihar owners. Ask the showroom if you want to share your story." },
    ],
  },
  {
    path: "/faq",
    title: "VinFast FAQs Bihar | Price, Range, Charging & Booking | Patliputra VinFast",
    description:
      "FAQs about VinFast VF 6, VF 7, MPV 7 and Limo Green — prices, range, charging, booking and test drives in Bihar.",
    h1: "Frequently asked questions",
    intro: "Quick answers for Bihar buyers. Visible FAQs help people and answer engines; they are not a Google rich-result KPI.",
    ...articleMeta,
    sections: [
      { heading: "Where is the showroom?", body: `${DEALER}. We serve all 38 districts from this location.` },
      { heading: "Can I book a test drive online?", body: "Yes — use the Test Drive page. The team confirms timing from Patna." },
      { heading: "Do you help with finance?", body: "Yes. Use the EMI calculator for an estimate, then speak with sales for lender options." },
    ],
  },
  {
    path: "/bihar",
    title: "VinFast Across Bihar | 38 District Hubs | Patliputra VinFast",
    description:
      "District hubs for all 38 Bihar districts — price and test-drive assistance from Patliputra VinFast, Patna. Selective VF 6 / VF 7 pages where demand justifies them.",
    h1: "VinFast across Bihar’s 38 districts",
    intro:
      "Each district has a hub for assistance language and CTAs. VF 6 and VF 7 model pages exist only for selected high-demand districts.",
    ...articleMeta,
    sections: [
      {
        heading: "How these pages work",
        body: "Hubs explain that the physical showroom is in Patna. They do not invent local branches. A- model pages are limited to 12 districts.",
      },
    ],
  },
  {
    path: "/blogs",
    title: "VinFast & EV Knowledge Hub | Bihar Guides | Patliputra VinFast",
    description:
      "Original Bihar EV guides — running cost, home charging, route planning, VF 6 vs VF 7 and ownership. Written for Patliputra VinFast buyers.",
    h1: "Bihar EV knowledge hub",
    intro: "Utility first: cost, charging, routes and model choice. Every article lists an author, date and commercial next step.",
    ...articleMeta,
    sections: [{ heading: "Start here", body: "Read VF 6 vs VF 7, 100 km running cost, home charging and the Patna–Gaya trip guide." }],
  },
  {
    path: "/blogs/vf6-vs-vf7-bihar",
    title: "VinFast VF 6 vs VF 7: Which EV Fits Bihar City and Highway Use?",
    description:
      "Needs-based VF 6 vs VF 7 comparison for Bihar city commuting and highway trips. From Patliputra VinFast, Patna.",
    h1: "VF 6 vs VF 7 for Bihar city and highway use",
    answerBlock:
      "Choose VF 6 if you want a compact electric SUV for city and family use. Choose VF 7 if you want a more premium SUV with stronger ADAS and highway presence. Both are sold and demonstrated from Patliputra VinFast in Patna. Confirm live price and range on the model pages before you decide.",
    ...articleMeta,
    sources: "VinFast model master / SiteConfig prices and ranges; showroom process at Patna.",
    ctaHref: "/compare",
    ctaLabel: "Compare models",
    sections: [
      { heading: "City use", body: "Patna traffic and short district hops favour easier parking and overnight charging. VF 6 is usually the simpler daily tool." },
      { heading: "Highway use", body: "Patna–Gaya or north Bihar legs need a range buffer. VF 7 buyers often want extra presence and ADAS; still plan charging, do not treat certified range as guaranteed." },
      { heading: "How to decide", body: "List daily km, passengers and budget. Drive both in Patna if you can. Size and feel matter more than brochure adjectives." },
    ],
  },
  {
    path: "/blogs/ev-running-cost-bihar",
    title: "EV Running Cost in Bihar: What Does 100 km Cost?",
    description:
      "Transparent 100 km EV running-cost method for Bihar: tariff × consumption. Compare with petrol using the calculator.",
    h1: "What does 100 km cost in a VinFast EV in Bihar?",
    answerBlock:
      "A planning estimate is: (kWh used per 100 km) × (your ₹/kWh tariff). Example only: 18 kWh/100 km at ₹8/kWh is about ₹144 per 100 km. Petrol at 12 km/l and ₹105/l is about ₹875 per 100 km. Your meter slab, AC use and speed will change the result. Use the calculator and date your inputs.",
    ...articleMeta,
    sources: "User-entered tariff and consumption; not a DISCOM bill.",
    ctaHref: "/running-cost-calculator",
    ctaLabel: "Open running-cost calculator",
    sections: [
      { heading: "Method", body: "EV ₹/100 km = (kWh/100 km) × tariff. Petrol ₹/100 km = (100 ÷ km/l) × fuel price. State the date you ran the numbers." },
      { heading: "What this is not", body: "Not a promise of savings, not including tyre/insurance, not a home-bill forecast." },
    ],
  },
  {
    path: "/blogs/home-ev-charging-bihar",
    title: "Home EV Charging in Bihar: Installation, Power and Daily Use Guide",
    description:
      "How home EV charging works in Bihar — power, installation questions and daily use. Guidance from Patliputra VinFast, Patna.",
    h1: "Home EV charging in Bihar",
    answerBlock:
      "Most VinFast owners charge overnight at home on a compatible AC charger. Installation needs a sound earthing, spare load on the meter and, in apartments, society approval. Patliputra VinFast can explain current vehicle charging specs; a licensed electrician must assess your site in Bihar.",
    ...articleMeta,
    ctaHref: "/blogs/prepare-home-ev-charger-bihar",
    ctaLabel: "Home prep checklist",
    sections: [
      { heading: "Daily use", body: "Plug in after the last trip. Morning departures usually start near full if the circuit held overnight." },
      { heading: "Limits", body: "We do not guarantee a charger for every building. Load shedding and weak wiring are local facts, not marketing problems we can erase." },
    ],
  },
  {
    path: "/blogs/patna-to-gaya-ev-trip",
    title: "Patna to Gaya in a VinFast EV: Range & Charging Planning Guide",
    description:
      "Plan a Patna–Gaya VinFast trip: distance buffer, charging habit and when to use public DC. Patliputra VinFast, Patna.",
    h1: "Patna to Gaya in a VinFast EV",
    answerBlock:
      "Patna to Gaya is a common Bihar corridor. Start near full from home or the Patna showroom, keep a weather and AC reserve, and do not treat certified range as the trip budget. Public DC along the route should be checked on the day you travel. Book a VF 6 or VF 7 drive in Patna to judge highway comfort.",
    ...articleMeta,
    ctaHref: "/gaya",
    ctaLabel: "Gaya district hub",
    sections: [
      { heading: "Planning rule", body: "Use official range as a ceiling, not a target. Add buffer for monsoon, heat and unplanned stops around Bodh Gaya." },
      { heading: "Charging", body: "Overnight charge in Patna. Confirm public chargers the morning you leave — listings go stale." },
    ],
  },
  {
    path: "/blogs/patna-to-darbhanga-ev-trip",
    title: "Patna to Darbhanga EV Trip Planning Guide",
    description:
      "Range and charging planning for Patna–Darbhanga in a VinFast EV. Assistance from Patliputra VinFast, Patna.",
    h1: "Patna to Darbhanga EV trip planning",
    answerBlock:
      "Patna–Darbhanga is a longer north-Bihar run than a city commute. Leave with a high state of charge, plan a reserve, and verify any public charger the same day. Test drives and quotes are handled from Patliputra VinFast in Patna for Darbhanga customers.",
    ...articleMeta,
    ctaHref: "/darbhanga",
    ctaLabel: "Darbhanga hub",
    sections: [
      { heading: "Corridor notes", body: "Traffic and heat change consumption. Certified range is not a promise you will arrive with 20% left." },
      { heading: "Next step", body: "Use the Darbhanga hub for CTAs, then book a Patna slot if you want a highway-oriented VF 7 feel." },
    ],
  },
  {
    path: "/blogs/vf6-ownership-guide-bihar",
    title: "VF 6 Ownership Guide: Range, Charging, Service and Finance in Bihar",
    description:
      "Owning a VinFast VF 6 in Bihar — charging habit, service from Patna, finance estimates and when to book a drive.",
    h1: "VF 6 ownership guide for Bihar",
    answerBlock:
      "VF 6 ownership in Bihar centres on home charging, a Patna service relationship and an honest EMI estimate. Price and certified range follow the live model master. Patliputra VinFast does not operate a VF 6 store in every district.",
    ...articleMeta,
    ctaHref: "/models/vf6",
    ctaLabel: "VF 6 model page",
    sections: [
      { heading: "Range and charging", body: "City loops plus overnight AC charging cover most weeks. Highway days need a plan." },
      { heading: "Service and finance", body: "Workshop work is coordinated from Patna. EMI on the calculator is not a sanctioned loan." },
    ],
  },
  {
    path: "/blogs/vf7-highway-guide-bihar",
    title: "VF 7 Ownership Guide for Bihar Highway Users",
    description:
      "VF 7 for Bihar highway users — ADAS as assistance not autopilot, range buffers and Patna service.",
    h1: "VF 7 for Bihar highway users",
    answerBlock:
      "VF 7 suits Bihar buyers who want a more premium electric SUV and ADAS support on highways. ADAS assists; it does not replace attention. Certified range still needs a trip buffer. Sales and service sit at Patliputra VinFast, Patna.",
    ...articleMeta,
    ctaHref: "/models/vf7",
    ctaLabel: "VF 7 model page",
    sections: [
      { heading: "ADAS", body: "Camera and radar aids can reduce fatigue. Stay in control on mixed Bihar roads and cattle crossings." },
      { heading: "Highway habit", body: "Start full, watch consumption at 80–100 km/h, and confirm DC options before long north or east legs." },
    ],
  },
  {
    path: "/blogs/electric-suv-buying-checklist-bihar",
    title: "Electric SUV Buying Checklist for Bihar Families",
    description:
      "A Bihar-family checklist for buying an electric SUV: km, charging, seats, finance and a Patna test drive.",
    h1: "Electric SUV buying checklist for Bihar families",
    answerBlock:
      "Write down daily km, who sits in the car, whether you can charge at home, and your on-road budget. Then compare VF 6 and VF 7 at Patliputra VinFast in Patna. Do not buy on brochure range alone.",
    ...articleMeta,
    ctaHref: "/test-drive",
    ctaLabel: "Book a test drive",
    sections: [
      { heading: "Checklist", body: "Home parking + socket or charger path. School and office km. Highway weekends. Exchange car. EMI comfort (estimate only)." },
      { heading: "Then drive", body: "A 20-minute brochure read is not a decision. Sit in both models if the family is split." },
    ],
  },
  {
    path: "/blogs/prepare-home-ev-charger-bihar",
    title: "How to Prepare Your Home for an EV Charger in Bihar",
    description:
      "Prepare earthing, load and apartment approval before you install a home EV charger in Bihar.",
    h1: "Prepare your home for an EV charger",
    answerBlock:
      "Before you buy a charger, check earthing, spare electrical load and written permission if you live in an apartment. A licensed electrician in your Bihar district should inspect the site. Patliputra VinFast can share current vehicle inlet specs; we do not certify every home.",
    ...articleMeta,
    sections: [
      { heading: "House vs apartment", body: "Independent houses are usually simpler. Apartments need parking allocation and society rules in writing." },
      { heading: "Safety", body: "Skip informal socket adapters as a permanent solution. Heat and monsoon humidity punish weak wiring." },
    ],
  },
  {
    path: "/blogs/bihar-owner-stories",
    title: "Real Bihar Customer Delivery / Ownership Stories",
    description:
      "First-party VinFast delivery and ownership notes from Bihar. Published only with consent — no invented reviews.",
    h1: "Bihar delivery and ownership stories",
    answerBlock:
      "This page is reserved for consented Patliputra VinFast customer stories from Bihar. We will not invent names, quotes or delivery photos. If you have taken delivery from the Patna showroom and want to be featured, tell the sales desk.",
    ...articleMeta,
    sections: [
      { heading: "Status", body: "No anonymised stock reviews. When stories go live they will carry a date, model and permission note." },
    ],
  },
  {
    path: "/blogs/ev-monsoon-bihar",
    title: "EV Monsoon Driving and Charging Checklist for Bihar",
    description:
      "Monsoon EV habits for Bihar: charging in rain, standing water, and range drop. Guidance from Patliputra VinFast.",
    h1: "EV monsoon driving and charging in Bihar",
    answerBlock:
      "Drive an EV in Bihar monsoon the way you would any modern car: avoid deep standing water, keep tyres and lights sound, and charge under cover when you can. Expect higher consumption in rain and AC use. Service questions go to the Patna desk.",
    ...articleMeta,
    sections: [
      { heading: "Charging in rain", body: "Use the designed inlet and a sound cable. Do not jury-rig outdoor sockets on wet plaster." },
      { heading: "Roads", body: "Waterlogged stretches hide potholes. Range buffers should be larger in July–September." },
    ],
  },
  {
    path: "/blogs/7-seater-ev-bihar",
    title: "7-Seater Electric Mobility in Bihar: MPV 7 and Limo Green Use Cases",
    description:
      "When Bihar families and fleets should consider VinFast VF MPV 7 or Limo Green. Enquiry via Patliputra VinFast, Patna.",
    h1: "7-seater electric mobility in Bihar",
    answerBlock:
      "Choose a seven-seat VinFast MPV when you regularly move a large family or an executive group. VF MPV 7 and Limo Green are offered through Patliputra VinFast in Patna. Confirm seating, range and fleet terms with the desk — we do not list a local MPV showroom in every district.",
    ...articleMeta,
    ctaHref: "/models/mpv7",
    ctaLabel: "VF MPV 7 page",
    sections: [
      { heading: "Family", body: "Three-row trips across districts need luggage and charging planning, not just seat count." },
      { heading: "Fleet", body: "Energy cost per km can look attractive versus diesel MPVs. Get a written fleet quote; do not use the EMI slider as a contract." },
    ],
  },
];

export const COMPARE_SEO_PAGES: SeoArticle[] = [
  {
    path: "/compare/vinfast-vf6-vs-tata-curvv-ev",
    title: "VinFast VF6 vs Tata Curvv EV | Comparison | Patliputra VinFast",
    description: "Positioning note: VF 6 versus Tata Curvv EV for Bihar shoppers. Verify competitor data independently.",
    h1: "VinFast VF 6 vs Tata Curvv EV",
    intro: "Two electric SUV options with different dealer networks. Drive VF 6 at Patliputra VinFast, Patna. Competitor specs change — check the other brand before you decide.",
    ...articleMeta,
    sources: "VinFast figures from our model master. Competitor figures not maintained live.",
    sections: [{ heading: "Verified-data disclaimer", body: `Last reviewed ${UPDATED}. This is not a full spec sheet of the other brand.` }],
  },
  {
    path: "/compare/vinfast-vf6-vs-mahindra-be-6",
    title: "VinFast VF6 vs Mahindra BE 6 | Comparison | Patliputra VinFast",
    description: "VF 6 vs Mahindra BE 6 positioning for Bihar buyers. Verify competitor data independently.",
    h1: "VinFast VF 6 vs Mahindra BE 6",
    intro: "Evaluate design and ownership support, then book a VF 6 test drive in Patna.",
    ...articleMeta,
    sections: [{ heading: "Disclaimer", body: `Competitor data is not a live feed. Last reviewed ${UPDATED}.` }],
  },
  {
    path: "/compare/vinfast-vf6-vs-mg-zs-ev",
    title: "VinFast VF6 vs MG ZS EV | Comparison | Patliputra VinFast",
    description: "VF 6 vs MG ZS EV positioning for Bihar city and family use.",
    h1: "VinFast VF 6 vs MG ZS EV",
    intro: "See how VF 6 feels on Bihar roads with a supervised test drive in Patna.",
    ...articleMeta,
    sections: [{ heading: "Disclaimer", body: `Last reviewed ${UPDATED}. Confirm MG specifications on their site.` }],
  },
  {
    path: "/compare/vinfast-vf7-vs-byd-atto-3",
    title: "VinFast VF7 vs BYD Atto 3 | Comparison | Patliputra VinFast",
    description: "VF 7 vs BYD Atto 3 positioning for premium EV SUV shoppers in Bihar.",
    h1: "VinFast VF 7 vs BYD Atto 3",
    intro: "Compare VF 7 ADAS and comfort in person at the Patna showroom.",
    ...articleMeta,
    sections: [{ heading: "Disclaimer", body: `Last reviewed ${UPDATED}. BYD specs are not maintained in our model master.` }],
  },
  {
    path: "/compare/vinfast-vf7-vs-hyundai-creta-electric",
    title: "VinFast VF7 vs Hyundai Creta Electric | Comparison | Patliputra VinFast",
    description: "VF 7 vs Creta Electric — what Bihar buyers should verify before booking.",
    h1: "VinFast VF 7 vs Hyundai Creta Electric",
    intro: "Brand ecosystem and dealership experience matter as much as brochure specs.",
    ...articleMeta,
    sections: [{ heading: "Disclaimer", body: `Last reviewed ${UPDATED}. Confirm Hyundai figures independently.` }],
  },
  {
    path: "/compare/vinfast-vf7-vs-mahindra-xev-9e",
    title: "VinFast VF7 vs Mahindra XEV 9e | Comparison | Patliputra VinFast",
    description: "VF 7 vs Mahindra XEV 9e positioning for premium electric SUV shoppers in Bihar.",
    h1: "VinFast VF 7 vs Mahindra XEV 9e",
    intro: "Book a VF 7 experience at Patliputra VinFast to judge ride and cabin firsthand.",
    ...articleMeta,
    sections: [{ heading: "Disclaimer", body: `Last reviewed ${UPDATED}. Competitor data is not live-synced.` }],
  },
];

export const SEO_PAGE_BY_PATH = new Map<string, SeoArticle>(
  [...SEO_ARTICLES, ...COMPARE_SEO_PAGES].map((a) => [a.path, a]),
);
