/**
 * Exterior / interior colour options for stock & PO forms
 * (dealer colour matrix — VF 6/7, MPV 7, Limo Green).
 */

/** Shared VF 6 / VF 7 exterior palette (website + product CMS). */
export const VF6_VF7_EXTERIOR_COLOURS = [
  "Infinity Blanc",
  "Crimson Red",
  "Jet Black",
  "Desat Silver",
  "Zenith Grey",
  "Urban Mint",
] as const;

export const MPV7_EXTERIOR_COLOURS = [
  "Jet Black",
  "Introspective Brown",
  "Solar Ruby",
  "Moonlit Ocean",
  "Zenith Grey",
  "Infinity Blanc",
] as const;

export const LIMO_GREEN_EXTERIOR_COLOURS = [
  "Jet Black",
  "Solar Ruby",
  "Infinity Blanc",
  "Desat Silver",
] as const;

export const MPV_LIMO_INTERIOR_COLOURS = ["Black", "Dual Tone"] as const;

/** Exterior paint options for a stock model (legacy alias). */
export function exteriorColoursForModel(model: string): string[] {
  return exteriorColoursFor(model);
}

/**
 * Exterior paint options for model + optional trim.
 * VF 6/7 share one palette; MPV 7 & Limo Green have their own lists.
 */
export function exteriorColoursFor(model: string, variant = ""): string[] {
  if (model === "VF 6" || model === "VF 7") {
    return [...VF6_VF7_EXTERIOR_COLOURS];
  }
  if (model === "VF MPV 7") return [...MPV7_EXTERIOR_COLOURS];
  if (model === "Limo Green") return [...LIMO_GREEN_EXTERIOR_COLOURS];
  void variant;
  return [];
}

/**
 * Interior colour options.
 * VF 6 / VF 7: Earth → Beige; all other trims → Mocha Brown.
 * MPV 7 / Limo Green: Black or Dual Tone.
 */
export function interiorColoursFor(model: string, variant: string): string[] {
  if (model === "VF 6" || model === "VF 7") {
    return variant === "Earth" ? ["Beige"] : ["Mocha Brown"];
  }
  if (model === "VF MPV 7" || model === "Limo Green") {
    return [...MPV_LIMO_INTERIOR_COLOURS];
  }
  return [];
}

/** VF 7 Sky / Sky Infinity are dual-motor — two motor numbers. */
export function needsDualMotorNumbers(model: string, variant: string): boolean {
  return model === "VF 7" && (variant === "Sky Infinity" || variant === "Sky");
}
