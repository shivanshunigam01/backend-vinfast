export type SeoArticle = {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
};

const dealerCta =
  "Visit Patliputra VinFast in Patna or book a test drive online for VF6, VF7, VF MPV7 and Limo Green.";

export const SEO_ARTICLES: SeoArticle[] = [
  {
    path: "/compare-models",
    title: "Compare VinFast EV Models | VF6, VF7, MPV7 & Limo Green | Patliputra VinFast",
    description:
      "Compare VinFast VF6, VF7, MPV7 and Limo Green side by side — range, features, seating and suitable use cases for Bihar buyers.",
    keywords: ["compare VinFast models", "VF6 vs VF7", "electric MPV Bihar", "Patliputra VinFast"],
    h1: "Compare VinFast electric models",
    intro:
      "Choose the right VinFast EV for city commuting, family trips or fleet use. Use our interactive compare tool or review the guides below.",
    sections: [
      {
        heading: "Which model fits you?",
        body: "VF6 is ideal for city and family SUV needs. VF7 adds premium ADAS and connected features. VF MPV7 and Limo Green serve 7-seater family and executive/fleet needs.",
      },
      {
        heading: "Next step",
        body: `Open the interactive compare tool or book a test drive at our Patna showroom. ${dealerCta}`,
      },
    ],
  },
  {
    path: "/ev-buying-guide",
    title: "EV Buying Guide for Bihar | How to Choose an Electric Car | Patliputra VinFast",
    description:
      "A practical EV buying guide for Bihar — range, charging, running cost, finance and how to choose between VinFast VF6, VF7 and MPVs.",
    keywords: ["EV buying guide Bihar", "buy electric car Patna", "VinFast buying guide"],
    h1: "EV buying guide for Bihar",
    intro:
      "Switching to electric is easier when you plan for daily km, home charging and on-road budget. This guide helps Bihar buyers decide with confidence.",
    sections: [
      {
        heading: "1. Map your daily range needs",
        body: "Most Patna and district commuting fits comfortably within modern EV range. Keep a buffer for highway trips and monsoon traffic.",
      },
      {
        heading: "2. Plan home and public charging",
        body: "A wall charger at home covers overnight top-ups. Highway and city DC fast chargers support longer journeys across Bihar.",
      },
      {
        heading: "3. Compare total cost of ownership",
        body: "Fuel savings, lower maintenance and available finance often make EVs competitive vs petrol/diesel SUVs over 3–5 years.",
      },
      {
        heading: "4. Book a test drive",
        body: dealerCta,
      },
    ],
  },
  {
    path: "/charging-infrastructure",
    title: "EV Charging Infrastructure in Bihar | Patliputra VinFast",
    description:
      "Learn how home charging, public DC fast charging and VinFast ownership support work for electric cars across Bihar.",
    keywords: ["EV charging Bihar", "electric car charger Patna", "VinFast charging"],
    h1: "Charging infrastructure in Bihar",
    intro:
      "Reliable charging is key to EV confidence. Combine overnight home charging with public fast chargers for longer trips.",
    sections: [
      {
        heading: "Home charging",
        body: "Most owners charge overnight. Ask our team about recommended charger capacity for VF6, VF7 and MPV models.",
      },
      {
        heading: "On the road",
        body: "Plan stops on highway corridors. Our advisors help map routes from Patna to major Bihar districts.",
      },
    ],
  },
  {
    path: "/ownership-experience",
    title: "VinFast Ownership Experience in Bihar | Service & Support | Patliputra VinFast",
    description:
      "What VinFast ownership looks like with Patliputra VinFast — sales, service, warranty support and after-sales care in Bihar.",
    keywords: ["VinFast ownership Bihar", "VinFast service Patna", "EV after sales"],
    h1: "Ownership experience",
    intro:
      "From booking to delivery and scheduled service, Patliputra VinFast supports owners across Bihar from our Patna dealership.",
    sections: [
      {
        heading: "Showroom to driveway",
        body: "Transparent pricing, test drives, finance assistance and delivery coordination for every model.",
      },
      {
        heading: "Ongoing care",
        body: "Service bookings, genuine parts guidance and ownership tips for Bihar road conditions.",
      },
    ],
  },
  {
    path: "/customer-stories",
    title: "Customer Stories | VinFast Owners in Bihar | Patliputra VinFast",
    description:
      "Hear how Bihar customers switched to VinFast electric SUVs and MPVs with Patliputra VinFast, Patna.",
    keywords: ["VinFast customer stories Bihar", "EV owners Patna"],
    h1: "Customer stories",
    intro:
      "Families and businesses across Bihar are choosing electric for daily commuting, comfort and lower running costs.",
    sections: [
      {
        heading: "City families",
        body: "VF6 and VF7 owners highlight quiet cabins, tech features and weekend range for Patna and nearby districts.",
      },
      {
        heading: "Fleet & executive travel",
        body: "MPV7 and Limo Green support spacious seating for corporate and large-family journeys.",
      },
    ],
  },
  {
    path: "/faq",
    title: "VinFast FAQs Bihar | Price, Range, Charging & Booking | Patliputra VinFast",
    description:
      "Frequently asked questions about VinFast VF6, VF7, MPV7 and Limo Green — prices, range, charging, booking and test drives in Bihar.",
    keywords: ["VinFast FAQ Bihar", "VF6 FAQ", "VF7 FAQ Patna"],
    h1: "Frequently asked questions",
    intro: "Quick answers for Bihar buyers exploring VinFast electric vehicles.",
    sections: [
      {
        heading: "Where is the showroom?",
        body: "Patliputra VinFast is in Patna (Paijawa, NH 30 Bypass). We serve customers from all 38 districts of Bihar.",
      },
      {
        heading: "Can I book a test drive online?",
        body: "Yes — use the Test Drive page to request a slot. Our team confirms timing and model availability.",
      },
      {
        heading: "Do you help with finance?",
        body: "Yes. Ask about EMI options using our EMI calculator and speak with our sales advisors for loan partners.",
      },
    ],
  },
  {
    path: "/bihar",
    title: "VinFast Across Bihar | 38 District Landing Pages | Patliputra VinFast",
    description:
      "Explore VinFast EV pages for all 38 Bihar districts — local price, booking and test drive information via Patliputra VinFast, Patna.",
    keywords: ["VinFast Bihar", "electric car Bihar districts", "VinFast dealer Bihar"],
    h1: "VinFast across Bihar’s 38 districts",
    intro:
      "Patliputra VinFast is Bihar’s authorised destination for VinFast EVs. Browse district pages for localised information on VF6, VF7, MPV7 and Limo Green.",
    sections: [
      {
        heading: "Hyperlocal pages",
        body: "Each district × model page covers pricing cues, FAQs and booking CTAs while connecting you to our Patna showroom.",
      },
    ],
  },
  {
    path: "/blogs",
    title: "VinFast & EV Blog | Guides for Bihar Buyers | Patliputra VinFast",
    description:
      "EV guides and VinFast insights for Bihar — buying tips, charging, running costs, VF6, VF7 and electric MPVs.",
    keywords: ["VinFast blog", "EV blog Bihar", "electric SUV guides"],
    h1: "EV insights & guides",
    intro: "Practical articles to help Bihar drivers switch to electric with confidence.",
    sections: [
      {
        heading: "Start here",
        body: "Explore articles on Bihar’s EV future, choosing an SUV, charging infrastructure and model-specific guides.",
      },
    ],
  },
  {
    path: "/blogs/why-electric-vehicles-are-the-future-of-bihar",
    title: "Why Electric Vehicles Are the Future of Bihar | Patliputra VinFast",
    description:
      "Why Bihar is ready for electric mobility — lower running costs, quieter cities and growing charging access.",
    keywords: ["EV future Bihar", "electric cars Bihar"],
    h1: "Why electric vehicles are the future of Bihar",
    intro: "Cleaner city air, predictable running costs and modern connected cars are changing how Bihar drives.",
    sections: [
      {
        heading: "Local advantages",
        body: "Dense city traffic favours instant EV torque and lower per-km cost versus petrol or diesel.",
      },
      { heading: "Ready when you are", body: dealerCta },
    ],
  },
  {
    path: "/blogs/how-to-choose-the-right-electric-suv",
    title: "How to Choose the Right Electric SUV | Patliputra VinFast",
    description: "A simple checklist to choose between VinFast VF6 and VF7 for Bihar families and professionals.",
    keywords: ["choose electric SUV", "VF6 or VF7"],
    h1: "How to choose the right electric SUV",
    intro: "Match seats, features, range and budget — then confirm with a test drive.",
    sections: [
      {
        heading: "VF6 vs VF7",
        body: "VF6 prioritises smart value for city use. VF7 leans premium with stronger ADAS and lifestyle features.",
      },
    ],
  },
  {
    path: "/blogs/charging-infrastructure-in-bihar",
    title: "Charging Infrastructure in Bihar | EV Guide | Patliputra VinFast",
    description: "How EV charging works in Bihar today — home AC charging and public fast charging tips.",
    keywords: ["charging infrastructure Bihar", "EV charger Patna"],
    h1: "Charging infrastructure in Bihar",
    intro: "Home charging covers most days; plan DC stops for long intercity drives.",
    sections: [{ heading: "Practical tip", body: "Charge overnight and keep a public-charger app handy for highway travel." }],
  },
  {
    path: "/blogs/cost-of-owning-an-ev",
    title: "Cost of Owning an EV in Bihar | Patliputra VinFast",
    description: "Understand EV running cost, maintenance and finance versus petrol or diesel ownership in Bihar.",
    keywords: ["EV running cost Bihar", "cost of owning EV"],
    h1: "Cost of owning an EV",
    intro: "Electric cars often win on energy cost per km and fewer routine service items.",
    sections: [
      {
        heading: "Use our calculators",
        body: "Try the EMI calculator and running-cost tools, then speak with our Patna team for on-road quotes.",
      },
    ],
  },
  {
    path: "/blogs/top-10-reasons-to-buy-the-vf6",
    title: "Top 10 Reasons to Buy the VinFast VF6 | Patliputra VinFast",
    description: "Why the VinFast VF6 is a strong electric SUV choice for Bihar city and family drivers.",
    keywords: ["buy VF6", "VinFast VF6 Bihar"],
    h1: "Top 10 reasons to buy the VF6",
    intro: "Smart features, SUV practicality and EV efficiency make VF6 a compelling daily driver.",
    sections: [
      {
        heading: "Highlights",
        body: "Comfortable cabin, modern tech, suitable city range and authorised dealership support in Patna.",
      },
    ],
  },
  {
    path: "/blogs/is-the-vf6-worth-buying",
    title: "Is the VinFast VF6 Worth Buying? | Patliputra VinFast",
    description: "Honest take on VF6 value for Bihar buyers — who it suits and when to consider VF7 instead.",
    keywords: ["is VF6 worth buying", "VF6 review Bihar"],
    h1: "Is the VF6 worth buying?",
    intro: "If you want a feature-rich electric SUV for urban Bihar without overbuying, VF6 is often the sweet spot.",
    sections: [{ heading: "Decide with a drive", body: dealerCta }],
  },
  {
    path: "/blogs/vf6-running-cost-analysis",
    title: "VinFast VF6 Running Cost Analysis | Patliputra VinFast",
    description: "Estimate VF6 electricity cost per km versus fuel SUV running costs for Bihar drivers.",
    keywords: ["VF6 running cost", "EV cost per km"],
    h1: "VF6 running cost analysis",
    intro: "Most owners see meaningful savings versus petrol SUVs once daily commuting is on home electricity tariffs.",
    sections: [{ heading: "Next step", body: "Use our running-cost calculator and confirm tariffs with a sales advisor." }],
  },
  {
    path: "/blogs/why-the-vf7-stands-out",
    title: "Why the VinFast VF7 Stands Out | Patliputra VinFast",
    description: "What makes the VF7 a premium electric SUV pick in Bihar — ADAS, design and connected features.",
    keywords: ["VF7 review", "premium EV SUV Bihar"],
    h1: "Why the VF7 stands out",
    intro: "VF7 targets buyers who want a more premium EV SUV experience with advanced safety tech.",
    sections: [{ heading: "Book a demo", body: dealerCta }],
  },
  {
    path: "/blogs/adas-explained",
    title: "ADAS Explained for VinFast Buyers | Patliputra VinFast",
    description: "A plain-language overview of ADAS features relevant to VinFast VF7 buyers in India.",
    keywords: ["ADAS explained", "VF7 ADAS"],
    h1: "ADAS explained",
    intro: "Advanced Driver Assistance Systems add camera/radar-based aids that support safer, more relaxed driving.",
    sections: [
      {
        heading: "Always stay alert",
        body: "ADAS assists the driver — it does not replace attention. Ask for a supervised demo on your test drive.",
      },
    ],
  },
  {
    path: "/blogs/best-electric-mpv-in-india",
    title: "Best Electric MPV Options | VinFast MPV7 & Limo Green | Patliputra VinFast",
    description: "Explore VinFast electric MPV choices for large families and businesses in Bihar.",
    keywords: ["best electric MPV", "VinFast MPV7", "Limo Green"],
    h1: "Electric MPVs for families & fleets",
    intro: "Need seven seats and EV efficiency? Compare VF MPV7 and Limo Green with our team.",
    sections: [{ heading: "Visit Patna", body: dealerCta }],
  },
  {
    path: "/blogs/family-road-trips-with-mpv7",
    title: "Family Road Trips with VinFast MPV7 | Patliputra VinFast",
    description: "Planning Bihar family road trips in an electric MPV — space, comfort and charging tips.",
    keywords: ["MPV7 road trip", "family EV Bihar"],
    h1: "Family road trips with MPV7",
    intro: "Spacious seating and EV refinement make long family drives quieter and cheaper per km.",
    sections: [{ heading: "Trip tip", body: "Pre-plan DC charging stops and start each day near full charge." }],
  },
  {
    path: "/blogs/corporate-fleet-benefits-electric-mpv",
    title: "Corporate Fleet Benefits of Electric MPVs | Patliputra VinFast",
    description: "Why electric MPVs help Bihar businesses cut fleet fuel cost and present a modern brand image.",
    keywords: ["electric fleet MPV", "corporate EV Bihar"],
    h1: "Corporate fleet benefits of electric MPVs",
    intro: "Lower energy cost per km and quieter executive transport are strong reasons fleets evaluate Limo Green and MPV7.",
    sections: [{ heading: "Talk to us", body: "Contact Patliputra VinFast for fleet demos and bulk enquiry support." }],
  },
];

