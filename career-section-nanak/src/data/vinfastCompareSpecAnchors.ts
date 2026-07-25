/**
 * Single source for 0–100 km/h figures used on model pages and the Compare tool.
 * VF 6 Earth is slower (10.4 s) than Wind / Wind Infinity (8.9 s) — keep catalog + pages in sync here only.
 */
export const VF6_TRIM_0_100_KMH = {
  earth: "10.4 s",
  wind: "8.9 s",
  infinity: "8.9 s",
} as const;

export const VF7_TRIM_0_100_KMH = {
  earth: "9.1 s",
  wind: "8.5 s",
  windInfinity: "8.5 s",
  sky: "5.8 s",
  skyInfinity: "5.8 s",
} as const;
