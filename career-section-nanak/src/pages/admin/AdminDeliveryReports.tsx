import { useCallback, useEffect, useState } from "react";
import {
  PackageCheck, RefreshCw, Loader2, Download, Users, Car, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReportPeriodPresets, { type ReportPeriod } from "@/components/admin/ReportPeriodPresets";
import { formatApiErrors } from "@/lib/api";
import { fetchDeliveryReport, type DeliveryReport } from "@/lib/deliveryReportApi";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function downloadCsv(report: DeliveryReport) {
  const header = ["Lead ID", "Name", "Mobile", "Model", "Source", "Executive", "Delivery Date"];
  const lines = [header.join(",")];
  for (const row of report.rows) {
    const cells = [
      row.leadId,
      row.name,
      row.mobile,
      row.model,
      row.source,
      row.executiveName,
      row.deliveryDate ? row.deliveryDate.slice(0, 10) : "",
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `delivery-report-${report.from}-${report.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDeliveryReports() {
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<DeliveryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const report = await fetchDeliveryReport({
        period,
        from: from || undefined,
        to: to || undefined,
      });
      setData(report);
    } catch (e) {
      setData(null);
      const msg = formatApiErrors(e);
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [period, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading delivery reports...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 py-12 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="font-semibold text-lg">Delivery reports unavailable</h2>
        <p className="text-sm text-muted-foreground">{loadError ?? "Could not load report data."}</p>
        <Button variant="outline" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <PackageCheck className="w-7 h-7 text-primary" />
            Delivery Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Delivered leads · {fmtDate(data.from)} – {fmtDate(data.to)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(data)}
            disabled={!data.rows.length}
          >
            <Download className="w-4 h-4 mr-1.5" /> Export CSV
          </Button>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border/50 p-4">
        <ReportPeriodPresets
          value={period}
          onChange={(p) => {
            setPeriod(p);
            setFrom("");
            setTo("");
          }}
          from={from}
          to={to}
          onRangeChange={({ from: f, to: t }) => {
            setFrom(f);
            setTo(t);
          }}
        />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50 p-4">
          <p className="text-xs text-muted-foreground">Total deliveries</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{data.totalDeliveries}</p>
        </Card>
        <Card className="bg-card border-border/50 p-4">
          <p className="text-xs text-muted-foreground">Executives with deliveries</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{data.byExecutive.length}</p>
        </Card>
        <Card className="bg-card border-border/50 p-4">
          <p className="text-xs text-muted-foreground">Models delivered</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{data.byModel.length}</p>
        </Card>
      </div>

      {data.byPeriod.length > 0 ? (
        <Card className="bg-card border-border/50 p-4">
          <h2 className="font-semibold text-sm mb-3">Deliveries by period ({data.bucketUnit})</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.byPeriod}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Deliveries" fill="#00d4ff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      ) : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border/50 p-4">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> By executive
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                  <th className="pb-2 pr-3 font-medium">Executive</th>
                  <th className="pb-2 font-medium text-right">Deliveries</th>
                </tr>
              </thead>
              <tbody>
                {data.byExecutive.length ? (
                  data.byExecutive.map((row) => (
                    <tr key={row.executiveId || row.name} className="border-b border-border/30">
                      <td className="py-2 pr-3">{row.name}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">{row.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-muted-foreground text-xs">
                      No deliveries in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="bg-card border-border/50 p-4">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Car className="w-4 h-4 text-primary" /> By model
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                  <th className="pb-2 pr-3 font-medium">Model</th>
                  <th className="pb-2 font-medium text-right">Deliveries</th>
                </tr>
              </thead>
              <tbody>
                {data.byModel.length ? (
                  data.byModel.map((row) => (
                    <tr key={row.model} className="border-b border-border/30">
                      <td className="py-2 pr-3">{row.model}</td>
                      <td className="py-2 text-right tabular-nums font-semibold">{row.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="py-6 text-center text-muted-foreground text-xs">
                      No deliveries in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="bg-card border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h2 className="font-semibold text-sm">Delivery detail ({data.rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {["Name", "Mobile", "Model", "Source", "Executive", "Delivery date"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.length ? (
                data.rows.map((row) => (
                  <tr key={row._id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3 font-mono">{row.mobile}</td>
                    <td className="p-3">{row.model}</td>
                    <td className="p-3">{row.source}</td>
                    <td className="p-3">{row.executiveName}</td>
                    <td className="p-3 text-muted-foreground">{fmtDate(row.deliveryDate)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No delivered leads in this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
