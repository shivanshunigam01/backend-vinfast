import { useCallback, useEffect, useState } from "react";
import { BarChart3, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatApiErrors } from "@/lib/api";
import {
  fetchDetailedReport,
  type DetailedReport,
  type DetailedReportSummaryBlock,
} from "@/lib/detailedReportApi";
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

function KpiBox({
  title,
  headerClass,
  metrics,
}: {
  title: string;
  headerClass: string;
  metrics: { label: string; value: number }[];
}) {
  return (
    <Card className="overflow-hidden border shadow-sm">
      <div className={cn("px-3 py-2 text-white text-sm font-bold text-center", headerClass)}>{title}</div>
      <div className="divide-y">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-bold tabular-nums">{fmt(m.value)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function tripletMetrics(prefix: string, block: DetailedReportSummaryBlock) {
  return [
    { label: `${prefix} (All)`, value: block.all },
    { label: `${prefix} MTD`, value: block.mtd },
    { label: `${prefix} Today`, value: block.today },
  ];
}

export default function AdminDetailedReport() {
  const [data, setData] = useState<DetailedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const report = await fetchDetailedReport();
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
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading detailed report...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 py-12 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="font-semibold text-lg">Detailed report unavailable</h2>
        <p className="text-sm text-muted-foreground">{loadError ?? "Could not load report data."}</p>
        <Button variant="outline" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  const { summary } = data;
  const mgrTotals = data.salesManagers.reduce(
    (acc, r) => ({
      leads: acc.leads + r.totalLeads,
      td: acc.td + r.totalTestDrive,
      tdMtd: acc.tdMtd + r.totalTestDriveMtd,
      teamTd: acc.teamTd + (r.teamTestDrive ?? 0),
      teamTdMtd: acc.teamTdMtd + (r.teamTestDriveMtd ?? 0),
    }),
    { leads: 0, td: 0, tdMtd: 0, teamTd: 0, teamTdMtd: 0 },
  );
  const execTotals = data.salesExecutives.reduce(
    (acc, r) => ({
      leads: acc.leads + r.totalLeads,
      td: acc.td + r.totalTestDrive,
      tdMtd: acc.tdMtd + r.totalTestDriveMtd,
    }),
    { leads: 0, td: 0, tdMtd: 0 },
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Detailed Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.period.label} · Generated {fmtTime(data.generatedAt)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            MTD = month till date (1st of current month through today). Calls Made Today = follow-ups logged on leads today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI summary boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-3">
        <KpiBox title="Total Leads" headerClass="bg-blue-600" metrics={tripletMetrics("Total Leads", summary.totalLeads)} />
        <KpiBox title="Total Walk-In" headerClass="bg-rose-700" metrics={tripletMetrics("Walk-In", summary.walkIn)} />
        <KpiBox title="Total Digital Leads" headerClass="bg-teal-700" metrics={tripletMetrics("Digital", summary.digital)} />
        <KpiBox
          title="Test Drive"
          headerClass="bg-sky-600"
          metrics={[
            { label: "Test Drive Till Date", value: summary.testDrives.all },
            { label: "Test Drive MTD", value: summary.testDrives.mtd },
            { label: "Test Drive Done Today", value: summary.testDrives.doneToday },
          ]}
        />
        <KpiBox
          title="Booking Count"
          headerClass="bg-violet-700"
          metrics={[{ label: "Booking Count", value: summary.bookingCount }]}
        />
        <KpiBox
          title="Calls Made Today"
          headerClass="bg-indigo-800"
          metrics={[{ label: "Follow-ups Today", value: summary.callsMadeToday }]}
        />
      </div>

      {/* Main tables grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Lead Source */}
        <div className="xl:col-span-3 overflow-x-auto">
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Lead Source</h2>
          <table className="w-full border-collapse min-w-[240px]">
            <thead>
              <tr>
                <th className={cn(TH, "text-left")}>Lead Source</th>
                <th className={TH}>Count</th>
                <th className={TH}>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {data.leadSources.map((row, i) => (
                <tr key={row.source} className={i % 2 ? STRIPE : undefined}>
                  <td className={TD_L}>{row.source}</td>
                  <td className={TD}>{fmt(row.count)}</td>
                  <td className={TD}>{fmt(row.assignedCount)}</td>
                </tr>
              ))}
              <tr className={TOTAL_ROW}>
                <td className={cn(TD_L, "font-bold")}>Total</td>
                <td className={TD}>{fmt(data.leadSourcesTotal.count)}</td>
                <td className={TD}>{fmt(data.leadSourcesTotal.assignedCount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Center: Sales Manager, Sales Executive, Monthly TD */}
        <div className="xl:col-span-6 space-y-4">
          <div className="overflow-x-auto">
            <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Sales Manager</h2>
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  <th className={cn(TH, "text-left")}>Sales Manager</th>
                  <th className={TH}>Total Leads</th>
                  <th className={TH}>Total TD</th>
                  <th className={TH}>TD This Month</th>
                  <th className={TH}>TD By Team</th>
                  <th className={TH}>Team TD MTD</th>
                </tr>
              </thead>
              <tbody>
                {data.salesManagers.map((row, i) => (
                  <tr key={row.staffId} className={i % 2 ? STRIPE : undefined}>
                    <td className={TD_L}>{row.name} ({row.abbr})</td>
                    <td className={TD}>{fmt(row.totalLeads)}</td>
                    <td className={TD}>{fmt(row.totalTestDrive)}</td>
                    <td className={TD}>{fmt(row.totalTestDriveMtd)}</td>
                    <td className={TD}>{fmt(row.teamTestDrive ?? 0)}</td>
                    <td className={TD}>{fmt(row.teamTestDriveMtd ?? 0)}</td>
                  </tr>
                ))}
                {data.salesManagers.length === 0 && (
                  <tr><td colSpan={6} className={cn(TD, "text-muted-foreground")}>No sales managers found</td></tr>
                )}
                <tr className={TOTAL_ROW}>
                  <td className={cn(TD_L, "font-bold")}>TOTAL</td>
                  <td className={TD}>{fmt(mgrTotals.leads)}</td>
                  <td className={TD}>{fmt(mgrTotals.td)}</td>
                  <td className={TD}>{fmt(mgrTotals.tdMtd)}</td>
                  <td className={TD}>{fmt(mgrTotals.teamTd)}</td>
                  <td className={TD}>{fmt(mgrTotals.teamTdMtd)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Sales Executive</h2>
            <table className="w-full border-collapse min-w-[480px]">
              <thead>
                <tr>
                  <th className={cn(TH, "text-left")}>Sales Executive</th>
                  <th className={TH}>Total Leads</th>
                  <th className={TH}>Total TD</th>
                  <th className={TH}>TD This Month</th>
                </tr>
              </thead>
              <tbody>
                {data.salesExecutives.map((row, i) => (
                  <tr key={row.staffId} className={i % 2 ? STRIPE : undefined}>
                    <td className={TD_L}>{row.name} ({row.abbr})</td>
                    <td className={TD}>{fmt(row.totalLeads)}</td>
                    <td className={TD}>{fmt(row.totalTestDrive)}</td>
                    <td className={TD}>{fmt(row.totalTestDriveMtd)}</td>
                  </tr>
                ))}
                {data.salesExecutives.length === 0 && (
                  <tr><td colSpan={4} className={cn(TD, "text-muted-foreground")}>No sales executives found</td></tr>
                )}
                <tr className={TOTAL_ROW}>
                  <td className={cn(TD_L, "font-bold")}>TOTAL</td>
                  <td className={TD}>{fmt(execTotals.leads)}</td>
                  <td className={TD}>{fmt(execTotals.td)}</td>
                  <td className={TD}>{fmt(execTotals.tdMtd)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto max-w-md">
            <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Monthly Performance (Test Drives)</h2>
            <table className="w-full border-collapse">
              <tbody>
                {data.monthlyTestDrives.map((row, i) => (
                  <tr key={row.monthNum} className={i % 2 ? STRIPE : undefined}>
                    <td className={cn(TD_L, "w-1/2")}>Total TD — {row.month}</td>
                    <td className={TD}>{fmt(row.count)}</td>
                  </tr>
                ))}
                <tr className={TOTAL_ROW}>
                  <td className={cn(TD_L, "font-bold")}>TOTAL</td>
                  <td className={cn(TD, "font-bold")}>{fmt(data.monthlyTestDrivesTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Lead Type */}
        <div className="xl:col-span-3 overflow-x-auto">
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wide text-muted-foreground">Lead Type</h2>
          <table className="w-full border-collapse min-w-[200px]">
            <thead>
              <tr>
                <th className={cn(TH, "text-left")}>Lead Type</th>
                <th className={TH}>Count</th>
              </tr>
            </thead>
            <tbody>
              {data.leadTypes.map((row, i) => (
                <tr key={row.leadType} className={i % 2 ? STRIPE : undefined}>
                  <td className={TD_L}>{row.leadType}</td>
                  <td className={TD}>{fmt(row.count)}</td>
                </tr>
              ))}
              {data.leadTypes.length === 0 && (
                <tr><td colSpan={2} className={cn(TD, "text-muted-foreground")}>No lead types recorded</td></tr>
              )}
              <tr className={TOTAL_ROW}>
                <td className={cn(TD_L, "font-bold")}>Total</td>
                <td className={TD}>{fmt(data.leadTypesTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
