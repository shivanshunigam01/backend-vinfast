import { DEFAULT_VF6_TRIM, DEFAULT_VF7_TRIM, DEFAULT_MPV7_TRIM, DEFAULT_LIMO_GREEN_TRIM } from "@/data/vinfastModels";
import { BIHAR_DISTRICTS, DISTRICT_OTHER } from "@/data/biharDistricts";
import { getSeoDistrict } from "@/data/seoDistricts";

export type SeoAttribution = {
  district: string;
  model: string;
  intent: string;
  page: string;
};

export function buildCtaPath(
  base: string,
  opts: { district?: string; model?: string; intent?: string; page?: string },
) {
  const q = new URLSearchParams();
  if (opts.district) q.set("district", opts.district);
  if (opts.model) q.set("model", opts.model);
  if (opts.intent) q.set("intent", opts.intent);
  if (opts.page) q.set("page", opts.page);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export function readSeoAttribution(searchParams: URLSearchParams): SeoAttribution {
  return {
    district: searchParams.get("district")?.trim() || "",
    model: searchParams.get("model")?.trim() || "",
    intent: searchParams.get("intent")?.trim() || "",
    page: searchParams.get("page")?.trim() || "",
  };
}

export function attributionFromPathname(pathname: string): Partial<SeoAttribution> {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 1 && getSeoDistrict(parts[0])) {
    return { district: parts[0], page: `/${parts[0]}` };
  }
  if (parts.length === 2 && getSeoDistrict(parts[0])) {
    return { district: parts[0], model: parts[1], page: `/${parts[0]}/${parts[1]}` };
  }
  return { page: pathname };
}

export function formatAttributionRemarks(attrs: Partial<SeoAttribution>) {
  const parts: string[] = [];
  if (attrs.district) parts.push(`SEO district: ${attrs.district}`);
  if (attrs.page) parts.push(`SEO page: ${attrs.page}`);
  if (attrs.intent) parts.push(`SEO intent: ${attrs.intent}`);
  return parts.join(" | ");
}

export function mapSeoModelToForm(raw: string): { model: string; variant: string } | null {
  const n = raw.toLowerCase().replace(/\s+/g, " ").replace(/_/g, "-");
  if (n === "vf6" || n === "vf 6" || n === "vinfast-vf6" || n === "vinfast vf6") {
    return { model: "VF 6", variant: DEFAULT_VF6_TRIM };
  }
  if (n === "vf7" || n === "vf 7" || n === "vinfast-vf7" || n === "vinfast vf7") {
    return { model: "VF 7", variant: DEFAULT_VF7_TRIM };
  }
  if (n === "mpv7" || n === "vf mpv 7" || n === "vinfast-mpv7" || n === "vinfast mpv7") {
    return { model: "VF MPV 7", variant: DEFAULT_MPV7_TRIM };
  }
  if (n === "limo green" || n === "limo-green" || n === "vinfast-limo-green") {
    return { model: "Limo Green", variant: DEFAULT_LIMO_GREEN_TRIM };
  }
  return null;
}

export function mapSeoDistrictToForm(slugOrName: string): { city: string; otherCity: string } | null {
  if (!slugOrName) return null;
  const fromSlug = getSeoDistrict(slugOrName);
  if (fromSlug) {
    const match = BIHAR_DISTRICTS.find((n) => n.toLowerCase() === fromSlug.name.toLowerCase());
    return { city: match || fromSlug.name, otherCity: "" };
  }
  const match = BIHAR_DISTRICTS.find((n) => n.toLowerCase() === slugOrName.toLowerCase());
  if (match) return { city: match, otherCity: "" };
  if (slugOrName.toLowerCase() === "other") return { city: DISTRICT_OTHER, otherCity: "" };
  return null;
}
