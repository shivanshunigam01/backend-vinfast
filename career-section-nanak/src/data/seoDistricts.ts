export type SeoDistrictMeta = {
  name: string;
  slug: string;
  headquarters: string;
  aTier: boolean;
  useCase: string;
};

export const A_TIER_SLUGS = [
  "patna",
  "gaya",
  "muzaffarpur",
  "bhagalpur",
  "darbhanga",
  "nalanda",
  "purnia",
  "begusarai",
  "rohtas",
  "saran",
  "vaishali",
  "east-champaran",
] as const;

export const SEO_DISTRICTS: SeoDistrictMeta[] = [
  { name: "Araria", slug: "araria", headquarters: "Araria", aTier: false, useCase: "Seemanchal travel" },
  { name: "Arwal", slug: "arwal", headquarters: "Arwal", aTier: false, useCase: "short hops to Patna" },
  { name: "Aurangabad", slug: "aurangabad", headquarters: "Aurangabad", aTier: false, useCase: "Grand Trunk corridor" },
  { name: "Banka", slug: "banka", headquarters: "Banka", aTier: false, useCase: "east Bihar routes" },
  { name: "Begusarai", slug: "begusarai", headquarters: "Begusarai", aTier: true, useCase: "Barauni / NH-31 commuting" },
  { name: "Bhagalpur", slug: "bhagalpur", headquarters: "Bhagalpur", aTier: true, useCase: "east Bihar city driving" },
  { name: "Bhojpur", slug: "bhojpur", headquarters: "Arrah", aTier: false, useCase: "Arrah–Patna commuting" },
  { name: "Buxar", slug: "buxar", headquarters: "Buxar", aTier: false, useCase: "western Bihar highways" },
  { name: "Darbhanga", slug: "darbhanga", headquarters: "Darbhanga", aTier: true, useCase: "Mithila / Patna–Darbhanga corridor" },
  { name: "East Champaran", slug: "east-champaran", headquarters: "Motihari", aTier: true, useCase: "Motihari highway use" },
  { name: "Gaya", slug: "gaya", headquarters: "Gaya", aTier: true, useCase: "Patna–Gaya and Bodh Gaya travel" },
  { name: "Gopalganj", slug: "gopalganj", headquarters: "Gopalganj", aTier: false, useCase: "north-west Bihar routes" },
  { name: "Jamui", slug: "jamui", headquarters: "Jamui", aTier: false, useCase: "south Bihar stretches" },
  { name: "Jehanabad", slug: "jehanabad", headquarters: "Jehanabad", aTier: false, useCase: "Patna and Gaya travel" },
  { name: "Kaimur", slug: "kaimur", headquarters: "Bhabua", aTier: false, useCase: "Bhabua plateau highway" },
  { name: "Katihar", slug: "katihar", headquarters: "Katihar", aTier: false, useCase: "Seemanchal commuting" },
  { name: "Khagaria", slug: "khagaria", headquarters: "Khagaria", aTier: false, useCase: "Kosi–Ganga belt" },
  { name: "Kishanganj", slug: "kishanganj", headquarters: "Kishanganj", aTier: false, useCase: "far-east Bihar routes" },
  { name: "Lakhisarai", slug: "lakhisarai", headquarters: "Lakhisarai", aTier: false, useCase: "Kiul commuting" },
  { name: "Madhepura", slug: "madhepura", headquarters: "Madhepura", aTier: false, useCase: "Kosi belt travel" },
  { name: "Madhubani", slug: "madhubani", headquarters: "Madhubani", aTier: false, useCase: "Mithila hinterland" },
  { name: "Munger", slug: "munger", headquarters: "Munger", aTier: false, useCase: "Ganga-town commuting" },
  { name: "Muzaffarpur", slug: "muzaffarpur", headquarters: "Muzaffarpur", aTier: true, useCase: "north Bihar commercial trips" },
  { name: "Nalanda", slug: "nalanda", headquarters: "Bihar Sharif", aTier: true, useCase: "Bihar Sharif–Rajgir–Patna" },
  { name: "Nawada", slug: "nawada", headquarters: "Nawada", aTier: false, useCase: "south-central Bihar travel" },
  { name: "Patna", slug: "patna", headquarters: "Patna", aTier: true, useCase: "city commuting on NH 30 Bypass" },
  { name: "Purnia", slug: "purnia", headquarters: "Purnia", aTier: true, useCase: "Seemanchal city driving" },
  { name: "Rohtas", slug: "rohtas", headquarters: "Sasaram", aTier: true, useCase: "Sasaram / Grand Trunk highway" },
  { name: "Saharsa", slug: "saharsa", headquarters: "Saharsa", aTier: false, useCase: "Kosi region travel" },
  { name: "Samastipur", slug: "samastipur", headquarters: "Samastipur", aTier: false, useCase: "rail-town commuting" },
  { name: "Saran", slug: "saran", headquarters: "Chhapra", aTier: true, useCase: "Chhapra–Patna commuting" },
  { name: "Sheikhpura", slug: "sheikhpura", headquarters: "Sheikhpura", aTier: false, useCase: "short district hops" },
  { name: "Sheohar", slug: "sheohar", headquarters: "Sheohar", aTier: false, useCase: "north Bihar rural–town travel" },
  { name: "Sitamarhi", slug: "sitamarhi", headquarters: "Sitamarhi", aTier: false, useCase: "border-district travel" },
  { name: "Siwan", slug: "siwan", headquarters: "Siwan", aTier: false, useCase: "north-west Bihar travel" },
  { name: "Supaul", slug: "supaul", headquarters: "Supaul", aTier: false, useCase: "Kosi belt routes" },
  { name: "Vaishali", slug: "vaishali", headquarters: "Hajipur", aTier: true, useCase: "Hajipur–Patna commuting" },
  { name: "West Champaran", slug: "west-champaran", headquarters: "Bettiah", aTier: false, useCase: "Bettiah highway use" },
];

const bySlug = new Map(SEO_DISTRICTS.map((d) => [d.slug, d]));

export function getSeoDistrict(slug: string) {
  return bySlug.get(String(slug || "").toLowerCase()) || null;
}

export function isATierCombo(districtSlug: string, modelSlug: string) {
  const district = getSeoDistrict(districtSlug);
  const model = String(modelSlug || "").toLowerCase();
  const isVf = model === "vinfast-vf6" || model === "vf6" || model === "vinfast-vf7" || model === "vf7";
  return Boolean(district?.aTier && isVf);
}

export const PATNA_SHOWROOM_LINE =
  "Patliputra VinFast, Plot No. 2421, NH 30, Bypass Road, Paijawa, Patna, Bihar 800009. Monday–Saturday, 10:00–20:00.";
