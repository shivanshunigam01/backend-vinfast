import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, RefreshCw, Loader2, Users, Target, MessageSquare,
  CalendarClock, Star, UserCheck, ArrowLeft, AlertTriangle, CheckCircle2, Activity, Timer, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { fetchAssignableStaffUsers, type AssignableStaffUser } from "@/lib/leadCrmApi";
import ReportPeriodPresets, { type ReportPeriod } from "@/components/admin/ReportPeriodPresets";
import ReportStageSourceFilters from "@/components/admin/ReportStageSourceFilters";
import { resolvePeriodRange } from "@/lib/reportPeriod";
import { fetchLeadAdminReport,
  type LeadAdminReport,
  type LeadActivityRow,
  type LeadDetailReportRow,
  type LeadFollowUpReportRow,
  type LeadFeedbackReportRow,
} from "@/lib/leadReportApi";
import { CRM_IMPORT_MODEL_OPTIONS } from "@/lib/pvLeadCrmApi";
import { fetchBuyerTypes, type BuyerTypeDoc } from "@/lib/buyerTypesApi";
import { STAGE_COLORS, normalizeCrmStage } from "@/lib/leadStages";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#00d4ff", "#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const TERMINAL_LEAD_STAGES = new Set(["Delivered", "Lost", "Not Interested"]);

const AGE_BUCKET_COLORS: Record<string, string> = {
  "0-3 Days": "#10b981",
  "4-7 Days": "#f59e0b",
  "8-15 Days": "#f97316",
  "15+ Days": "#ef4444",
};

const AGE_BUCKET_TEXT: Record<string, string> = {
  "0-3 Days": "text-green-400",
  "4-7 Days": "text-yellow-400",
  "8-15 Days": "text-orange-400",
  "15+ Days": "text-red-400",
};

const StatCard = ({
  label, value, icon: Icon, color = "text-primary", sub, onClick,
}: { label: string; value: string | number; icon: React.ElementType; color?: string; sub?: string; onClick?: () => void }) => (
  <Card
    className={`bg-card border-border/50 p-4 ${onClick ? "cursor-pointer hover:bg-secondary/20 transition-colors" : ""}`}
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
      </div>
      <div className={`p-2 rounded-lg bg-primary/10 ${color}`}><Icon className="w-5 h-5" /></div>
    </div>
  </Card>
);

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

const WALK_IN_SOURCES = new Set([
  "Walk-in", "Walk-In", "Walk in", "Executive", "Tele-In", "Tele-Out",
  "Event / BTL", "Outdoor Activity", "Management Referral", "Employee Referral", "Existing Customer Referral",
]);

function isWalkInSource(source?: string) {
  const s = String(source || "").trim();
  if (WALK_IN_SOURCES.has(s)) return true;
  return /^walk[\s-]?in$/i.test(s);
}

function kpiLeadRows(key: string, rows: LeadDetailReportRow[]): LeadDetailReportRow[] {
  switch (key) {
    case "walkIn":
      return rows.filter((r) => isWalkInSource(r.source));
    case "digital":
      return rows.filter((r) => !isWalkInSource(r.source));
    case "negotiation":
      return rows.filter((r) => r.status === "Negotiation");
    case "bookings":
      return rows.filter((r) => r.status === "Booking" || r.status === "Delivered");
    case "deliveries":
      return rows.filter((r) => r.status === "Delivered");
    case "lost":
      return rows.filter((r) => r.status === "Lost");
    case "tdBooked":
      return rows.filter((r) => r.testDriveBooked);
    case "tdCompleted":
      return rows.filter((r) => r.testDriveDone);
    case "followUpDue":
      return rows.filter((r) => r.nextFollowUp);
    case "overdueFollowUps":
      return rows.filter((r) => r.delayStatus === "Overdue" || r.followUpsPending > 0);
    default:
      return rows;
  }
}

function activityIcon(type: LeadActivityRow["type"]) {
  switch (type) {
    case "follow_up": return MessageSquare;
    case "feedback": return Star;
    case "assignment": return UserCheck;
    case "edit": return Pencil;
    default: return Activity;
  }
}

