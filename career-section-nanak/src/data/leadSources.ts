/**
 * Canonical lead-source options for manual lead entry.
 * Shared by the CRM "Add Lead" dialogs and the lead source filters so the
 * dropdown stays consistent everywhere.
 */
export const LEAD_SOURCE_OPTIONS = [
  "Meta Ads",
  "Google Business Profile",
  "Website",
  "Walk-in",
  "Management Referral",
  "Employee Referral",
  "VinFast India Digital Leads",
  "CarDekho",
  "Zentroverse",
  "WhatsApp",
  "Tele-In",
  "Tele-Out",
  "Event / BTL",
  "Outdoor Activity",
  "Existing Customer Referral",
  "Social Media (YouTube, Facebook, Instagram)",
] as const;

export type LeadSourceOption = (typeof LEAD_SOURCE_OPTIONS)[number];

/** Default source pre-selected in the Add Lead dialogs. */
export const DEFAULT_LEAD_SOURCE: LeadSourceOption = "Walk-in";
