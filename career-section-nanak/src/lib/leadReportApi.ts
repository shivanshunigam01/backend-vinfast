import { adminGet } from "@/lib/api";

export type LeadReportOverview = {
  totalLeads: number;
  activeLeads: number;
  unassigned: number;
  convertedCount: number;
  conversionRate: number;
  followUpsPending: number;
  followUpsCompleted: number;
  followUpsOverdue: number;
  feedbackCount: number;
  avgFeedbackRating: number;
  testDrivesBooked: number;
  testDrivesDone: number;
  repeatApprovalsPending: number;
  delayedLeads: number;
  actionRequired: number;
};

export type LeadSourceConversionRow = {
  source: string;
  totalLeads: number;
  convertedCount: number;
  conversionRate: number;
};

export type LeadExecutiveSourceConversion = {
  executiveId: string;
  name: string;
  totalLeads: number;
  convertedCount: number;
  conversionRate: number;
  bySource: LeadSourceConversionRow[];
};

export type LeadExecutivePerformance = {
  executiveId: string | null;
  name: string;
  leadsAssigned: number;
  leadsConverted: number;
  conversionRate: number;
  stageChanges: number;
  followUpsLogged: number;
  followUpsCompleted: number;
  followUpsPending: number;
  followUpsOverdue: number;
  testDrivesCompleted: number;
  feedbackCount: number;
  avgExecutiveBehaviour: number | null;
};

export type LeadActivityRow = {
  type: "stage_change" | "assignment" | "follow_up" | "feedback" | "edit";
  at: string;
  executiveName: string;
  executiveId?: string;
  leadId?: string | null;
  leadName: string;
  leadMobile: string;
  detail: string;
  status?: string;
};

export type LeadFollowUpReportRow = {
  id: string;
  leadId: string | null;
  leadName: string;
  leadMobile: string;
  leadStatus: string;
  executiveName: string;
  note: string;
  scheduledAt?: string;
  completedAt?: string;
  outcome: string;
  status: string;
  createdAt: string;
};

export type LeadFeedbackReportRow = {
  createdAt?: string;
  customerName: string;
  mobile: string;
  leadId: string | null;
  leadName: string;
  leadStatus: string | null;
  executiveName: string;
  bookingId: string;
  model: string;
  overallRating?: number;
  purchaseIntention?: number;
  executiveBehaviour?: number;
  remarks: string;
};

export type LeadAgeingBucket = {
  bucket: string;
  count: number;
};

export type LeadDetailReportRow = {
  leadId: string;
  name: string;
  mobile: string;
  model: string;
  status: string;
  source: string;
  interest: string;
  assignedTo: string;
  assignedToId: string | null;
  followUpCount: number;
  followUpsPending: number;
  lastFollowUp: string | null;
  nextFollowUp: string | null;
  remarks: string;
  feedbackRating: number | null;
  purchaseIntention: number | null;
  converted: boolean;
  ageDays?: number;
  ageBucket?: string;
  // Test drive & completion evidence
  testDriveStatus: "Done" | "Booked" | "Awaiting Approval" | "Not Booked";
  testDriveBooked: boolean;
  testDriveDone: boolean;
  testDriveBookingId: string | null;
  customerPhotoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  testDriveKm: number | null;
  // Management attention
  delayStatus: "Closed" | "Overdue" | "Delayed" | "On Track";
  actionRequired: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadAdminReport = {
  overview: LeadReportOverview;
  pipeline: Record<string, number>;
  bySource: Record<string, number>;
  byModel: Record<string, number>;
  bySourceConversion: LeadSourceConversionRow[];
  sourceConversionByExecutive: LeadExecutiveSourceConversion[];
  executivePerformance: LeadExecutivePerformance[];
  followUpSummary: { pending: number; completed: number; overdue: number; cancelled: number; total: number };
  followUpRows: LeadFollowUpReportRow[];
  activityLog: LeadActivityRow[];
  feedbackRows: LeadFeedbackReportRow[];
  leadDetailRows: LeadDetailReportRow[];
  leadAgeing: LeadAgeingBucket[];
  stages: string[];
};

const EMPTY_REPORT: LeadAdminReport = {
  overview: {
    totalLeads: 0,
    activeLeads: 0,
    unassigned: 0,
    convertedCount: 0,
    conversionRate: 0,
    followUpsPending: 0,
    followUpsCompleted: 0,
    followUpsOverdue: 0,
    feedbackCount: 0,
    avgFeedbackRating: 0,
    testDrivesBooked: 0,
    testDrivesDone: 0,
    repeatApprovalsPending: 0,
    delayedLeads: 0,
    actionRequired: 0,
  },
  pipeline: {},
  bySource: {},
  byModel: {},
  bySourceConversion: [],
  sourceConversionByExecutive: [],
  executivePerformance: [],
  followUpSummary: { pending: 0, completed: 0, overdue: 0, cancelled: 0, total: 0 },
  followUpRows: [],
  activityLog: [],
  feedbackRows: [],
  leadDetailRows: [],
  leadAgeing: [],
  stages: [],
};

function normalizeLeadReport(raw: LeadAdminReport | null | undefined): LeadAdminReport {
  if (!raw) return EMPTY_REPORT;
  return {
    overview: { ...EMPTY_REPORT.overview, ...raw.overview },
    pipeline: raw.pipeline ?? {},
    bySource: raw.bySource ?? {},
    byModel: raw.byModel ?? {},
    bySourceConversion: raw.bySourceConversion ?? [],
    sourceConversionByExecutive: raw.sourceConversionByExecutive ?? [],
    executivePerformance: raw.executivePerformance ?? [],
    followUpSummary: { ...EMPTY_REPORT.followUpSummary, ...raw.followUpSummary },
    followUpRows: raw.followUpRows ?? [],
    activityLog: raw.activityLog ?? [],
    feedbackRows: raw.feedbackRows ?? [],
    leadDetailRows: raw.leadDetailRows ?? [],
    leadAgeing: raw.leadAgeing ?? [],
    stages: raw.stages ?? [],
  };
}

export async function fetchLeadAdminReport(params?: {
  from?: string;
  to?: string;
  executiveId?: string;
}): Promise<LeadAdminReport> {
  const q = new URLSearchParams();
  if (params?.from) q.set("from", params.from);
  if (params?.to) q.set("to", params.to);
  if (params?.executiveId) q.set("executiveId", params.executiveId);
  const { data } = await adminGet<LeadAdminReport>(`/admin/td/leads/reports/admin?${q}`);
  return normalizeLeadReport(data);
}
