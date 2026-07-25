import { isMongoId } from "@/lib/apiMappers";

const SPEC_KEYS = [
  "range",
  "battery",
  "power",
  "torque",
  "topSpeed",
  "driveType",
  "fastCharge",
  "homeCharge",
  "safety",
  "airbags",
  "adas",
  "touchscreen",
  "variants",
] as const;

export type AdminProductRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  priceFrom: string;
  range: string;
  battery: string;
  power: string;
  torque: string;
  topSpeed: string;
  driveType: string;
  fastCharge: string;
  homeCharge: string;
  safety: string;
  airbags: string;
  adas: string;
  touchscreen: string;
  variants: string;
  heroImage: string;
  galleryImages: string[];
  colorVariants: { name: string; hex: string; image: string }[];
  brochureUrl: string;
  active: boolean;
};

function specsFromDoc(specs: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!specs || typeof specs !== "object") return out;
  const o = specs as Record<string, unknown>;
  for (const k of SPEC_KEYS) {
    if (o[k] != null) out[k] = String(o[k]);
  }
  return out;
}

export function adminProductFromApi(doc: Record<string, unknown>): AdminProductRow {
  const sp = specsFromDoc(doc.specs);
  const colors = Array.isArray(doc.colorVariants)
    ? (doc.colorVariants as Record<string, unknown>[]).map((c) => ({
        name: String(c.name ?? ""),
        hex: String(c.hex ?? "#888888"),
        image: String(c.image ?? ""),
      }))
    : [];
  return {
    id: String(doc._id ?? ""),
    slug: String(doc.slug ?? ""),
    name: String(doc.name ?? ""),
    tagline: String(doc.tagline ?? ""),
    priceFrom: String(doc.priceFrom ?? ""),
    range: sp.range ?? "",
    battery: sp.battery ?? "",
    power: sp.power ?? "",
    torque: sp.torque ?? "",
    topSpeed: sp.topSpeed ?? "",
    driveType: sp.driveType ?? "",
    fastCharge: sp.fastCharge ?? "",
    homeCharge: sp.homeCharge ?? "",
    safety: sp.safety ?? "5-Star NCAP",
    airbags: sp.airbags ?? "6 Airbags",
    adas: sp.adas ?? "",
    touchscreen: sp.touchscreen ?? "",
    variants: sp.variants ?? "",
    heroImage: String(doc.heroImage ?? ""),
    galleryImages: Array.isArray(doc.galleryImages) ? (doc.galleryImages as string[]).map(String) : [],
    colorVariants: colors.length ? colors : [{ name: "", hex: "#000000", image: "" }],
    brochureUrl: String(doc.brochureUrl ?? ""),
    active: doc.active !== false,
  };
}

export function adminProductToApiPayload(p: AdminProductRow): Record<string, unknown> {
  const specs: Record<string, string> = {};
  for (const k of SPEC_KEYS) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) specs[k] = v.trim();
  }
  return {
    name: p.name.trim(),
    slug: p.slug.trim().toLowerCase(),
    tagline: p.tagline.trim(),
    priceFrom: p.priceFrom.trim(),
    active: p.active,
    heroImage: p.heroImage || undefined,
    galleryImages: p.galleryImages.filter(Boolean),
    colorVariants: p.colorVariants.filter((c) => c.name.trim()),
    brochureUrl: p.brochureUrl.trim() || undefined,
    specs,
  };
}

export function slugifyFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/vinfast/gi, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "model"
  );
}

export type AdminOfferRow = {
  id: string;
  title: string;
  description: string;
  model: string;
  validTill: string;
  active: boolean;
  type: string;
  imageUrl?: string;
};

export function adminOfferFromApi(doc: Record<string, unknown>): AdminOfferRow {
  const vt = doc.validTill ? new Date(String(doc.validTill)).toISOString().slice(0, 10) : "";
  return {
    id: String(doc._id ?? ""),
    title: String(doc.title ?? ""),
    description: String(doc.description ?? ""),
    model: String(doc.model ?? "All Models"),
    validTill: vt,
    active: doc.active !== false,
    type: String(doc.type ?? "Promo"),
    imageUrl: doc.imageUrl ? String(doc.imageUrl) : "",
  };
}

export function adminOfferToApiPayload(o: AdminOfferRow): Record<string, unknown> {
  return {
    title: o.title.trim(),
    description: o.description.trim(),
    model: o.model.trim() || undefined,
    type: o.type.trim() || undefined,
    validTill: o.validTill ? new Date(`${o.validTill}T12:00:00`).toISOString() : undefined,
    active: o.active,
    imageUrl: o.imageUrl?.trim() || undefined,
  };
}

export type AdminBannerRow = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  link: string;
  active: boolean;
  order: number;
};

export function adminBannerFromApi(doc: Record<string, unknown>): AdminBannerRow {
  return {
    id: String(doc._id ?? ""),
    title: String(doc.title ?? ""),
    subtitle: String(doc.subtitle ?? ""),
    imageUrl: String(doc.imageUrl ?? ""),
    link: String(doc.ctaLink ?? doc.link ?? "/"),
    active: doc.active !== false,
    order: Number(doc.order ?? 0),
  };
}

export function adminBannerToApiPayload(b: AdminBannerRow): Record<string, unknown> {
  return {
    title: b.title.trim(),
    subtitle: b.subtitle.trim(),
    imageUrl: b.imageUrl.trim() || undefined,
    ctaLink: b.link.trim() || "/",
    ctaLabel: b.title.trim() || "Learn more",
    active: b.active,
    order: b.order,
  };
}

export type AdminFaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string;
  active?: boolean;
  order?: number;
};

export function adminFaqFromApi(doc: Record<string, unknown>): AdminFaqRow {
  return {
    id: String(doc._id ?? ""),
    question: String(doc.question ?? ""),
    answer: String(doc.answer ?? ""),
    category: String(doc.category ?? "General"),
    active: doc.active !== false,
    order: Number(doc.order ?? 0),
  };
}

export function adminFaqToApiPayload(f: AdminFaqRow): Record<string, unknown> {
  return {
    question: f.question.trim(),
    answer: f.answer.trim(),
    category: f.category.trim() || "General",
    active: f.active !== false,
    order: f.order ?? 0,
  };
}

export type AdminTestimonialRow = {
  id: string;
  name: string;
  city: string;
  model: string;
  rating: number;
  text: string;
  photo: string;
  active: boolean;
  order: number;
};

export function adminTestimonialFromApi(doc: Record<string, unknown>): AdminTestimonialRow {
  const des = String(doc.designation ?? "");
  const parts = des.split(" · ");
  const city = parts[0]?.trim() || "Bihar";
  const model = parts[1]?.trim() || "VF 7";
  return {
    id: String(doc._id ?? ""),
    name: String(doc.name ?? ""),
    city,
    model,
    rating: Math.min(5, Math.max(1, Number(doc.rating ?? 5))),
    text: String(doc.quote ?? ""),
    photo: String(doc.imageUrl ?? ""),
    active: doc.active !== false,
    order: Number(doc.order ?? 0),
  };
}

export function adminTestimonialToApiPayload(t: AdminTestimonialRow): Record<string, unknown> {
  return {
    name: t.name.trim(),
    designation: `${t.city.trim()} · ${t.model.trim()}`.trim(),
    quote: t.text.trim(),
    rating: t.rating,
    imageUrl: t.photo.trim() || undefined,
    active: t.active !== false,
    order: t.order ?? 0,
  };
}

export { isMongoId };