export default function AdminTDLeadReports() {
  const [data, setData] = useState<LeadAdminReport | null>(null);
  const [staff, setStaff] = useState<AssignableStaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialRange = resolvePeriodRange({ period: "monthly" });
  const [period, setPeriod] = useState<ReportPeriod>(initialRange.period);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [executiveId, setExecutiveId] = useState("all");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [model, setModel] = useState("all");
  const [buyerType, setBuyerType] = useState("all");
  const [channel, setChannel] = useState("all");
  const [designation, setDesignation] = useState("all");
  const [buyerTypes, setBuyerTypes] = useState<BuyerTypeDoc[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMode, setPopupMode] = useState<"leads" | "followups" | "feedback">("leads");
  const [popupLeads, setPopupLeads] = useState<LeadDetailReportRow[]>([]);
  const [popupFollowUps, setPopupFollowUps] = useState<LeadFollowUpReportRow[]>([]);
  const [popupFeedback, setPopupFeedback] = useState<LeadFeedbackReportRow[]>([]);

  const openLeadPopup = (title: string, rows: LeadDetailReportRow[]) => {
    setPopupTitle(title);
    setPopupMode("leads");
    setPopupLeads(rows);
    setPopupOpen(true);
  };

  const openFollowUpPopup = (title: string, rows: LeadFollowUpReportRow[]) => {
    setPopupTitle(title);
    setPopupMode("followups");
    setPopupFollowUps(rows);
    setPopupOpen(true);
  };

  const openFeedbackPopup = (title: string, rows: LeadFeedbackReportRow[]) => {
    setPopupTitle(title);
    setPopupMode("feedback");
    setPopupFeedback(rows);
    setPopupOpen(true);
  };

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchAssignableStaffUsers();
        setStaff(list);
      } catch {
        setStaff([]);
      }
      try {
        setBuyerTypes(await fetchBuyerTypes());
      } catch {
        setBuyerTypes([]);
      }
    })();
  }, []);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const report = await fetchLeadAdminReport({
        from: from || undefined,
        to: to || undefined,
        executiveId: executiveId !== "all" ? executiveId : undefined,
        status: status !== "all" ? status : undefined,
        source: source !== "all" ? source : undefined,
        model: model !== "all" ? model : undefined,
        buyerType: buyerType !== "all" ? buyerType : undefined,
        channel: channel !== "all" ? channel : undefined,
        designation: designation !== "all" ? designation : undefined,
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
  }, [from, to, executiveId, status, source, model, buyerType, channel, designation]);

  useEffect(() => { void fetchReport(); }, [fetchReport]);

  const pipelineData = useMemo(
    () => (data ? Object.entries(data.pipeline).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })) : []),
    [data],
  );

  const sourceData = useMemo(
    () => (data ? Object.entries(data.bySource).map(([name, value]) => ({ name, value })) : []),
    [data],
  );

  const sourceConversionChart = useMemo(
    () =>
      data?.bySourceConversion?.map((row) => ({
        name: row.source,
        conversionRate: row.conversionRate,
        totalLeads: row.totalLeads,
        convertedCount: row.convertedCount,
      })) ?? [],
    [data],
  );

  const leadAgeingChart = useMemo(
    () => (data?.leadAgeing ?? []).map((row) => ({ name: row.bucket, value: row.count })),
    [data],
  );

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading lead reports...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 py-12 text-center max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="font-semibold text-lg">Lead reports unavailable</h2>
        <p className="text-sm text-muted-foreground">
          {loadError ?? "Could not load report data from the API."}
        </p>
        <p className="text-xs text-muted-foreground">
          Production server may need the latest backend deployed. After deploy, open{" "}
          <code className="text-primary">/health</code> and confirm{" "}
          <code className="text-primary">modules.tdLeadCrm</code> is{" "}
          <code className="text-primary">true</code>.
        </p>
        <Button onClick={() => void fetchReport()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </div>
    );
  }

  const {
    overview,
    executivePerformance = [],
    bySourceConversion = [],
    sourceConversionByExecutive = [],
    followUpSummary = { pending: 0, completed: 0, overdue: 0, cancelled: 0, total: 0 },
    followUpRows = [],
    activityLog = [],
    feedbackRows = [],
    leadDetailRows = [],
    leadAgeing = [],
  } = data;
  const funnelReport = data.funnelReport || [];
  const sourcePerformance = data.sourcePerformance || [];
  const modelPerformance = data.modelPerformance || [];
  const followUpPerformance = data.followUpPerformance || [];
  const tdPerformance = data.tdPerformance || [];

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          nav, aside, header, .print\\:hidden { display: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link to="/admin/td/leads" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3 h-3" /> Back to Lead Management
          </Link>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> Lead CRM Reports
          </h1>
          <p className="text-muted-foreground text-sm">
            Executive activity, pipeline, follow-ups, feedback & conversion — admin view
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button onClick={() => void fetchReport()} variant="outline" size="sm" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border/50 p-4 space-y-4 print:hidden">
        <ReportPeriodPresets
          value={period}
          onChange={setPeriod}
          from={from}
          to={to}
          onRangeChange={({ from: f, to: t }) => {
            setFrom(f);
            setTo(t);
          }}
        />
        <ReportStageSourceFilters
          status={status}
          source={source}
          onStatusChange={setStatus}
          onSourceChange={setSource}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="w-full bg-secondary/50"><SelectValue placeholder="All models" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All models</SelectItem>
                {CRM_IMPORT_MODEL_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Buyer type</Label>
            <Select value={buyerType} onValueChange={setBuyerType}>
              <SelectTrigger className="w-full bg-secondary/50"><SelectValue placeholder="All buyer types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All buyer types</SelectItem>
                {buyerTypes.map((b) => (
                  <SelectItem key={b._id} value={b.label}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Walk-in vs digital</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-full bg-secondary/50"><SelectValue placeholder="All channels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="walk-in">Walk-in</SelectItem>
                <SelectItem value="digital">Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Team / role</Label>
            <Select value={designation} onValueChange={setDesignation}>
              <SelectTrigger className="w-full bg-secondary/50"><SelectValue placeholder="All roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="sales_executive">Sales Executive</SelectItem>
                <SelectItem value="sales_manager">Sales Manager</SelectItem>
                <SelectItem value="cre">CRE</SelectItem>
                <SelectItem value="sales_head">Sales Head</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Phone: dates side by side, staff + buttons full width.
            Tablet (sm–lg): dates row, then staff + buttons aligned on one row.
            Desktop (lg+): everything on a single row. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1.25fr_auto] lg:items-end">
          <div className="space-y-1.5 min-w-0 col-span-2 sm:col-span-1 lg:col-span-1">
            <Label className="text-xs">Executive / staff</Label>
            <Select value={executiveId} onValueChange={setExecutiveId}>
              <SelectTrigger className="w-full bg-secondary/50">
                <SelectValue placeholder="All staff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}{s.designationLabel ? ` · ${s.designationLabel}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 col-span-2 sm:col-span-1 sm:self-end lg:col-span-1">
            <Button onClick={() => void fetchReport()} className="bg-primary text-primary-foreground flex-1 lg:flex-none shrink-0">Apply</Button>
            <Button
              onClick={() => {
                const range = resolvePeriodRange({ period: "monthly" });
                setPeriod(range.period);
                setFrom(range.from);
                setTo(range.to);
                setExecutiveId("all");
                setStatus("all");
                setSource("all");
                setModel("all");
                setBuyerType("all");
                setChannel("all");
                setDesignation("all");
              }}
              variant="outline"
              className="flex-1 lg:flex-none shrink-0"
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {data.kpis ? (
        <div className="space-y-2 print:block">
          <p className="text-xs font-semibold text-muted-foreground">Management KPI — Today / MTD</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-2">
            {Object.keys(data.kpis.mtd).map((k) => (
              <Card
                key={k}
                className="p-3 border-border/50 cursor-pointer hover:bg-secondary/20 transition-colors print:cursor-default"
                role="button"
                tabIndex={0}
                onClick={() => openLeadPopup(`KPI · ${k.replace(/([A-Z])/g, " $1")}`, kpiLeadRows(k, leadDetailRows))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    openLeadPopup(`KPI · ${k.replace(/([A-Z])/g, " $1")}`, kpiLeadRows(k, leadDetailRows));
                  }
                }}
              >
                <p className="text-[10px] text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</p>
                <p className="text-lg font-bold">{data.kpis?.today?.[k] ?? 0} <span className="text-xs font-normal text-muted-foreground">/ {data.kpis?.mtd?.[k] ?? 0}</span></p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
      {data.conversions ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Card className="p-3">Lead→TD {Number(data.conversions.leadToTdPct).toFixed(2)}%</Card>
          <Card className="p-3">TD→Booking {Number(data.conversions.tdToBookingPct).toFixed(2)}%</Card>
          <Card className="p-3">Lead→Booking {Number(data.conversions.leadToBookingPct).toFixed(2)}%</Card>
          <Card className="p-3">Booking→Delivery {Number(data.conversions.bookingToDeliveryPct).toFixed(2)}%</Card>
        </div>
      ) : null}
      {data.inactivityAgeing ? (
        <p className="text-xs text-muted-foreground">
          No action: 1 day {data.inactivityAgeing.buckets["1 Day"] ?? 0} · 3 days {data.inactivityAgeing.buckets["3 Days"] ?? 0} · 7+ days {data.inactivityAgeing.buckets["7+ Days"] ?? 0}
          {data.inactivityAgeing.firstResponseSample
            ? ` · Avg first response ${data.inactivityAgeing.avgFirstResponseMinutes} min`
            : ""}
        </p>
      ) : null}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total leads"
          value={overview.totalLeads}
          icon={Users}
          onClick={() => openLeadPopup("Total leads", leadDetailRows)}
        />
        <StatCard
          label="Active pipeline"
          value={overview.activeLeads}
          icon={Activity}
          color="text-blue-400"
          onClick={() =>
            openLeadPopup(
              "Active pipeline",
              leadDetailRows.filter((r) => !TERMINAL_LEAD_STAGES.has(normalizeCrmStage(r.status))),
            )
          }
        />
        <StatCard
          label="Conversion rate"
          value={`${overview.conversionRate}%`}
          icon={Target}
          color="text-green-400"
          sub={`${overview.convertedCount} converted`}
          onClick={() => openLeadPopup("Converted leads", leadDetailRows.filter((r) => r.converted))}
        />
        <StatCard
          label="Unassigned"
          value={overview.unassigned}
          icon={UserCheck}
          color="text-amber-400"
          onClick={() =>
            openLeadPopup(
              "Unassigned leads",
              leadDetailRows.filter((r) => !r.assignedToId || r.assignedTo === "Unassigned"),
            )
          }
        />
        <StatCard
          label="Follow-ups pending"
          value={overview.followUpsPending}
          icon={CalendarClock}
          color="text-yellow-400"
          sub={`${overview.followUpsOverdue} overdue`}
          onClick={() => openFollowUpPopup("Follow-ups pending", followUpRows.filter((r) => r.status === "pending"))}
        />
        <StatCard
          label="Follow-ups done"
          value={overview.followUpsCompleted}
          icon={CheckCircle2}
          color="text-green-400"
          onClick={() => openFollowUpPopup("Follow-ups completed", followUpRows.filter((r) => r.status === "completed"))}
        />
        <StatCard
          label="TD feedback"
          value={overview.feedbackCount}
          icon={Star}
          color="text-yellow-400"
          sub={overview.feedbackCount > 0 ? `Avg ${overview.avgFeedbackRating}⭐` : undefined}
          onClick={() => openFeedbackPopup("TD feedback linked to leads", feedbackRows)}
        />
        <StatCard
          label="Overdue follow-ups"
          value={overview.followUpsOverdue}
          icon={AlertTriangle}
          color="text-red-400"
          onClick={() =>
            openFollowUpPopup(
              "Overdue follow-ups",
              followUpRows.filter(
                (r) => r.status === "pending" && r.scheduledAt && new Date(r.scheduledAt) < new Date(),
              ),
            )
          }
        />
        <StatCard
          label="TD booked / done"
          value={`${overview.testDrivesBooked} / ${overview.testDrivesDone}`}
          icon={CalendarClock}
          color="text-blue-400"
          onClick={() => openLeadPopup("Test drives booked", leadDetailRows.filter((r) => r.testDriveBooked))}
        />
        <StatCard
          label="Repeat approvals"
          value={overview.repeatApprovalsPending}
          icon={AlertTriangle}
          color="text-amber-400"
          sub="awaiting admin decision"
          onClick={() =>
            openLeadPopup(
              "Repeat test drives awaiting approval",
              leadDetailRows.filter((r) => r.testDriveStatus === "Awaiting Approval"),
            )
          }
        />
        <StatCard
          label="Delayed / overdue"
          value={overview.delayedLeads}
          icon={AlertTriangle}
          color="text-red-400"
          onClick={() =>
            openLeadPopup(
              "Delayed & overdue leads",
              leadDetailRows.filter((r) => r.delayStatus === "Delayed" || r.delayStatus === "Overdue"),
            )
          }
        />
        <StatCard
          label="Action required"
          value={overview.actionRequired}
          icon={Target}
          color="text-amber-400"
          sub="management attention"
          onClick={() =>
            openLeadPopup(
              "Leads needing action",
              leadDetailRows.filter((r) => r.actionRequired && r.actionRequired !== "—"),
            )
          }
        />
      </div>

      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{popupTitle}</DialogTitle>
          </DialogHeader>
          {popupMode === "leads" ? (
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left p-2">Customer</th>
                    <th className="text-left p-2">Model</th>
                    <th className="text-left p-2">Stage</th>
                    <th className="text-left p-2">Source</th>
                    <th className="text-left p-2">Assigned to</th>
                    <th className="text-left p-2">Follow-ups</th>
                    <th className="text-left p-2">Next follow-up</th>
                    <th className="text-left p-2">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {popupLeads.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No records found</td></tr>
                  ) : (
                    popupLeads.map((row) => (
                      <tr key={row.leadId} className="border-b border-border/20 hover:bg-secondary/10">
                        <td className="p-2">
                          <p className="font-medium">{row.name}</p>
                          <p className="text-muted-foreground">{row.mobile}</p>
                        </td>
                        <td className="p-2">{row.model}</td>
                        <td className="p-2">
                          <Badge className={cn("text-[10px]", STAGE_COLORS[row.status] ?? "bg-muted")}>{row.status}</Badge>
                          {row.converted ? (
                            <Badge className="ml-1 text-[10px] bg-green-400/10 text-green-400">Converted</Badge>
                          ) : null}
                        </td>
                        <td className="p-2">{row.source}</td>
                        <td className="p-2">{row.assignedTo}</td>
                        <td className="p-2">{row.followUpCount} ({row.followUpsPending} pending)</td>
                        <td className="p-2 whitespace-nowrap">{fmtDate(row.nextFollowUp)}</td>
                        <td className="p-2">
                          {row.feedbackRating != null ? `${row.feedbackRating}⭐ · ${row.purchaseIntention ?? "—"}/5` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : popupMode === "followups" ? (
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left p-2">Lead</th>
                    <th className="text-left p-2">Executive</th>
                    <th className="text-left p-2">Note</th>
                    <th className="text-left p-2">Scheduled</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {popupFollowUps.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No records found</td></tr>
                  ) : (
                    popupFollowUps.map((row) => (
                      <tr key={row.id} className="border-b border-border/20 hover:bg-secondary/10">
                        <td className="p-2">
                          <p className="font-medium">{row.leadName}</p>
                          <p className="text-muted-foreground">{row.leadMobile}</p>
                          <Badge variant="outline" className="mt-1 text-[10px]">{row.leadStatus}</Badge>
                        </td>
                        <td className="p-2">{row.executiveName}</td>
                        <td className="p-2 max-w-[14rem]">{row.note}</td>
                        <td className="p-2 whitespace-nowrap">{fmtDateTime(row.scheduledAt)}</td>
                        <td className="p-2">
                          <Badge variant={row.status === "completed" ? "default" : row.status === "pending" ? "outline" : "secondary"}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="p-2">{row.outcome}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2 max-h-[65vh] overflow-auto">
              {popupFeedback.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No feedback records found</p>
              ) : (
                popupFeedback.map((fb, i) => (
                  <Card key={`${fb.bookingId}-${fb.mobile}-${i}`} className="bg-card border-border/50 p-3">
                    <p className="font-medium text-sm">{fb.leadName} · {fb.mobile}</p>
                    <p className="text-xs text-muted-foreground">
                      {fb.bookingId} · {fb.model} · Executive: {fb.executiveName}
                    </p>
                    {fb.leadStatus ? (
                      <Badge variant="outline" className="mt-1 text-[10px]">{normalizeCrmStage(fb.leadStatus)}</Badge>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1">
                      Rating: {fb.overallRating ?? "—"}⭐ · Purchase intent: {fb.purchaseIntention ?? "—"}/5
                      {fb.executiveBehaviour != null ? ` · Exec ${fb.executiveBehaviour}/5` : ""}
                    </p>
                    {fb.remarks && fb.remarks !== "—" ? (
                      <p className="text-xs mt-1 italic">&ldquo;{fb.remarks}&rdquo;</p>
                    ) : null}
                  </Card>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="executives">
        <TabsList className="bg-secondary/50 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="ageing">Lead ageing</TabsTrigger>
          <TabsTrigger value="sources">Source conversion</TabsTrigger>
          <TabsTrigger value="executives">Executive performance</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="fu-perf">Follow-up performance</TabsTrigger>
          <TabsTrigger value="td-perf">TD performance</TabsTrigger>
          <TabsTrigger value="funnel-mis">Funnel MIS</TabsTrigger>
          <TabsTrigger value="source-mis">Source MIS</TabsTrigger>
          <TabsTrigger value="model-mis">Model MIS</TabsTrigger>
          <TabsTrigger value="activity">Activity log</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="leads">All leads</TabsTrigger>
        </TabsList>

        <TabsContent value="ageing" className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Days since lead was created — filtered by your selected date range and executive.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {leadAgeing.map((row) => (
              <StatCard
                key={row.bucket}
                label={row.bucket}
                value={row.count}
                icon={Timer}
                color={AGE_BUCKET_TEXT[row.bucket] ?? "text-primary"}
                onClick={() =>
                  openLeadPopup(
                    `Lead ageing · ${row.bucket}`,
                    leadDetailRows.filter((l) => l.ageBucket === row.bucket),
                  )
                }
              />
            ))}
          </div>

          {leadAgeingChart.some((r) => r.value > 0) ? (
            <Card className="bg-card border-border/50 p-4">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <Timer className="w-4 h-4 text-primary" /> Lead ageing distribution
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={leadAgeingChart}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {leadAgeingChart.map((entry) => (
                      <Cell key={entry.name} fill={AGE_BUCKET_COLORS[entry.name] ?? "#00d4ff"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <p className="text-muted-foreground text-center py-12">No leads in this period for ageing analysis</p>
          )}

          <Card className="bg-card border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30 text-muted-foreground">
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Stage</th>
                    <th className="text-left p-3">Source</th>
                    <th className="text-left p-3">Assigned to</th>
                    <th className="text-right p-3">Age (days)</th>
                    <th className="text-left p-3">Age bucket</th>
                    <th className="text-left p-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {leadDetailRows.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No leads in this period</td></tr>
                  ) : (
                    [...leadDetailRows]
                      .sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0))
                      .map((row) => (
                        <tr key={row.leadId} className="border-b border-border/20 hover:bg-secondary/10">
                          <td className="p-3">
                            <p className="font-medium">{row.name}</p>
                            <p className="text-muted-foreground">{row.mobile}</p>
                          </td>
                          <td className="p-3">
                            <Badge className={cn("text-[10px]", STAGE_COLORS[row.status] ?? "bg-muted")}>{row.status}</Badge>
                          </td>
                          <td className="p-3">{row.source}</td>
                          <td className="p-3">{row.assignedTo}</td>
                          <td className="p-3 text-right font-medium">{row.ageDays ?? "—"}</td>
                          <td className="p-3">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px]", AGE_BUCKET_TEXT[row.ageBucket ?? ""] ?? "")}
                            >
                              {row.ageBucket ?? "—"}
                            </Badge>
                          </td>
                          <td className="p-3 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="mt-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Conversion by lead source for the selected date range
            {executiveId !== "all" ? " and executive" : " — includes per-executive breakdown when all staff is selected"}.
          </p>

          {bySourceConversion.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No leads in this period to analyse by source</p>
          ) : (
            <>
              <Card className="bg-card border-border/50 p-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-400" /> Conversion rate by source
                </h3>
                <ResponsiveContainer width="100%" height={Math.max(220, bySourceConversion.length * 36)}>
                  <BarChart data={sourceConversionChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      formatter={(value: number, _name, item) => {
                        const row = item.payload as { totalLeads: number; convertedCount: number };
                        return [`${value}% (${row.convertedCount}/${row.totalLeads} leads)`, "Conversion"];
                      }}
                    />
                    <Bar dataKey="conversionRate" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="bg-card border-border/50 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50 bg-secondary/30 text-muted-foreground">
                        <th className="text-left p-3">Source</th>
                        <th className="text-right p-3">Total leads</th>
                        <th className="text-right p-3">Converted</th>
                        <th className="text-right p-3">Conversion rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySourceConversion.map((row) => (
                        <tr key={row.source} className="border-b border-border/20 hover:bg-secondary/10">
                          <td className="p-3 font-medium">{row.source}</td>
                          <td className="p-3 text-right">{row.totalLeads}</td>
                          <td className="p-3 text-right text-green-400">{row.convertedCount}</td>
                          <td className="p-3 text-right">
                            <Badge
                              className={cn(
                                "text-[10px]",
                                row.conversionRate >= 50
                                  ? "bg-green-400/10 text-green-400 border-green-400/20"
                                  : row.conversionRate >= 25
                                    ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/20"
                                    : "bg-muted text-muted-foreground",
                              )}
                            >
                              {row.conversionRate}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {executiveId === "all" && sourceConversionByExecutive.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> By executive &amp; source
              </h3>
              {sourceConversionByExecutive.map((exec) => (
                <Card key={exec.executiveId} className="bg-card border-border/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="font-semibold text-foreground">{exec.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {exec.convertedCount}/{exec.totalLeads} converted · {exec.conversionRate}%
                    </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-2 pr-3">Source</th>
                          <th className="text-right py-2 px-3">Leads</th>
                          <th className="text-right py-2 px-3">Converted</th>
                          <th className="text-right py-2 pl-3">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exec.bySource.map((src) => (
                          <tr key={`${exec.executiveId}-${src.source}`} className="border-b border-border/10">
                            <td className="py-2 pr-3">{src.source}</td>
                            <td className="py-2 px-3 text-right">{src.totalLeads}</td>
                            <td className="py-2 px-3 text-right text-green-400">{src.convertedCount}</td>
                            <td className="py-2 pl-3 text-right">{src.conversionRate}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="executives" className="mt-4 space-y-3">
          {executivePerformance.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No executive activity in this period</p>
          ) : (
            executivePerformance.map((e, i) => (
              <Card key={e.executiveId || i} className="bg-card border-border/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <span className="text-muted-foreground text-sm">#{i + 1}</span> {e.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.leadsAssigned} leads assigned · {e.leadsConverted} converted ({e.conversionRate}%)
                    </p>
                  </div>
                  {e.avgExecutiveBehaviour != null ? (
                    <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20">
                      Executive rating {e.avgExecutiveBehaviour}/5
                    </Badge>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs text-muted-foreground">
                  <span>Stage changes: {e.stageChanges}</span>
                  <span>Follow-ups logged: {e.followUpsLogged}</span>
                  <span>Follow-ups done: {e.followUpsCompleted}</span>
                  <span>Pending / overdue: {e.followUpsPending} / {e.followUpsOverdue}</span>
                  <span>TDs completed: {e.testDrivesCompleted}</span>
                  <span>Feedback captured: {e.feedbackCount}</span>
                  <span>First response: {e.avgFirstResponseMinutes != null ? `${e.avgFirstResponseMinutes} min` : "—"}</span>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <StatCard label="Pending follow-ups" value={followUpSummary.pending} icon={CalendarClock} />
            <StatCard label="Completed follow-ups" value={followUpSummary.completed} icon={CheckCircle2} color="text-green-400" />
            <StatCard label="Overdue" value={followUpSummary.overdue} icon={AlertTriangle} color="text-red-400" />
          </div>
          {pipelineData.length > 0 ? (
            <Card className="bg-card border-border/50 p-4">
              <h3 className="font-semibold text-sm mb-4">Leads by stage</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pipelineData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ) : null}
          {sourceData.length > 0 ? (
            <Card className="bg-card border-border/50 p-4">
              <h3 className="font-semibold text-sm mb-4">Leads by source</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`} fontSize={10}>
                    {sourceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <Card className="bg-card border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30 text-muted-foreground">
                    <th className="text-left p-3">Lead</th>
                    <th className="text-left p-3">Executive</th>
                    <th className="text-left p-3">Note</th>
                    <th className="text-left p-3">Scheduled</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {followUpRows.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No follow-ups in this period</td></tr>
                  ) : (
                    followUpRows.map((row) => (
                      <tr key={row.id} className="border-b border-border/20 hover:bg-secondary/10">
                        <td className="p-3">
                          <p className="font-medium">{row.leadName}</p>
                          <p className="text-muted-foreground">{row.leadMobile}</p>
                          <Badge variant="outline" className="mt-1 text-[10px]">{row.leadStatus}</Badge>
                        </td>
                        <td className="p-3">{row.executiveName}</td>
                        <td className="p-3 max-w-[14rem]">{row.note}</td>
                        <td className="p-3 whitespace-nowrap">{fmtDateTime(row.scheduledAt)}</td>
                        <td className="p-3">
                          <Badge variant={row.status === "completed" ? "default" : row.status === "pending" ? "outline" : "secondary"}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="p-3">{row.outcome}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="fu-perf" className="mt-4">
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Assigned</th>
                  <th className="p-3">Due today</th>
                  <th className="p-3">Completed</th>
                  <th className="p-3">Overdue</th>
                  <th className="p-3">Conversion %</th>
                </tr>
              </thead>
              <tbody>
                {followUpPerformance.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No follow-up performance data</td></tr>
                ) : followUpPerformance.map((r) => (
                  <tr key={r.employeeId} className="border-b border-border/30">
                    <td className="p-3">{r.employee}</td>
                    <td className="p-3">{r.assigned}</td>
                    <td className="p-3">{r.dueToday}</td>
                    <td className="p-3">{r.completed}</td>
                    <td className="p-3">{r.overdue}</td>
                    <td className="p-3">{Number(r.conversionPct).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="td-perf" className="mt-4">
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Booked</th>
                  <th className="p-3">Completed</th>
                  <th className="p-3">Cancelled</th>
                  <th className="p-3">Rescheduled</th>
                  <th className="p-3">Completion %</th>
                </tr>
              </thead>
              <tbody>
                {tdPerformance.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No test-drive performance data</td></tr>
                ) : tdPerformance.map((r) => (
                  <tr key={r.employeeId} className="border-b border-border/30">
                    <td className="p-3">{r.employee}</td>
                    <td className="p-3">{r.booked}</td>
                    <td className="p-3">{r.completed}</td>
                    <td className="p-3">{r.cancelled}</td>
                    <td className="p-3">{r.rescheduled}</td>
                    <td className="p-3">{Number(r.completionPct).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="funnel-mis" className="mt-4">
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="p-3">Stage</th>
                  <th className="p-3">Count</th>
                  <th className="p-3">Conversion %</th>
                  <th className="p-3">Drop %</th>
                  <th className="p-3">Avg hours in stage</th>
                  <th className="p-3">Avg days in stage</th>
                </tr>
              </thead>
              <tbody>
                {funnelReport.map((r) => (
                  <tr key={r.stage} className="border-b border-border/30">
                    <td className="p-3">{r.stage}</td>
                    <td className="p-3">{r.count}</td>
                    <td className="p-3">{Number(r.conversionPct).toFixed(2)}%</td>
                    <td className="p-3">{Number(r.dropPct).toFixed(2)}%</td>
                    <td className="p-3">{r.avgHoursInStage}</td>
                    <td className="p-3">{r.avgDaysInStage ?? Math.round((r.avgHoursInStage / 24) * 10) / 10}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="source-mis" className="mt-4">
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="p-3">Source</th>
                  <th className="p-3">Leads</th>
                  <th className="p-3">Interested</th>
                  <th className="p-3">TD</th>
                  <th className="p-3">Booking</th>
                  <th className="p-3">Delivery</th>
                  <th className="p-3">Lead→Booking %</th>
                </tr>
              </thead>
              <tbody>
                {sourcePerformance.map((r) => (
                  <tr key={r.source} className="border-b border-border/30">
                    <td className="p-3">{r.source}</td>
                    <td className="p-3">{r.leads}</td>
                    <td className="p-3">{r.interested}</td>
                    <td className="p-3">{r.td}</td>
                    <td className="p-3">{r.booking}</td>
                    <td className="p-3">{r.delivery}</td>
                    <td className="p-3">{Number(r.leadToBookingPct).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="model-mis" className="mt-4">
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="p-3">Model</th>
                  <th className="p-3">Enquiry</th>
                  <th className="p-3">Interested</th>
                  <th className="p-3">TD</th>
                  <th className="p-3">Booking</th>
                  <th className="p-3">Delivery</th>
                  <th className="p-3">Lost</th>
                </tr>
              </thead>
              <tbody>
                {modelPerformance.map((r) => (
                  <tr key={r.model} className="border-b border-border/30">
                    <td className="p-3">{r.model}</td>
                    <td className="p-3">{r.enquiry}</td>
                    <td className="p-3">{r.interested}</td>
                    <td className="p-3">{r.td}</td>
                    <td className="p-3">{r.booking}</td>
                    <td className="p-3">{r.delivery}</td>
                    <td className="p-3">{r.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-2">
          {activityLog.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No activity recorded</p>
          ) : (
            activityLog.map((row, i) => {
              const Icon = activityIcon(row.type);
              return (
                <Card key={i} className="bg-card border-border/50 p-3">
                  <div className="flex gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 h-fit">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">{row.leadName}</span>
                        <span className="text-xs text-muted-foreground">{row.leadMobile}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">{row.type.replace("_", " ")}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{row.detail}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {row.executiveName} · {fmtDateTime(row.at)}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="feedback" className="mt-4 space-y-3">
          {feedbackRows.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No test drive feedback linked to leads</p>
          ) : (
            feedbackRows.map((fb, i) => (
              <Card key={i} className="bg-card border-border/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{fb.leadName} · {fb.mobile}</p>
                    <p className="text-xs text-muted-foreground">
                      {fb.bookingId} · {fb.model} · Executive: {fb.executiveName}
                    </p>
                    {fb.leadStatus ? (
                      <Badge variant="outline" className="mt-1 text-[10px]">{normalizeCrmStage(fb.leadStatus)}</Badge>
                    ) : null}
                  </div>
                  <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20 shrink-0">
                    {fb.overallRating ?? "—"}⭐ · intent {fb.purchaseIntention ?? "—"}/5
                    {fb.executiveBehaviour != null ? ` · exec ${fb.executiveBehaviour}/5` : ""}
                  </Badge>
                </div>
                {fb.remarks && fb.remarks !== "—" ? (
                  <p className="text-sm text-muted-foreground mt-2 italic">&ldquo;{fb.remarks}&rdquo;</p>
                ) : null}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card className="bg-card border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30 text-muted-foreground">
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Model</th>
                    <th className="text-left p-3">Stage</th>
                    <th className="text-left p-3">Test drive</th>
                    <th className="text-left p-3">Assigned to</th>
                    <th className="text-left p-3">Follow-ups</th>
                    <th className="text-left p-3">Feedback</th>
                    <th className="text-left p-3">Photo / GPS</th>
                    <th className="text-left p-3">Delay</th>
                    <th className="text-left p-3">Action required</th>
                    <th className="text-left p-3">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {leadDetailRows.length === 0 ? (
                    <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No leads in this period</td></tr>
                  ) : (
                    leadDetailRows.map((row) => (
                      <tr key={row.leadId} className="border-b border-border/20 hover:bg-secondary/10">
                        <td className="p-3">
                          <p className="font-medium">{row.name}</p>
                          <p className="text-muted-foreground">{row.mobile}</p>
                          <p className="text-[10px] text-muted-foreground">{row.source} · {row.interest}</p>
                        </td>
                        <td className="p-3">{row.model}</td>
                        <td className="p-3">
                          <Badge className={cn("text-[10px]", STAGE_COLORS[row.status] ?? "bg-muted")}>{row.status}</Badge>
                          {row.converted ? <Badge className="ml-1 text-[10px] bg-green-400/10 text-green-400">Converted</Badge> : null}
                        </td>
                        <td className="p-3">
                          <Badge
                            className={cn(
                              "text-[10px]",
                              row.testDriveStatus === "Done"
                                ? "bg-green-400/10 text-green-400"
                                : row.testDriveStatus === "Booked"
                                  ? "bg-blue-400/10 text-blue-400"
                                  : row.testDriveStatus === "Awaiting Approval"
                                    ? "bg-amber-400/10 text-amber-400"
                                    : "bg-muted text-muted-foreground",
                            )}
                          >
                            {row.testDriveStatus}
                          </Badge>
                          {row.testDriveBookingId ? (
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{row.testDriveBookingId}</p>
                          ) : null}
                        </td>
                        <td className="p-3">{row.assignedTo}</td>
                        <td className="p-3">{row.followUpCount} ({row.followUpsPending} pending)</td>
                        <td className="p-3">
                          {row.feedbackRating != null ? `${row.feedbackRating}⭐ · ${row.purchaseIntention ?? "—"}/5` : "—"}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {row.customerPhotoUrl ? (
                              <a href={row.customerPhotoUrl} target="_blank" rel="noreferrer" className="shrink-0">
                                <img
                                  src={row.customerPhotoUrl}
                                  alt={`${row.name} photo`}
                                  className="w-8 h-8 rounded-full object-cover border border-border/60"
                                />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {row.latitude != null && row.longitude != null ? (
                              <a
                                href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-primary hover:underline whitespace-nowrap"
                              >
                                {row.latitude.toFixed(4)}, {row.longitude.toFixed(4)}
                              </a>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge
                            className={cn(
                              "text-[10px]",
                              row.delayStatus === "On Track"
                                ? "bg-green-400/10 text-green-400"
                                : row.delayStatus === "Closed"
                                  ? "bg-muted text-muted-foreground"
                                  : row.delayStatus === "Delayed"
                                    ? "bg-amber-400/10 text-amber-400"
                                    : "bg-red-400/10 text-red-400",
                            )}
                          >
                            {row.delayStatus}
                          </Badge>
                        </td>
                        <td className="p-3 max-w-[11rem]">
                          {row.actionRequired && row.actionRequired !== "—" ? (
                            <span className="text-amber-600 dark:text-amber-400">{row.actionRequired}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 max-w-[10rem] truncate" title={row.remarks}>{row.remarks}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
