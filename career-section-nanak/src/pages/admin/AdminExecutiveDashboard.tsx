import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, RefreshCw, Loader2, Users, Target, CalendarCheck,
  TrendingUp, TrendingDown, Minus, Star, MessageSquare, ArrowRight,
  UserCheck, Pencil, Activity,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser } from "@/lib/adminAuth";
import { fetchExecutiveDashboard, type ExecutiveDashboard } from "@/lib/executiveDashboardApi";
import { STAGE_COLORS, normalizeCrmStage } from "@/lib/leadStages";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#00d4ff", "#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const ACTIVITY_META: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  stage_change: { label: "Stage change", icon: ArrowRight, badge: "bg-blue-500/10 text-blue-500 border-blue-500/25" },
  assignment: { label: "Assignment", icon: UserCheck, badge: "bg-violet-500/10 text-violet-500 border-violet-500/25" },
  follow_up: { label: "Follow-up", icon: MessageSquare, badge: "bg-amber-500/10 text-amber-600 border-amber-500/25" },
  feedback: { label: "Feedback", icon: Star, badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25" },
  edit: { label: "Details edited", icon: Pencil, badge: "bg-cyan-500/10 text-cyan-600 border-cyan-500/25" },
};

function CompareStat({
  label,
  current,
  previous,
  suffix = "",
  icon: Icon,
}: {
  label: string;
  current: number;
  previous: number;
  suffix?: string;
  icon: React.ElementType;
}) {
  const delta = current - previous;
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta > 0 ? "text-green-500" : delta < 0 ? "text-red-400" : "text-muted-foreground";

  return (
    <Card className="bg-card border-border/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1 text-foreground">
            {current}{suffix}
          </p>
          <div className={cn("flex items-center gap-1 mt-1 text-xs", trendColor)}>
            <TrendIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{delta >= 0 ? "+" : ""}{delta}{suffix} vs last year</span>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function bookingStatusBadge(status: string) {
  const map: Record<string, string> = {
    COMPLETED: "bg-green-500/15 text-green-600",
    IN_PROGRESS: "bg-blue-500/15 text-blue-600",
    CONFIRMED: "bg-primary/15 text-primary",
    PENDING: "bg-amber-500/15 text-amber-600",
    CANCELLED: "bg-red-500/15 text-red-500",
    MISSED: "bg-muted text-muted-foreground",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

export default function AdminExecutiveDashboard() {
  const adminUser = getAdminUser();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const report = await fetchExecutiveDashboard(year);
      setData(report);
    } catch (e) {
      setData(null);
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { void load(); }, [load]);

  const pipelineData = useMemo(
    () => (data ? Object.entries(data.leads.pipeline).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })) : []),
    [data],
  );

  const sourceData = useMemo(
    () => (data ? Object.entries(data.leads.bySource).map(([name, value]) => ({ name, value })) : []),
    [data],
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your dashboard...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Could not load dashboard.</p>
        <Button variant="outline" className="mt-4" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  const { leads, leadsCompare, testDrives, testDrivesCompare } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            My Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {adminUser?.name ?? "Executive"} · Leads & test drives assigned to you
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs">
          {data.year}: {fmtDate(data.period.from)} – {fmtDate(data.period.to)}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          All-time: {data.allTime.totalLeads} leads · {data.allTime.totalTestDrives} test drives
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CompareStat
          label={`Leads (${data.year})`}
          current={leads.overview.totalLeads}
          previous={leadsCompare.overview.totalLeads}
          icon={Users}
        />
        <CompareStat
          label={`Test drives (${data.year})`}
          current={testDrives.totalBookings}
          previous={testDrivesCompare.totalBookings}
          icon={CalendarCheck}
        />
        <CompareStat
          label="TD completed"
          current={testDrives.completed}
          previous={testDrivesCompare.completed}
          icon={Target}
        />
        <CompareStat
          label="Conversion rate"
          current={leads.overview.conversionRate}
          previous={leadsCompare.overview.conversionRate}
          suffix="%"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active leads", value: leads.overview.activeLeads },
          { label: "Follow-ups pending", value: leads.followUpSummary.pending },
          { label: "Follow-ups overdue", value: leads.followUpSummary.overdue },
          { label: "TD completion rate", value: `${testDrives.completionRate}%` },
        ].map((item) => (
          <Card key={item.label} className="p-3 border-border/50">
            <p className="text-[11px] text-muted-foreground">{item.label}</p>
            <p className="text-lg font-bold mt-0.5">{item.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 border-border/50">
        <h3 className="font-semibold text-sm mb-4">{data.year} monthly performance</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.monthly}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="leads" name="Leads" stroke="#00d4ff" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="testDrives" name="Test drives" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="testDrivesCompleted" name="TD completed" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="leads">My Leads ({leads.leadDetailRows.length})</TabsTrigger>
          <TabsTrigger value="test-drives">Test Drives ({data.recentBookings.length})</TabsTrigger>
          <TabsTrigger value="compare">Year compare</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4 border-border/50">
              <h3 className="font-semibold text-sm mb-3">Lead pipeline</h3>
              {pipelineData.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pipelineData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                      {pipelineData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No leads in {data.year}</p>
              )}
            </Card>

            <Card className="p-4 border-border/50">
              <h3 className="font-semibold text-sm mb-3">Lead sources</h3>
              {sourceData.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={sourceData} layout="vertical">
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#00d4ff" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No source data</p>
              )}
            </Card>
          </div>

          <Card className="p-4 border-border/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Activity history</h3>
              <Link to="/admin/crm/leads" className="text-xs text-primary hover:underline flex items-center gap-1">
                Open Lead CRM <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {data.leads.activityLog.length ? data.leads.activityLog.map((row, i) => {
                const meta = ACTIVITY_META[row.type] ?? { label: "Activity", icon: Activity, badge: "bg-muted text-muted-foreground" };
                const Icon = meta.icon;
                return (
                  <div key={i} className="flex gap-3 rounded-lg border border-border/40 bg-background/40 p-2.5">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0 h-fit">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-xs">{row.leadName}</span>
                        <span className="text-[10px] text-muted-foreground">{row.leadMobile}</span>
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", meta.badge)}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug break-words">{row.detail}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {row.executiveName} · {fmtDateTime(row.at)}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card className="border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Your leads — {data.year}</h3>
              <Link to="/admin/crm/leads">
                <Button size="sm" variant="outline">Manage leads</Button>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    {["Name", "Mobile", "Model", "Stage", "Source", "Follow-ups", "Updated"].map((h) => (
                      <th key={h} className="text-left p-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.leadDetailRows.length ? leads.leadDetailRows.map((row) => (
                    <tr key={row.leadId} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3">{row.mobile}</td>
                      <td className="p-3">{row.model}</td>
                      <td className="p-3">
                        <Badge className={cn("text-[10px]", STAGE_COLORS[normalizeCrmStage(row.status)] ?? "bg-muted")}>
                          {normalizeCrmStage(row.status)}
                        </Badge>
                      </td>
                      <td className="p-3">{row.source}</td>
                      <td className="p-3">{row.followUpCount}</td>
                      <td className="p-3 text-muted-foreground">{fmtDate(row.updatedAt)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No leads assigned in {data.year}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="test-drives" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: testDrives.totalBookings },
              { label: "Completed", value: testDrives.completed },
              { label: "Pending", value: testDrives.pending },
              { label: "Avg feedback", value: testDrives.avgFeedbackRating || "—" },
            ].map((item) => (
              <Card key={item.label} className="p-3 border-border/50">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold">{item.value}</p>
              </Card>
            ))}
          </div>

          <Card className="border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Recent test drives</h3>
              <Link to="/admin/td/my-bookings">
                <Button size="sm" variant="outline">My test drives</Button>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    {["Booking ID", "Customer", "Mobile", "Model", "Slot", "Status"].map((h) => (
                      <th key={h} className="text-left p-3 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recentBookings.length ? data.recentBookings.map((b) => (
                    <tr key={b.bookingId} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="p-3 font-mono">{b.bookingId}</td>
                      <td className="p-3">{b.customerName}</td>
                      <td className="p-3">{b.mobile}</td>
                      <td className="p-3">{b.model}</td>
                      <td className="p-3">{fmtDate(b.slotDate)} {b.slotTime ?? ""}</td>
                      <td className="p-3">
                        <Badge className={cn("text-[10px]", bookingStatusBadge(b.status))}>{b.status}</Badge>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No test drives assigned</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="mt-4 space-y-4">
          <Card className="p-4 border-border/50">
            <h3 className="font-semibold text-sm mb-4">
              {data.year} vs {data.compareYear} comparison
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 text-muted-foreground font-medium">Metric</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">{data.year}</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">{data.compareYear}</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Total leads", cur: leads.overview.totalLeads, prev: leadsCompare.overview.totalLeads },
                    { label: "Active leads", cur: leads.overview.activeLeads, prev: leadsCompare.overview.activeLeads },
                    { label: "Converted leads", cur: leads.overview.convertedCount, prev: leadsCompare.overview.convertedCount },
                    { label: "Conversion rate (%)", cur: leads.overview.conversionRate, prev: leadsCompare.overview.conversionRate },
                    { label: "Follow-ups completed", cur: leads.overview.followUpsCompleted, prev: leadsCompare.overview.followUpsCompleted },
                    { label: "Test drives booked", cur: testDrives.totalBookings, prev: testDrivesCompare.totalBookings },
                    { label: "Test drives completed", cur: testDrives.completed, prev: testDrivesCompare.completed },
                    { label: "TD completion rate (%)", cur: testDrives.completionRate, prev: testDrivesCompare.completionRate },
                    { label: "Feedback captured", cur: testDrives.feedbackCount, prev: testDrivesCompare.feedbackCount },
                  ].map((row) => {
                    const delta = row.cur - row.prev;
                    return (
                      <tr key={row.label} className="border-b border-border/30">
                        <td className="p-3">{row.label}</td>
                        <td className="p-3 text-right font-semibold">{row.cur}</td>
                        <td className="p-3 text-right text-muted-foreground">{row.prev}</td>
                        <td className={cn("p-3 text-right font-medium", delta > 0 ? "text-green-500" : delta < 0 ? "text-red-400" : "text-muted-foreground")}>
                          {delta >= 0 ? "+" : ""}{delta}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4 border-border/50">
              <h3 className="font-semibold text-sm mb-3">Lead sources — {data.year} vs {data.compareYear}</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={Object.keys({ ...leads.bySource, ...leadsCompare.bySource }).map((name) => ({
                    name,
                    current: leads.bySource[name] || 0,
                    previous: leadsCompare.bySource[name] || 0,
                  }))}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="current" name={String(data.year)} fill="#00d4ff" />
                  <Bar dataKey="previous" name={String(data.compareYear)} fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4 border-border/50">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Feedback summary
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Avg rating ({data.year})</span><span className="font-semibold">{testDrives.avgFeedbackRating || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg purchase intent</span><span className="font-semibold">{testDrives.avgPurchaseIntention || "—"}/5</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Feedback count</span><span className="font-semibold">{testDrives.feedbackCount}</span></div>
              </div>
              {data.leads.feedbackRows.length ? (
                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                  {data.leads.feedbackRows.slice(0, 5).map((fb, i) => (
                    <div key={i} className="text-xs border-t border-border/30 pt-2 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{fb.leadName}</span>
                      <span className="text-muted-foreground">{fb.overallRating}⭐ · intent {fb.purchaseIntention}/5</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
