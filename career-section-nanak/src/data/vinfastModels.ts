/**
 * Canonical VinFast car catalog — the single source of truth for model/variant
 * options across the website, the test-drive module, and the admin panel.
 *
 *   VF 7   → Sky Infinity, Sky, Wind Infinity, Wind, Earth
 *   VF 6   → Wind Infinity, Wind, Earth
 *   VF MPV 7 → single lineup, no separate trims
 *   Limo Green → single lineup, no separate trims
 */

/** Plain trim names (no model prefix), ordered as in the dealer catalog. */
export const VF7_TRIMS = ["Sky Infinity", "Sky", "Wind Infinity", "Wind", "Earth"] as const;
export const VF6_TRIMS = ["Wind Infinity", "Wind", "Earth"] as const;
/** MPV 7 has no separate trims. */
export const MPV7_TRIMS: readonly string[] = [];
/** Limo Green has no separate trims. */
export const LIMO_GREEN_TRIMS: readonly string[] = [];

/** Full "model + trim" labels stored on leads / bookings / testimonials. */
export const VF7_VARIANT_OPTIONS: readonly string[] = VF7_TRIMS.map((t) => `VF 7 ${t}`);
export const VF6_VARIANT_OPTIONS: readonly string[] = VF6_TRIMS.map((t) => `VF 6 ${t}`);
/** Single-lineup electric MPV — one label for forms. */
export const MPV7_VARIANT_OPTIONS = ["VF MPV 7"] as const;
/** Single-lineup seven-seat electric MPV — one label for forms. */
export const LIMO_GREEN_VARIANT_OPTIONS = ["Limo Green"] as const;

/** Default trims pre-selected in forms (entry trim). */
export const DEFAULT_VF7_TRIM = "VF 7 Earth";
export const DEFAULT_VF6_TRIM = "VF 6 Earth";
export const DEFAULT_MPV7_TRIM = MPV7_VARIANT_OPTIONS[0];
export const DEFAULT_LIMO_GREEN_TRIM = LIMO_GREEN_VARIANT_OPTIONS[0];

/** Base model names. */
export const CAR_MODELS = ["VF 7", "VF 6", "VF MPV 7", "Limo Green"] as const;

/** Plain trims for a base model (used by the demo-fleet form which stores model + variant separately). */
export function trimsForModel(model: string): string[] {
  if (model === "VF 6") return [...VF6_TRIMS];
  if (model === "VF MPV 7") return [...MPV7_TRIMS];
  if (model === "Limo Green") return [...LIMO_GREEN_TRIMS];
  return [...VF7_TRIMS];
}

/** Entry trim for a base model (empty for MPV 7). */
export function defaultTrimForModel(model: string): string {
  return trimsForModel(model)[0] ?? "";
}

/** Contact form: not sure which model. */
export const MODEL_TRIM_COMBO_BOTH = "__BOTH__";

export function encodeModelTrim(model: string, variant: string): string {
  if (model === "Both") return MODEL_TRIM_COMBO_BOTH;
  return variant ? `${model}|${variant}` : `${model}|`;
}

export function decodeModelTrim(raw: string): { model: string; variant: string } {
  if (raw === MODEL_TRIM_COMBO_BOTH) return { model: "Both", variant: "" };
  const i = raw.indexOf("|");
  if (i < 0) return { model: "VF 7", variant: "" };
  return { model: raw.slice(0, i), variant: raw.slice(i + 1) };
}

/** Value stored on leads / bookings / testimonials (single field). */
export function leadModelLabel(model: string, variant: string): string {
  if (model === "Both") return "VF 6 / VF 7";
  return variant || model;
}

/** Map a stored label back to model + variant for the dropdown. */
export function parseStoredModelLine(stored: string): { model: string; variant: string } {
  const s = stored.trim();
  if (!s) return { model: "VF 7", variant: DEFAULT_VF7_TRIM };
  if (s === "VF 6 / VF 7" || s === "VF 6 / VF 7 / VF MPV 7" || s === "Both") return { model: "Both", variant: "" };
  if (VF7_VARIANT_OPTIONS.includes(s)) return { model: "VF 7", variant: s };
  if (VF6_VARIANT_OPTIONS.includes(s)) return { model: "VF 6", variant: s };
  if ((MPV7_VARIANT_OPTIONS as readonly string[]).includes(s)) return { model: "VF MPV 7", variant: s };
  if ((LIMO_GREEN_VARIANT_OPTIONS as readonly string[]).includes(s)) return { model: "Limo Green", variant: s };
  if (s === "VF 7") return { model: "VF 7", variant: DEFAULT_VF7_TRIM };
  if (s === "VF 6") return { model: "VF 6", variant: DEFAULT_VF6_TRIM };
  if (s === "VF MPV 7") return { model: "VF MPV 7", variant: DEFAULT_MPV7_TRIM };
  if (s === "Limo Green") return { model: "Limo Green", variant: DEFAULT_LIMO_GREEN_TRIM };
  return { model: "VF 7", variant: DEFAULT_VF7_TRIM };
}
