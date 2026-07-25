import { adminGet } from "@/lib/api";
import type { LeadAdminReport, LeadDetailReportRow, LeadActivityRow, LeadFeedbackReportRow } from "@/lib/leadReportApi";

export type ExecutiveTdStats = {
  totalBookings: number;
  completed: number;
  pending: number;
  cancelled: number;
  missed: number;
  inProgress: number;
  completionRate: number;
  feedbackCount: number;
  avgFeedbackRating: number;
  avgPurchaseIntention: number;
  byModel: Record<string, number>;
};

export type ExecutiveMonthlyRow = {
  month: number;
  label: string;
  leads: number;
  testDrives: number;
  testDrivesCompleted: number;
};

export type ExecutiveRecentBooking = {
  bookingId: string;
  status: string;
  slotDate?: string;
  slotTime?: string;
  model: string;
  customerName: string;
  mobile: string;
};

export type ExecutiveDashboard = {
  year: number;
  compareYear: number;
  period: { from: string; to: string };
  comparePeriod: { from: string; to: string };
  allTime: { totalLeads: number; totalTestDrives: number };
  leads: Pick<
    LeadAdminReport,
    "overview" | "pipeline" | "bySource" | "byModel" | "followUpSummary"
  > & {
    leadDetailRows: LeadDetailReportRow[];
    activityLog: LeadActivityRow[];
    feedbackRows: LeadFeedbackReportRow[];
  };
  leadsCompare: {
    overview: LeadAdminReport["overview"];
    pipeline: Record<string, number>;
    bySource: Record<string, number>;
  };
  testDrives: ExecutiveTdStats;
  testDrivesCompare: ExecutiveTdStats;
  monthly: ExecutiveMonthlyRow[];
  recentBookings: ExecutiveRecentBooking[];
  stages: string[];
};

export async function fetchExecutiveDashboard(year?: number): Promise<ExecutiveDashboard> {
  const q = new URLSearchParams();
  if (year) q.set("year", String(year));
  const { data } = await adminGet<ExecutiveDashboard>(`/admin/crm/leads/reports/me?${q}`);
  return data;
}
