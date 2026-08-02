import { adminGet } from "@/lib/api";
import type { ReportPeriod } from "@/components/admin/ReportPeriodPresets";
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
  leadsCount: number;
  /** @deprecated use leadsCount */
  leads?: number;
  openLeads: number;
  testDrives: number;
  tdCompleted: number;
  /** @deprecated use tdCompleted */
  completedTestDrives?: number;
  converted: number;
  delivered: number;
  followUpsDue: number;
  conversionRate: number;
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

export type ManagerTeamBlock = {
  leadsCount: number;
  tdCompleted: number;
  converted: number;
  delivered: number;
  followUpsDue: number;
  conversionRate: number;
  teamSize: number;
  teamLeads?: number;
  teamTestDrives?: number;
  pendingLeads?: number;
  teamCompletedTestDrives?: number;
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
  period: { from: string; to: string; period?: string };
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

export type ExecutiveDashboardCore = {
  year: number;
  compareYear: number;
  period: { from: string; to: string; period?: string };
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

export type ExecutiveDashboard = ExecutiveDashboardCore & {
  reportType?: "executive" | "manager" | "cre";
  view?: "manager" | "executive";
  teamStats?: ManagerTeamStats;
  self?: ExecutiveDashboardCore;
  team?: ManagerTeamBlock;
};

export type MyDashboardPayload = ExecutiveDashboard | CreDashboard;

export function isCreDashboard(data: MyDashboardPayload | null | undefined): data is CreDashboard {
  if (!data) return false;
  if (data.reportType === "cre") return true;
  const raw = data as Record<string, unknown>;
  const hasCreShape =
    Boolean(raw.cre || raw.recentLeads) ||
    Boolean(
      raw.overview &&
        typeof raw.overview === "object" &&
        "totalCreated" in (raw.overview as Record<string, unknown>),
    );
  const hasExecLeads =
    raw.leads &&
    typeof raw.leads === "object" &&
    "overview" in (raw.leads as Record<string, unknown>);
  return hasCreShape && !hasExecLeads;
}

function readPipelineMap(data: MyDashboardPayload | null | undefined): Record<string, number> {
  if (!data || typeof data !== "object") return {};
  const raw = data as Record<string, unknown>;
  const nested = raw.leads;
  if (nested && typeof nested === "object") {
    const p = (nested as Record<string, unknown>).pipeline;
    if (p && typeof p === "object") return p as Record<string, number>;
  }
  if (raw.pipeline && typeof raw.pipeline === "object") {
    return raw.pipeline as Record<string, number>;
  }
  return {};
}

function readBySourceMap(data: MyDashboardPayload | null | undefined): Record<string, number> {
  if (!data || typeof data !== "object") return {};
  const raw = data as Record<string, unknown>;
  const nested = raw.leads;
  if (nested && typeof nested === "object") {
    const s = (nested as Record<string, unknown>).bySource;
    if (s && typeof s === "object") return s as Record<string, number>;
  }
  if (raw.bySource && typeof raw.bySource === "object") {
    return raw.bySource as Record<string, number>;
  }
  return {};
}

export type DashboardPeriodQuery = {
  period?: ReportPeriod;
  from?: string;
  to?: string;
  year?: number;
};

export async function fetchExecutiveDashboard(
  opts: number | DashboardPeriodQuery = {},
): Promise<MyDashboardPayload> {
  const q = new URLSearchParams();
  if (typeof opts === "number") {
    q.set("year", String(opts));
  } else {
    if (opts.period) q.set("period", opts.period);
    if (opts.from) q.set("from", opts.from);
    if (opts.to) q.set("to", opts.to);
    if (opts.year) q.set("year", String(opts.year));
  }
  const { data } = await adminGet<MyDashboardPayload>(`/admin/crm/leads/reports/me?${q}`);
  if (!data) {
    throw new Error("Dashboard response was empty");
  }
  if (isCreDashboard(data) && data.reportType !== "cre") {
    return { ...data, reportType: "cre" };
  }
  return data;
}

export { readPipelineMap, readBySourceMap };
