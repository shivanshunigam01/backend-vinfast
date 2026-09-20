import { adminGet } from "@/lib/api";
import type {
  DetailedReportTeamMatrix,
  DetailedReportTeam,
  DetailedReportTeamMember,
  DetailedReportMatrixRow,
} from "@/lib/detailedReportApi";

export type TeamWiseAssignedLeadsReport = {
  generatedAt: string;
  period: {
    mtdFrom: string;
    mtdTo: string;
    today: string;
    label: string;
  };
  teamMatrix: DetailedReportTeamMatrix;
};

export type {
  DetailedReportTeamMatrix,
  DetailedReportTeam,
  DetailedReportTeamMember,
  DetailedReportMatrixRow,
};

export async function fetchTeamWiseAssignedLeadsReport(): Promise<TeamWiseAssignedLeadsReport> {
  const { data } = await adminGet<TeamWiseAssignedLeadsReport>("/admin/reports/team-assigned-leads");
  if (!data) throw new Error("Team-wise assigned leads report response was empty");
  return data;
}
