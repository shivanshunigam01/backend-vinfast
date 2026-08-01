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

export type ManagerTeamMemberStats = {
  _id: string;
  name: string;
  email?: string;
  designation?: string;
  leads: number;
  openLeads: number;
  testDrives: number;
  completedTestDrives: number;
};

export type ManagerTeamStats = {
  myAssignedLeads: number;
  myAssignedTestDrives: number;
  teamLeads: number;
  teamTestDrives: number;
  pendingLeads: number;
  followUpsDue: number;
  completedTestDrives: number;
  teamCompletedTestDrives: number;
  teamSize: number;
  byMember: ManagerTeamMemberStats[];
};

export type CreDashboardRecentLead = {
  _id: string;
  leadId?: string;
  name: string;
  mobile?: string;
  city?: string;
  area?: string;
  status?: string;
  source?: string;
  model?: string;
  assignedTo?: { _id: string; name?: string; email?: string } | null;
  createdAt?: string;
};

export type CreDashboard = {
  year: number;
  compareYear: number;
  period: { from: string; to: string };
  comparePeriod: { from: string; to: string };
  reportType: "cre";
  cre?: { _id: string; name?: string; email?: string; designation?: string };
  overview: {
    totalCreatedAllTime: number;
    totalCreated: number;
    totalCreatedPrev: number;
    assigned: number;
    unassigned: number;
    assignmentRate: number;
  };
  pipeline: Record<string, number>;
  byLeadType?: Record<string, number>;
  byArea?: Record<string, number>;
  bySource: Record<string, number>;
  byExecutive?: Array<{
    executiveId: string | null;
    name: string;
    count: number;
  }>;
  monthly: Array<{ month: number; label: string; created: number; assigned: number }>;
  recentLeads: CreDashboardRecentLead[];
  stages?: string[];
};

export type ExecutiveDashboard = {
  year: number;
  compareYear: number;
  period: { from: string; to: string };
  comparePeriod: { from: string; to: string };
  allTime: { totalLeads: number; totalTestDrives: number };
  reportType?: "executive" | "manager" | "cre";
  teamStats?: ManagerTeamStats;
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

export type MyDashboardPayload = ExecutiveDashboard | CreDashboard;

export function isCreDashboard(data: MyDashboardPayload | null | undefined): data is CreDashboard {
  return Boolean(data && data.reportType === "cre");
}

export async function fetchExecutiveDashboard(year?: number): Promise<MyDashboardPayload> {
  const q = new URLSearchParams();
  if (year) q.set("year", String(year));
  const { data } = await adminGet<MyDashboardPayload>(`/admin/crm/leads/reports/me?${q}`);
  return data;
}
