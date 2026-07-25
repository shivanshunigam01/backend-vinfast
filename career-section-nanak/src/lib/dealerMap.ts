/**
 * Showroom pin: Near Deedarganj Check Post, NH-30, Patna 800009
 * (same location as https://www.google.com/maps/.../@25.580227,85.248147,...)
 */
const SHOWROOM_LAT = 25.580227;
const SHOWROOM_LNG = 85.248147;

/** Open in Google Maps (mobile app + desktop) — search view at the correct pin. */
export const SHOWROOM_GOOGLE_MAPS_URL =
  "https://www.google.com/maps/search/Near+Deedarganj+Check+Post+NH-30+Patna+800009/@25.580227,85.248147,16z?hl=en-GB&entry=ttu";

/** Reliable iframe embed (no API key) — uses lat/lng so the map matches the pin above. */
const SHOWROOM_EMBED_SRC = `https://www.google.com/maps?q=${SHOWROOM_LAT}%2C${SHOWROOM_LNG}&z=16&hl=en&output=embed`;

/** Extract Google Maps embed `src` from raw iframe HTML, or accept a direct https URL. */
export function mapsEmbedSrc(address: string, mapEmbedUrl?: string): string {
  const raw = (mapEmbedUrl ?? "").trim();
  if (raw) {
    const srcMatch = raw.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch?.[1]?.trim()) return srcMatch[1].trim();
    if (/^https?:\/\//i.test(raw)) return raw;
  }
  return SHOWROOM_EMBED_SRC;
}

/**
 * Link for “open in maps” from address row.
 * Prefers a plain https URL from admin Settings; otherwise uses the fixed Deedarganj NH-30 pin (address text alone can geocode incorrectly).
 */
export function mapsDirectionsHref(_address: string, mapEmbedUrl?: string): string {
  const raw = (mapEmbedUrl ?? "").trim();
  if (raw && /^https?:\/\//i.test(raw) && !/<iframe/i.test(raw)) {
    return raw;
  }
  return SHOWROOM_GOOGLE_MAPS_URL;
}
