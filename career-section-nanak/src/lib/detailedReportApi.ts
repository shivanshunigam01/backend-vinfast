import { adminGet } from "@/lib/api";

export type DetailedReportSummaryBlock = {
  all: number;
  mtd: number;
  today: number;
};

export type DetailedReportSummary = {
  totalLeads: DetailedReportSummaryBlock;
  walkIn: DetailedReportSummaryBlock;
  digital: DetailedReportSummaryBlock;
  testDrives: { all: number; mtd: number; doneToday: number };
  bookingCount: number;
  callsMadeToday: number;
};

export type DetailedReportLeadSourceRow = {
  source: string;
  count: number;
  assignedCount: number;
  isWalkIn?: boolean;
};

export type DetailedReportStaffRow = {
  staffId: string;
  name: string;
  designation: string;
  abbr: string;
  totalLeads: number;
  totalTestDrive: number;
  totalTestDriveMtd: number;
  teamTestDrive?: number;
  teamTestDriveMtd?: number;
};

export type DetailedReportLeadTypeRow = {
  leadType: string;
  count: number;
};

export type DetailedReportMonthlyTd = {
  month: string;
  monthNum: number;
  count: number;
};

export type DetailedReportTeamMember = {
  staffId: string;
  name: string;
  abbr: string;
  designation: string;
  totalLeads: number;
};

export type DetailedReportTeam = {
  teamId: string;
  managerName: string;
  managerAbbr: string;
  colorClass: string;
  teamTotal: number;
  members: DetailedReportTeamMember[];
};

export type DetailedReportMatrixRow = {
  source: string;
  cells: Record<string, number>;
  rowTotal: number;
};

export type DetailedReportTeamMatrix = {
  teams: DetailedReportTeam[];
  columns: DetailedReportTeamMember[];
  rows: DetailedReportMatrixRow[];
  grandTotal: number;
  columnTotals: Record<string, number>;
};

export type DetailedReport = {
  generatedAt: string;
  period: {
    mtdFrom: string;
    mtdTo: string;
    today: string;
    label: string;
  };
  summary: DetailedReportSummary;
  leadSources: DetailedReportLeadSourceRow[];
  leadSourcesTotal: { count: number; assignedCount: number };
  salesManagers: DetailedReportStaffRow[];
  salesExecutives: DetailedReportStaffRow[];
  leadTypes: DetailedReportLeadTypeRow[];
  leadTypesTotal: number;
  monthlyTestDrives: DetailedReportMonthlyTd[];
  monthlyTestDrivesTotal: number;
};

export async function fetchDetailedReport(): Promise<DetailedReport> {
  const { data } = await adminGet<DetailedReport>("/admin/reports/detailed");
  if (!data) throw new Error("Detailed report response was empty");
  return data;
}
