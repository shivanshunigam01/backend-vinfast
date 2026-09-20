/**
 * Canonical lead-source options for manual lead entry.
 * Shared by the CRM "Add Lead" dialogs and the lead source filters so the
 * dropdown stays consistent everywhere.
 */
export const LEAD_SOURCE_OPTIONS = [
  "All Bihar Data",
  "Campaign",
  "CarDekho",
  "Management Referral",
  "Meta Ads",
  "Outdoor Activity",
  "Patliputra Vinfast Website",
  "Print Media Advertisement",
  "Prem Sir",
  "Revival Lead",
  "Referral",
  "Social Media",
  "Sunil Sir",
  "Tele-In",
  "Tele-Out",
  "Vinfast Digital",
  "Website Enquiry",
  "WhatsApp",
  "Walk-in",
  "Google Ads",
  "Facebook",
  "Instagram",
  "Zentroverse",
  "Financier",
  // Existing options kept so older leads still appear in filters
  "Google Business Profile",
  "Website",
  "Employee Referral",
  "VinFast India Digital Leads",
  "Event / BTL",
  "Existing Customer Referral",
  "Social Media (YouTube, Facebook, Instagram)",
] as const;

export type LeadSourceOption = (typeof LEAD_SOURCE_OPTIONS)[number];

/** Default source pre-selected in the Add Lead dialogs. */
export const DEFAULT_LEAD_SOURCE: LeadSourceOption = "Walk-in";
