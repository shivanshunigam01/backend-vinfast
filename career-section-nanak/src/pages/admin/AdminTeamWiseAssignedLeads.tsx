import { useCallback, useEffect, useState } from "react";
import { Grid3x3, RefreshCw, Loader2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatApiErrors } from "@/lib/api";
import {
  fetchTeamWiseAssignedLeadsReport,
  type TeamWiseAssignedLeadsReport,
} from "@/lib/teamWiseAssignedLeadsApi";
import { cn } from "@/lib/utils";

const TH = "bg-slate-800 text-white text-xs font-bold uppercase tracking-wide px-2 py-2 border border-slate-700 text-center";
const TD = "px-2 py-1.5 border border-slate-200 text-center text-sm tabular-nums";
const TD_L = "px-2 py-1.5 border border-slate-200 text-sm";
const TOTAL_ROW = "bg-amber-100 font-semibold";
const STRIPE = "bg-slate-50/80";

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function downloadTeamMatrixCsv(report: TeamWiseAssignedLeadsReport) {
  const { teamMatrix } = report;
  const header = [
    "Lead Source",
    ...teamMatrix.columns.map((c) => `${c.name} (${c.abbr})`),
    "Source Wise Total",
  ];
  const lines = [header.join(",")];
  for (const row of teamMatrix.rows) {
    const cells = [
      row.source,
      ...teamMatrix.columns.map((c) => String(row.cells[c.staffId] ?? 0)),
      String(row.rowTotal),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  const totals = [
    "TOTAL",
    ...teamMatrix.columns.map((c) => String(teamMatrix.columnTotals[c.staffId] ?? 0)),
    String(teamMatrix.grandTotal),
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
  lines.push(totals.join(","));

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `team-wise-assigned-leads-${report.period.today}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminTeamWiseAssignedLeads() {
  const [data, setData] = useState<TeamWiseAssignedLeadsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const report = await fetchTeamWiseAssignedLeadsReport();
      setData(report);
    } catch (e) {
      setData(null);
      const msg = formatApiErrors(e);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading team-wise assigned leads...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 py-12 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="font-semibold text-lg">Report unavailable</h2>
        <p className="text-sm text-muted-foreground">{loadError ?? "Could not load report data."}</p>
        <Button variant="outline" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  const { teamMatrix } = data;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Grid3x3 className="w-7 h-7 text-primary" />
            Team Wise Total Assigned Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.period.label} · Generated {fmtTime(data.generatedAt)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Assigned lead counts by source and sales team member. Scroll horizontally to view all staff columns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadTeamMatrixCsv(data)}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">
          {teamMatrix.columns.length} staff · {teamMatrix.rows.length} lead sources
        </span>
        <span className="text-sm text-muted-foreground">
          Grand total: <strong className="text-foreground">{fmt(teamMatrix.grandTotal)}</strong>
        </span>
      </div>

      <div className="overflow-x-auto border rounded-lg shadow-sm bg-card">
        <table className="border-collapse min-w-max w-full text-sm">
          <thead>
            <tr>
              <th rowSpan={3} className={cn(TH, "sticky left-0 z-20 min-w-[160px] text-left align-bottom")}>
                Lead Source
              </th>
              {teamMatrix.teams.map((team) => (
                <th
                  key={team.teamId}
                  colSpan={team.members.length}
                  className={cn("px-2 py-2 border border-slate-300 text-center font-bold text-slate-900", team.colorClass)}
                >
                  {team.managerName} ({team.managerAbbr}) — {fmt(team.teamTotal)}
                </th>
              ))}
              <th rowSpan={3} className={cn(TH, "align-bottom min-w-[96px] bg-blue-900")}>
                <div>Source Wise Total</div>
                <div className="text-lg mt-1">{fmt(teamMatrix.grandTotal)}</div>
              </th>
            </tr>
            <tr>
              {teamMatrix.columns.map((col) => (
                <th key={`tot-${col.staffId}`} className="px-1 py-1 border border-slate-300 text-center text-xs font-semibold bg-slate-100 tabular-nums">
                  {fmt(teamMatrix.columnTotals[col.staffId] ?? 0)}
                </th>
              ))}
            </tr>
            <tr>
              {teamMatrix.columns.map((col) => (
                <th key={col.staffId} className="px-1 py-2 border border-slate-700 bg-slate-800 text-white text-[10px] sm:text-xs font-semibold text-center min-w-[72px] whitespace-nowrap">
                  {col.name}<br />({col.abbr})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teamMatrix.rows.map((row, i) => (
              <tr key={row.source} className={i % 2 ? STRIPE : undefined}>
                <td className={cn(TD_L, "sticky left-0 z-10 bg-inherit font-medium")}>{row.source}</td>
                {teamMatrix.columns.map((col) => (
                  <td key={col.staffId} className={TD}>
                    {row.cells[col.staffId] ? fmt(row.cells[col.staffId]) : "—"}
                  </td>
                ))}
                <td className={cn(TD, "font-semibold bg-blue-50")}>{fmt(row.rowTotal)}</td>
              </tr>
            ))}
            {teamMatrix.rows.length === 0 && (
              <tr>
                <td colSpan={teamMatrix.columns.length + 2} className={cn(TD, "text-muted-foreground py-8")}>
                  No assigned leads found
                </td>
              </tr>
            )}
            <tr className={TOTAL_ROW}>
              <td className={cn(TD_L, "sticky left-0 z-10 font-bold")}>TOTAL</td>
              {teamMatrix.columns.map((col) => (
                <td key={col.staffId} className={cn(TD, "font-bold")}>
                  {fmt(teamMatrix.columnTotals[col.staffId] ?? 0)}
                </td>
              ))}
              <td className={cn(TD, "font-bold bg-blue-100")}>{fmt(teamMatrix.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