export const COMPARE_SEO_PAGES: SeoArticle[] = [
  {
    path: "/compare/vinfast-vf6-vs-tata-curvv-ev",
    title: "VinFast VF6 vs Tata Curvv EV | Comparison | Patliputra VinFast",
    description: "Compare VinFast VF6 with Tata Curvv EV — positioning for Bihar buyers looking at electric SUVs.",
    keywords: ["VF6 vs Curvv EV", "VinFast vs Tata EV"],
    h1: "VinFast VF6 vs Tata Curvv EV",
    intro: "Two modern electric SUV options with different brand ecosystems. Experience VF6 at Patliputra VinFast, Patna.",
    sections: [
      {
        heading: "Why drive the VF6",
        body: "Focus on VinFast’s feature set, cabin tech and authorised Bihar dealership support when comparing.",
      },
    ],
  },
  {
    path: "/compare/vinfast-vf6-vs-mahindra-be-6",
    title: "VinFast VF6 vs Mahindra BE 6 | Comparison | Patliputra VinFast",
    description: "VF6 vs Mahindra BE 6 comparison overview for Bihar electric SUV shoppers.",
    keywords: ["VF6 vs BE 6", "VinFast vs Mahindra EV"],
    h1: "VinFast VF6 vs Mahindra BE 6",
    intro: "Evaluate design, features and ownership support — then book a VF6 test drive in Patna.",
    sections: [{ heading: "Next step", body: dealerCta }],
  },
  {
    path: "/compare/vinfast-vf6-vs-mg-zs-ev",
    title: "VinFast VF6 vs MG ZS EV | Comparison | Patliputra VinFast",
    description: "Compare VinFast VF6 and MG ZS EV for Bihar city and family electric SUV needs.",
    keywords: ["VF6 vs ZS EV", "VinFast vs MG"],
    h1: "VinFast VF6 vs MG ZS EV",
    intro: "Both target the electric SUV segment. See how VF6 feels on Bihar roads with a supervised test drive.",
    sections: [{ heading: "Next step", body: dealerCta }],
  },
  {
    path: "/compare/vinfast-vf7-vs-byd-atto-3",
    title: "VinFast VF7 vs BYD Atto 3 | Comparison | Patliputra VinFast",
    description: "Premium EV SUV comparison: VinFast VF7 vs BYD Atto 3 for Bihar buyers.",
    keywords: ["VF7 vs Atto 3", "VinFast vs BYD"],
    h1: "VinFast VF7 vs BYD Atto 3",
    intro: "Considering a premium electric SUV? Compare VF7’s ADAS and comfort focus in person at our Patna showroom.",
    sections: [{ heading: "Next step", body: dealerCta }],
  },
  {
    path: "/compare/vinfast-vf7-vs-hyundai-creta-electric",
    title: "VinFast VF7 vs Hyundai Creta Electric | Comparison | Patliputra VinFast",
    description: "VF7 vs Creta Electric — what Bihar buyers should compare before booking.",
    keywords: ["VF7 vs Creta Electric", "VinFast vs Hyundai EV"],
    h1: "VinFast VF7 vs Hyundai Creta Electric",
    intro: "Brand ecosystem, features and dealership experience matter as much as brochure specs.",
    sections: [{ heading: "Next step", body: dealerCta }],
  },
  {
    path: "/compare/vinfast-vf7-vs-mahindra-xev-9e",
    title: "VinFast VF7 vs Mahindra XEV 9e | Comparison | Patliputra VinFast",
    description: "Compare VinFast VF7 with Mahindra XEV 9e for premium electric SUV shoppers in Bihar.",
    keywords: ["VF7 vs XEV 9e", "VinFast vs Mahindra"],
    h1: "VinFast VF7 vs Mahindra XEV 9e",
    intro: "Book a VF7 experience at Patliputra VinFast to judge ride, tech and cabin quality firsthand.",
    sections: [{ heading: "Next step", body: dealerCta }],
  },
];

export const SEO_PAGE_BY_PATH = new Map<string, SeoArticle>(
  [...SEO_ARTICLES, ...COMPARE_SEO_PAGES].map((a) => [a.path, a]),
);
