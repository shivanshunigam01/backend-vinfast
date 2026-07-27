/** CRM pipeline stages — keep in sync with backend/constants/leadStages.js */
export const CRM_LEAD_STAGES = [
  "Enquiry",
  "Interested",
  "Test Drive Booked",
  "Test Drive Completed",
  "Negotiation",
  "Booking",
  "Delivered",
  "Lost",
] as const;

export type CrmLeadStage = (typeof CRM_LEAD_STAGES)[number];

const LEGACY_TO_CRM: Record<string, CrmLeadStage> = {
  "New Lead": "Enquiry",
  "Contact Attempted": "Enquiry",
  "Test Drive Scheduled": "Test Drive Booked",
  Booked: "Booking",
  "Not Interested": "Lost",
  TEST_DRIVE_FEEDBACK: "Test Drive Completed",
};

export function normalizeCrmStage(stage: string | undefined | null): string {
  if (!stage) return "Enquiry";
  return LEGACY_TO_CRM[stage] || stage;
}

export const STAGE_COLORS: Record<string, string> = {
  Enquiry: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  Interested: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Test Drive Booked": "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "Test Drive Completed": "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  Negotiation: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  Booking: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  Delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  Lost: "bg-red-500/15 text-red-700 dark:text-red-300",
};
