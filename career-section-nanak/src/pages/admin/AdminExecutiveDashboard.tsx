import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, RefreshCw, Loader2, Users, Target, CalendarCheck,
  TrendingUp, TrendingDown, Minus, Star, MessageSquare, ArrowRight,
  UserCheck, Pencil, Activity, Clock, CheckCircle2,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReportPeriodPresets, { type ReportPeriod } from "@/components/admin/ReportPeriodPresets";
import ReportStageSourceFilters from "@/components/admin/ReportStageSourceFilters";
import { resolvePeriodRange } from "@/lib/reportPeriod";
import { formatApiErrors, adminGet } from "@/lib/api";
import { getAdminUser } from "@/lib/adminAuth";
import {
  fetchExecutiveDashboard,
  isCreDashboard,
  readPipelineMap,
  readBySourceMap,
  type ExecutiveDashboard,
  type ManagerTeamMemberStats,
  type MyDashboardPayload,
} from "@/lib/executiveDashboardApi";
import { fetchPvCrmLeads, type PvCrmLead } from "@/lib/pvLeadCrmApi";
import { fetchActionCentre, type ActionCentreData } from "@/lib/crmActionCentreApi";
import { CrmActionCentre } from "@/components/admin/CrmActionCentre";
import { STAGE_COLORS, normalizeCrmStage } from "@/lib/leadStages";
import { cn } from "@/lib/utils";
import { CreMyDashboard } from "@/pages/admin/CreMyDashboard";

const CHART_COLORS = ["#00d4ff", "#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

const CLOSED_LEAD_STAGES = new Set(["Lost", "Delivered", "Not Interested"]);

type TeamMetricKey =
  | "leadsCount"
  | "tdCompleted"
  | "converted"
  | "delivered"
  | "followUpsDue"
  | "openLeads"
  | "testDrives";

type DetailMode = "leads" | "tds";

type DashboardCardKey =
  | "my_leads"
  | "my_tds"
  | "team_leads"
  | "team_tds"
  | "pending_leads"
  | "followups_due"
  | "completed_tds"
  | "team_performance"
  | "year_leads"
  | "year_tds"
  | "year_td_completed"
  | "active_leads"
  | "followups_pending"
  | "followups_overdue";

type TeamTdRow = {
  _id: string;
  bookingId?: string;
  bookingStatus?: string;
  preferredModel?: string;
  slotDate?: string;
  slotTime?: string;
  customerId?: { name?: string; mobile?: string } | null;
  testDriveId?: { customerName?: string; mobile?: string; model?: string } | null;
  assignedExecutive?: { _id?: string; name?: string } | null;
};

const TEAM_METRIC_LABELS: Record<TeamMetricKey, string> = {
  leadsCount: "Leads",
  tdCompleted: "TD completed",
  converted: "Converted",
  delivered: "Delivered",
  followUpsDue: "Follow-ups due",
  openLeads: "Open leads",
  testDrives: "Test drives",
};

function memberMetric(m: ManagerTeamMemberStats, key: TeamMetricKey): number {
  if (key === "leadsCount") return m.leadsCount ?? m.leads ?? 0;
  if (key === "tdCompleted") return m.tdCompleted ?? m.completedTestDrives ?? 0;
  return Number(m[key] ?? 0);
}

const DASHBOARD_CARD_META: Record<DashboardCardKey, { title: string; mode: DetailMode }> = {
  my_leads: { title: "My Assigned Leads", mode: "leads" },
  my_tds: { title: "My Assigned Test Drives", mode: "tds" },
  team_leads: { title: "Team Leads", mode: "leads" },
  team_tds: { title: "Team Test Drives", mode: "tds" },
  pending_leads: { title: "Pending Leads", mode: "leads" },
  followups_due: { title: "Follow-ups Due", mode: "leads" },
  completed_tds: { title: "Completed Test Drives", mode: "tds" },
  team_performance: { title: "Team Performance — All Leads", mode: "leads" },
  year_leads: { title: "My Leads (year)", mode: "leads" },
  year_tds: { title: "My Test Drives (year)", mode: "tds" },
  year_td_completed: { title: "TD Completed (year)", mode: "tds" },
  active_leads: { title: "Active Leads", mode: "leads" },
  followups_pending: { title: "Follow-ups Pending", mode: "leads" },
  followups_overdue: { title: "Follow-ups Overdue", mode: "leads" },
};

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
  onClick,
}: {
  label: string;
  current: number;
  previous: number;
  suffix?: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const delta = current - previous;
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor = delta > 0 ? "text-green-500" : delta < 0 ? "text-red-400" : "text-muted-foreground";
  const clickable = Boolean(onClick) && current > 0;

  return (
    <Card
      className={cn(
        "bg-card border-border/50 p-4",
        clickable && "cursor-pointer hover:border-primary/40 transition-colors",
      )}
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-2xl font-bold mt-1",
              clickable ? "text-primary underline-offset-2 hover:underline" : "text-foreground",
            )}
          >
            {current}{suffix}
          </p>
          <div className={cn("flex items-center gap-1 mt-1 text-xs", trendColor)}>
            <TrendIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{delta >= 0 ? "+" : ""}{delta}{suffix} vs last year</span>
          </div>
          {clickable ? (
            <p className="text-[10px] text-muted-foreground mt-1">Click for details</p>
          ) : null}
        </div>
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function CountCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  onClick,
  children,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: React.ElementType;
  iconClass?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const clickable = Boolean(onClick) && value > 0;
  return (
    <Card
      className={cn(
        "bg-card border-border/50 p-4",
        clickable && "cursor-pointer hover:border-primary/40 transition-colors",
      )}
      onClick={clickable ? onClick : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-2xl font-bold mt-1 tabular-nums",
              clickable ? "text-primary underline-offset-2 hover:underline" : "text-foreground",
            )}
          >
            {value}
          </p>
          {hint ? <p className="text-[11px] text-muted-foreground mt-1">{hint}</p> : null}
          {children}
          {clickable ? (
            <p className="text-[10px] text-muted-foreground mt-1">Click for details</p>
          ) : null}
        </div>
        {Icon ? <Icon className={cn("w-5 h-5 shrink-0", iconClass || "text-primary")} /> : null}
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

function isOpenLead(status?: string) {
  return !CLOSED_LEAD_STAGES.has(normalizeCrmStage(status || ""));
}

function reportRowToLead(row: {
  leadId: string;
  name: string;
  mobile: string;
  model: string;
  status: string;
  source: string;
  updatedAt?: string;
  assignedTo?: string;
  nextFollowUp?: string | null;
}): PvCrmLead {
  return {
    _id: row.leadId,
    name: row.name,
    mobile: row.mobile,
    model: row.model,
    status: row.status,
    source: row.source,
    updatedAt: row.updatedAt,
    nextFollowUp: row.nextFollowUp || undefined,
    assignedTo: row.assignedTo
      ? { _id: "assigned", name: row.assignedTo }
      : undefined,
  } as PvCrmLead;
}

function bookingFromRecent(b: {
  bookingId: string;
  status: string;
  slotDate?: string;
  slotTime?: string;
  model: string;
  customerName: string;
  mobile: string;
}): TeamTdRow {
  return {
    _id: b.bookingId,
    bookingId: b.bookingId,
    bookingStatus: b.status,
    preferredModel: b.model,
    slotDate: b.slotDate,
    slotTime: b.slotTime,
    testDriveId: { customerName: b.customerName, mobile: b.mobile, model: b.model },
    assignedExecutive: { _id: "self", name: "Assigned" },
  };
}

export default function AdminExecutiveDashboard() {
  const adminUser = getAdminUser();
  const selfId = String(adminUser?._id || "");
  const [year, setYear] = useState(new Date().getFullYear());
  const initialRange = resolvePeriodRange({ period: "monthly" });
  const [period, setPeriod] = useState<ReportPeriod>(initialRange.period);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [managerTab, setManagerTab] = useState("team");
  const [data, setData] = useState<MyDashboardPayload | null>(null);
  const [actionCentre, setActionCentre] = useState<ActionCentreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailSubtitle, setDetailSubtitle] = useState("");
  const [detailMode, setDetailMode] = useState<DetailMode>("leads");
  const [detailLeads, setDetailLeads] = useState<PvCrmLead[]>([]);
  const [detailTds, setDetailTds] = useState<TeamTdRow[]>([]);
  const [detailCrmLink, setDetailCrmLink] = useState("/admin/crm/leads");
  const [detailTdLink, setDetailTdLink] = useState("/admin/td/bookings");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const report = await fetchExecutiveDashboard({
        period,
        from: from || undefined,
        to: to || undefined,
        year,
        status: status !== "all" ? status : undefined,
        source: source !== "all" ? source : undefined,
      });
      setData(report);
      try {
        setActionCentre(await fetchActionCentre());
      } catch {
        setActionCentre(null);
      }
    } catch (e) {
      setData(null);
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [period, from, to, year, status, source]);

  useEffect(() => { void load(); }, [load]);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailLeads([]);
    setDetailTds([]);
  };

  const showDetail = async (opts: {
    title: string;
    subtitle?: string;
    mode: DetailMode;
    crmLink?: string;
    tdLink?: string;
    loader: () => Promise<{ leads?: PvCrmLead[]; tds?: TeamTdRow[] }>;
  }) => {
    setDetailTitle(opts.title);
    setDetailSubtitle(opts.subtitle || "Detailed list — click through to manage in CRM / TD Bookings.");
    setDetailMode(opts.mode);
    setDetailCrmLink(opts.crmLink || "/admin/crm/leads");
    setDetailTdLink(opts.tdLink || "/admin/td/bookings");
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailLeads([]);
    setDetailTds([]);
    try {
      const result = await opts.loader();
      setDetailLeads(result.leads ?? []);
      setDetailTds(result.tds ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchMyTds = async (status?: string) => {
    const params = new URLSearchParams({ limit: "100" });
    if (selfId) params.set("assignedExecutive", selfId);
    if (status) params.set("status", status);
    const { data: bookings } = await adminGet<TeamTdRow[]>(`/admin/td/bookings?${params}`);
    return bookings ?? [];
  };

  const fetchTeamTds = async (status?: string) => {
    const members = !isCreDashboard(data)
      ? data?.team?.byMember ?? data?.teamStats?.byMember ?? []
      : [];
    if (!members.length) return [] as TeamTdRow[];
    const chunks = await Promise.all(
      members.map(async (m) => {
        const params = new URLSearchParams({
          limit: "100",
          assignedExecutive: m._id,
        });
        if (status) params.set("status", status);
        const { data: bookings } = await adminGet<TeamTdRow[]>(`/admin/td/bookings?${params}`);
        return bookings ?? [];
      }),
    );
    return chunks.flat();
  };

  const openTeamMetric = (member: ManagerTeamMemberStats, metric: TeamMetricKey) => {
    const leadMetrics: TeamMetricKey[] = ["leadsCount", "openLeads", "converted", "delivered", "followUpsDue"];
    void showDetail({
      title: `${member.name} · ${TEAM_METRIC_LABELS[metric]}`,
      subtitle: `${member.designation || member.email || "—"} · cover this list if they are on leave.`,
      mode: leadMetrics.includes(metric) ? "leads" : "tds",
      crmLink: `/admin/crm/leads?assignedTo=${member._id}`,
      loader: async () => {
        if (leadMetrics.includes(metric)) {
          const { leads } = await fetchPvCrmLeads({ assignedTo: member._id, limit: 100 });
          if (metric === "openLeads") return { leads: leads.filter((l) => isOpenLead(l.status)) };
          if (metric === "converted") {
            return {
              leads: leads.filter((l) =>
                ["Interested", "Negotiation", "Booking", "Delivered", "Booked"].includes(
                  normalizeCrmStage(l.status || ""),
                ),
              ),
            };
          }
          if (metric === "delivered") {
            return { leads: leads.filter((l) => normalizeCrmStage(l.status || "") === "Delivered") };
          }
          if (metric === "followUpsDue") {
            const now = Date.now();
            return {
              leads: leads.filter(
                (l) => isOpenLead(l.status) && l.nextFollowUp && new Date(l.nextFollowUp).getTime() <= now,
              ),
            };
          }
          return { leads };
        }
        const params = new URLSearchParams({
          limit: "100",
          assignedExecutive: member._id,
        });
        if (metric === "tdCompleted") params.set("status", "COMPLETED");
        const { data: bookings } = await adminGet<TeamTdRow[]>(`/admin/td/bookings?${params}`);
        return { tds: bookings ?? [] };
      },
    });
  };

  const openDashboardCard = (key: DashboardCardKey) => {
    const meta = DASHBOARD_CARD_META[key];
    const rangeFrom = (!isCreDashboard(data) && data?.period?.from) || from || `${year}-01-01`;
    const rangeTo = (!isCreDashboard(data) && data?.period?.to) || to || `${year}-12-31`;

    void showDetail({
      title: key.startsWith("year_") ? `${meta.title.replace("(year)", String(year))}` : meta.title,
      mode: meta.mode,
      crmLink:
        key === "my_leads"
          ? "/admin/crm/leads?assignedTo=me"
          : key === "followups_due" || key === "followups_pending" || key === "followups_overdue"
            ? "/admin/crm/leads"
            : "/admin/crm/leads",
      loader: async () => {
        switch (key) {
          case "my_leads": {
            const { leads } = await fetchPvCrmLeads({ assignedTo: "me", limit: 100 });
            return { leads };
          }
          case "my_tds":
            return { tds: await fetchMyTds() };
          case "team_leads": {
            const members =
              data && !isCreDashboard(data)
                ? data.team?.byMember ?? data.teamStats?.byMember ?? []
                : [];
            if (!members.length) return { leads: [] };
            const chunks = await Promise.all(
              members.map(async (m) => {
                const { leads } = await fetchPvCrmLeads({ assignedTo: m._id, limit: 100 });
                return leads;
              }),
            );
            return { leads: chunks.flat() };
          }
          case "team_tds":
            return { tds: await fetchTeamTds() };
          case "pending_leads": {
            const { leads } = await fetchPvCrmLeads({ limit: 100 });
            return { leads: leads.filter((l) => isOpenLead(l.status)) };
          }
          case "followups_due": {
            const { leads } = await fetchPvCrmLeads({ followUpDue: true, limit: 100 });
            return { leads };
          }
          case "completed_tds":
            return { tds: await fetchMyTds("COMPLETED") };
          case "team_performance": {
            const { leads } = await fetchPvCrmLeads({ limit: 100 });
            return { leads };
          }
          case "year_leads": {
            if (!isCreDashboard(data) && data?.leads?.leadDetailRows?.length) {
              return { leads: data.leads.leadDetailRows.map(reportRowToLead) };
            }
            const { leads } = await fetchPvCrmLeads({
              assignedTo: "me",
              from: rangeFrom,
              to: rangeTo,
              limit: 100,
            });
            return { leads };
          }
          case "year_tds": {
            if (!isCreDashboard(data) && data?.recentBookings?.length) {
              return { tds: data.recentBookings.map(bookingFromRecent) };
            }
            return { tds: await fetchMyTds() };
          }
          case "year_td_completed": {
            const fromDash = (!isCreDashboard(data) ? data?.recentBookings ?? [] : [])
              .filter((b) => b.status === "COMPLETED")
              .map(bookingFromRecent);
            if (fromDash.length) return { tds: fromDash };
            return { tds: await fetchMyTds("COMPLETED") };
          }
          case "active_leads": {
            const { leads } = await fetchPvCrmLeads({
              assignedTo: "me",
              from: rangeFrom,
              to: rangeTo,
              limit: 100,
            });
            return { leads: leads.filter((l) => isOpenLead(l.status)) };
          }
          case "followups_pending":
          case "followups_overdue": {
            const { leads } = await fetchPvCrmLeads({
              assignedTo: "me",
              followUpDue: true,
              limit: 100,
            });
            return { leads };
          }
          default:
            return {};
        }
      },
    });
  };

  const pipelineData = useMemo(() => {
    const pipeline = readPipelineMap(data);
    return Object.entries(pipeline)
      .filter(([, v]) => Number(v) > 0)
      .map(([name, value]) => ({ name, value: Number(value) }));
  }, [data]);

  const sourceData = useMemo(() => {
    const bySource = readBySourceMap(data);
    return Object.entries(bySource).map(([name, value]) => ({ name, value: Number(value) }));
  }, [data]);

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

  if (isCreDashboard(data)) {
    return (
      <div className="space-y-6">
        <CrmActionCentre data={actionCentre} />
        <CreMyDashboard
        data={data}
        year={year}
        setYear={setYear}
        loading={loading}
        onRefresh={() => void load()}
        adminName={adminUser?.name}
        pipelineData={pipelineData}
        sourceData={sourceData}
        openAssignedLeads={() =>
          void showDetail({
            title: "Assigned leads (created by you)",
            subtitle: "Leads you created that are assigned to an executive.",
            mode: "leads",
            loader: async () => ({
              leads: (data.recentLeads || [])
                .filter((l) => l.assignedTo?._id)
                .map(
                  (l) =>
                    ({
                      _id: l._id,
                      name: l.name,
                      mobile: l.mobile,
                      model: l.model,
                      status: l.status,
                      source: l.source,
                      assignedTo: l.assignedTo
                        ? { _id: l.assignedTo._id, name: l.assignedTo.name }
                        : null,
                      createdAt: l.createdAt,
                    }) as PvCrmLead,
                ),
            }),
          })
        }
        openUnassignedLeads={() =>
          void showDetail({
            title: "Unassigned leads (created by you)",
            subtitle: "Leads you created that still need an executive.",
            mode: "leads",
            loader: async () => ({
              leads: (data.recentLeads || [])
                .filter((l) => !l.assignedTo?._id)
                .map(
                  (l) =>
                    ({
                      _id: l._id,
                      name: l.name,
                      mobile: l.mobile,
                      model: l.model,
                      status: l.status,
                      source: l.source,
                      assignedTo: null,
                      createdAt: l.createdAt,
                    }) as PvCrmLead,
                ),
            }),
          })
        }
        openAllRecent={() =>
          void showDetail({
            title: `Leads created (${data.year})`,
            subtitle: "Recent leads created by you — assigned and unassigned.",
            mode: "leads",
            loader: async () => ({
              leads: (data.recentLeads || []).map(
                (l) =>
                  ({
                    _id: l._id,
                    name: l.name,
                    mobile: l.mobile,
                    model: l.model,
                    status: l.status,
                    source: l.source,
                    assignedTo: l.assignedTo
                      ? { _id: l.assignedTo._id, name: l.assignedTo.name }
                      : null,
                    createdAt: l.createdAt,
                  }) as PvCrmLead,
              ),
            }),
          })
        }
        detailOpen={detailOpen}
        detailLoading={detailLoading}
        detailTitle={detailTitle}
        detailSubtitle={detailSubtitle}
        detailMode={detailMode}
        detailLeads={detailLeads}
        detailTds={detailTds}
        detailCrmLink={detailCrmLink}
        detailTdLink={detailTdLink}
        closeDetail={closeDetail}
      />
      </div>
    );
  }

  const execData = data as ExecutiveDashboard;
  const selfBlock = execData.self || execData;
  const leads = selfBlock.leads;
  const leadsCompare = selfBlock.leadsCompare;
  const testDrives = selfBlock.testDrives;
  const testDrivesCompare = selfBlock.testDrivesCompare;

  if (!leads?.overview || !testDrives || !leadsCompare?.overview || !testDrivesCompare) {
    return (
      <div className="text-center py-24 text-muted-foreground space-y-3">
        <p>Dashboard data is incomplete. Please refresh.</p>
        <Button variant="outline" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  const team = execData.team || execData.teamStats;
  const teamMembers = team?.byMember ?? [];
  const isManagerView =
    (execData.view === "manager" || execData.reportType === "manager") && !!team;

  const selfPerformance = (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs">
          {execData.period?.period || period}: {fmtDate(execData.period?.from)} – {fmtDate(execData.period?.to)}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          All-time (you): {selfBlock.allTime?.totalLeads ?? 0} leads · {selfBlock.allTime?.totalTestDrives ?? 0} test drives
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CompareStat
          label={`My leads (${execData.year})`}
          current={leads.overview.totalLeads}
          previous={leadsCompare.overview.totalLeads}
          icon={Users}
          onClick={() => openDashboardCard("year_leads")}
        />
        <CompareStat
          label={`My test drives (${execData.year})`}
          current={testDrives.totalBookings}
          previous={testDrivesCompare.totalBookings}
          icon={CalendarCheck}
          onClick={() => openDashboardCard("year_tds")}
        />
        <CompareStat
          label="TD completed"
          current={testDrives.completed}
          previous={testDrivesCompare.completed}
          icon={Target}
          onClick={() => openDashboardCard("year_td_completed")}
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
          { label: "Active leads", value: leads.overview.activeLeads, key: "active_leads" as const },
          { label: "Follow-ups pending", value: leads.followUpSummary?.pending ?? 0, key: "followups_pending" as const },
          { label: "Follow-ups overdue", value: leads.followUpSummary?.overdue ?? 0, key: "followups_overdue" as const },
          { label: "TD completion rate", value: `${testDrives.completionRate}%`, key: null },
        ].map((item) => {
          const clickable = Boolean(item.key) && typeof item.value === "number" && item.value > 0;
          return (
            <Card
              key={item.label}
              className={cn(
                "p-3 border-border/50",
                clickable && "cursor-pointer hover:border-primary/40 transition-colors",
              )}
              onClick={
                clickable && item.key
                  ? () => openDashboardCard(item.key as DashboardCardKey)
                  : undefined
              }
            >
              <p className="text-[11px] text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "text-lg font-bold mt-0.5",
                  clickable ? "text-primary" : undefined,
                )}
              >
                {item.value}
              </p>
              {clickable ? (
                <p className="text-[10px] text-muted-foreground mt-0.5">Click for details</p>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Card className="p-4 border-border/50">
        <h3 className="font-semibold text-sm mb-4">{execData.year} monthly performance</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={selfBlock.monthly ?? []}>
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
          <TabsTrigger value="leads">My Leads ({leads.leadDetailRows?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="test-drives">Test Drives ({(selfBlock.recentBookings?.length ?? 0)})</TabsTrigger>
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
                <p className="text-sm text-muted-foreground py-8 text-center">No leads in {execData.year}</p>
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
              {(leads.activityLog?.length ? leads.activityLog.map((row, i) => {
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
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <Card className="border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Your leads — {execData.year}</h3>
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
                  {(leads.leadDetailRows?.length ? leads.leadDetailRows.map((row) => (
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
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No leads assigned in {execData.year}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="test-drives" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: testDrives.totalBookings, key: "year_tds" as const },
              { label: "Completed", value: testDrives.completed, key: "year_td_completed" as const },
              { label: "Pending", value: testDrives.pending, key: "year_tds" as const },
              { label: "Avg feedback", value: testDrives.avgFeedbackRating || "—", key: null },
            ].map((item) => {
              const clickable = Boolean(item.key) && typeof item.value === "number" && item.value > 0;
              return (
                <Card
                  key={item.label}
                  className={cn(
                    "p-3 border-border/50",
                    clickable && "cursor-pointer hover:border-primary/40 transition-colors",
                  )}
                  onClick={
                    clickable && item.key
                      ? () => openDashboardCard(item.key as DashboardCardKey)
                      : undefined
                  }
                >
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className={cn("text-lg font-bold", clickable && "text-primary")}>{item.value}</p>
                </Card>
              );
            })}
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
                  {(selfBlock.recentBookings?.length ?? 0) ? selfBlock.recentBookings!.map((b) => (
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
              {execData.year} vs {execData.compareYear} comparison
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 text-muted-foreground font-medium">Metric</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">{execData.year}</th>
                    <th className="text-right p-3 text-muted-foreground font-medium">{execData.compareYear}</th>
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
              <h3 className="font-semibold text-sm mb-3">Lead sources — {execData.year} vs {execData.compareYear}</h3>
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
                  <Bar dataKey="current" name={String(execData.year)} fill="#00d4ff" />
                  <Bar dataKey="previous" name={String(execData.compareYear)} fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4 border-border/50">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" /> Feedback summary
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Avg rating ({execData.year})</span><span className="font-semibold">{testDrives.avgFeedbackRating || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg purchase intent</span><span className="font-semibold">{testDrives.avgPurchaseIntention || "—"}/5</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Feedback count</span><span className="font-semibold">{testDrives.feedbackCount}</span></div>
              </div>
              {(leads.feedbackRows?.length ? (
                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
                  {leads.feedbackRows.slice(0, 5).map((fb, i) => (
                    <div key={i} className="text-xs border-t border-border/30 pt-2 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{fb.leadName}</span>
                      <span className="text-muted-foreground">{fb.overallRating}⭐ · intent {fb.purchaseIntention}/5</span>
                    </div>
                  ))}
                </div>
              ) : null)}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );

  const teamBlock = execData.team;
  const legacyTeam = execData.teamStats;
  const teamPerformance = isManagerView ? (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CountCard
          label="Team leads"
          value={teamBlock?.leadsCount ?? legacyTeam?.teamLeads ?? 0}
          hint={`${teamBlock?.teamSize ?? legacyTeam?.teamSize ?? 0} member(s)`}
          onClick={() => openDashboardCard("team_leads")}
        />
        <CountCard
          label="TD completed"
          value={teamBlock?.tdCompleted ?? legacyTeam?.teamCompletedTestDrives ?? 0}
          icon={CheckCircle2}
          iconClass="text-green-500"
          onClick={() => openDashboardCard("team_tds")}
        />
        <CountCard
          label="Converted"
          value={teamBlock?.converted ?? 0}
          icon={Target}
          onClick={() => openDashboardCard("team_performance")}
        />
        <CountCard
          label="Delivered"
          value={teamBlock?.delivered ?? 0}
          icon={CheckCircle2}
        />
        <CountCard
          label="Follow-ups due"
          value={teamBlock?.followUpsDue ?? legacyTeam?.followUpsDue ?? 0}
          icon={Clock}
          iconClass="text-amber-500"
          onClick={() => openDashboardCard("followups_due")}
        />
        <CountCard
          label="Conversion rate"
          value={teamBlock?.conversionRate ?? 0}
          hint="Team converted / leads %"
        />
        <CountCard
          label="Pending leads"
          value={teamBlock?.pendingLeads ?? legacyTeam?.pendingLeads ?? 0}
          onClick={() => openDashboardCard("pending_leads")}
        />
        <CountCard
          label="Team test drives"
          value={teamBlock?.teamTestDrives ?? legacyTeam?.teamTestDrives ?? 0}
          onClick={() => openDashboardCard("team_tds")}
        />
      </div>

      {teamMembers.length > 0 ? (
        <Card className="bg-card border-border/50 p-4">
          <h2 className="font-display text-lg font-semibold text-foreground mb-1">By team member</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Click any count to see the detailed list — useful when a team member is on leave.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                  <th className="pb-2 pr-3 font-medium">Team member</th>
                  <th className="pb-2 pr-3 font-medium">Leads</th>
                  <th className="pb-2 pr-3 font-medium">TD done</th>
                  <th className="pb-2 pr-3 font-medium">Converted</th>
                  <th className="pb-2 pr-3 font-medium">Delivered</th>
                  <th className="pb-2 pr-3 font-medium">Follow-ups</th>
                  <th className="pb-2 font-medium">Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((m) => (
                  <tr key={m._id} className="border-b border-border/30">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-foreground">{m.name}</p>
                      <p className="text-[11px] text-muted-foreground">{m.designation || m.email}</p>
                    </td>
                    {(
                      [
                        "leadsCount",
                        "tdCompleted",
                        "converted",
                        "delivered",
                        "followUpsDue",
                      ] as const
                    ).map((metric) => {
                      const value = memberMetric(m, metric);
                      return (
                        <td key={metric} className="py-2.5 pr-3">
                          <button
                            type="button"
                            disabled={value <= 0}
                            onClick={() => void openTeamMetric(m, metric)}
                            className={cn(
                              "tabular-nums font-semibold rounded px-1.5 py-0.5 transition-colors",
                              value > 0
                                ? "text-primary hover:bg-primary/10 underline-offset-2 hover:underline"
                                : "text-muted-foreground cursor-default",
                            )}
                          >
                            {value}
                          </button>
                        </td>
                      );
                    })}
                    <td className="py-2.5 tabular-nums font-semibold">
                      {m.conversionRate ?? 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground border-border/50">
          No reporting team members found for this period.
        </Card>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            My Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {adminUser?.name ?? "Executive"} ·{" "}
            {isManagerView
              ? "Team and personal performance"
              : "Leads & test drives assigned to you"}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
      </div>

      <CrmActionCentre data={actionCentre} />
      {isManagerView && actionCentre?.team?.members?.length ? (
        <Card className="p-4 overflow-x-auto">
          <p className="text-sm font-semibold mb-3">Team Action Centre</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-2">Employee</th>
                <th className="py-2 pr-2">New Enquiry</th>
                <th className="py-2 pr-2">Follow-up Today</th>
                <th className="py-2 pr-2">Overdue</th>
                <th className="py-2 pr-2">TD Today</th>
                <th className="py-2 pr-2">HOT</th>
                <th className="py-2 pr-2">Booking</th>
                <th className="py-2">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {actionCentre.team.members.map((m) => (
                <tr key={m._id} className="border-b border-border/40">
                  <td className="py-2 pr-2 font-medium">{m.name}</td>
                  <td className="py-2 pr-2">{m.newEnquiry}</td>
                  <td className="py-2 pr-2">{m.followUpToday}</td>
                  <td className="py-2 pr-2">{m.overdue}</td>
                  <td className="py-2 pr-2">{m.tdToday}</td>
                  <td className="py-2 pr-2">{m.hot}</td>
                  <td className="py-2 pr-2">{m.booking}</td>
                  <td className="py-2">{m.delivery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
      </div>

      <Card className="bg-card border-border/50 p-4 space-y-4">
        <ReportPeriodPresets
          value={period}
          onChange={setPeriod}
          from={from}
          to={to}
          year={year}
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
      </Card>

      {isManagerView ? (
        <Tabs value={managerTab} onValueChange={setManagerTab}>
          <TabsList>
            <TabsTrigger value="team">Team Performance</TabsTrigger>
            <TabsTrigger value="self">Self Performance</TabsTrigger>
          </TabsList>
          <TabsContent value="team" className="mt-4 space-y-4">
            {teamPerformance}
          </TabsContent>
          <TabsContent value="self" className="mt-4 space-y-4">
            {selfPerformance}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-4">{selfPerformance}</div>
      )}

      <Dialog
        open={detailOpen}
        onOpenChange={(o) => {
          if (!o) closeDetail();
        }}
      >
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{detailTitle}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">{detailSubtitle}</p>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading list…
            </div>
          ) : detailMode === "leads" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{detailLeads.length}</strong> lead(s)
                </p>
                <Link to={detailCrmLink} className="text-xs text-primary hover:underline">
                  Open in Lead CRM
                </Link>
              </div>
              <div className="max-h-[24rem] overflow-y-auto rounded-md border border-border/50 text-xs">
                <table className="w-full">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Name</th>
                      <th className="p-2 font-medium">Mobile</th>
                      <th className="p-2 font-medium">Model</th>
                      <th className="p-2 font-medium">Stage</th>
                      <th className="p-2 font-medium">Assigned</th>
                      <th className="p-2 font-medium">Follow-up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLeads.length ? (
                      detailLeads.map((lead) => {
                        const assignee = lead.assignedTo?.name || "Unassigned";
                        const isAssigned = Boolean(lead.assignedTo?._id || lead.assignedTo?.name);
                        return (
                          <tr key={lead._id} className="border-t border-border/40">
                            <td className="p-2 align-top font-medium">{lead.name}</td>
                            <td className="p-2 align-top font-mono">{lead.mobile || "—"}</td>
                            <td className="p-2 align-top">{lead.model || "—"}</td>
                            <td className="p-2 align-top">
                              <Badge
                                className={cn(
                                  "text-[10px]",
                                  STAGE_COLORS[normalizeCrmStage(lead.status)] ?? "bg-muted",
                                )}
                              >
                                {normalizeCrmStage(lead.status)}
                              </Badge>
                            </td>
                            <td className="p-2 align-top">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  isAssigned
                                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                                    : "border-amber-500/40 text-amber-700 dark:text-amber-400",
                                )}
                              >
                                {isAssigned ? assignee : "Not assigned"}
                              </Badge>
                            </td>
                            <td className="p-2 align-top text-muted-foreground">
                              {fmtDate(lead.nextFollowUp)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-muted-foreground">
                          No leads in this list.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{detailTds.length}</strong> test drive(s)
                </p>
                <Link to={detailTdLink} className="text-xs text-primary hover:underline">
                  Open TD Bookings
                </Link>
              </div>
              <div className="max-h-[24rem] overflow-y-auto rounded-md border border-border/50 text-xs">
                <table className="w-full">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left">
                      <th className="p-2 font-medium">Booking</th>
                      <th className="p-2 font-medium">Customer</th>
                      <th className="p-2 font-medium">Mobile</th>
                      <th className="p-2 font-medium">Model</th>
                      <th className="p-2 font-medium">Slot</th>
                      <th className="p-2 font-medium">Status</th>
                      <th className="p-2 font-medium">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailTds.length ? (
                      detailTds.map((b) => {
                        const name =
                          b.testDriveId?.customerName || b.customerId?.name || "—";
                        const mobile =
                          b.testDriveId?.mobile || b.customerId?.mobile || "—";
                        const model = b.preferredModel || b.testDriveId?.model || "—";
                        const isAssigned = Boolean(b.assignedExecutive?._id);
                        return (
                          <tr key={b._id} className="border-t border-border/40">
                            <td className="p-2 align-top font-mono">{b.bookingId || "—"}</td>
                            <td className="p-2 align-top font-medium">{name}</td>
                            <td className="p-2 align-top font-mono">{mobile}</td>
                            <td className="p-2 align-top">{model}</td>
                            <td className="p-2 align-top whitespace-nowrap">
                              {fmtDate(b.slotDate)} {b.slotTime || ""}
                            </td>
                            <td className="p-2 align-top">
                              <Badge
                                className={cn(
                                  "text-[10px]",
                                  bookingStatusBadge(b.bookingStatus || ""),
                                )}
                              >
                                {b.bookingStatus || "—"}
                              </Badge>
                            </td>
                            <td className="p-2 align-top">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px]",
                                  isAssigned
                                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                                    : "border-amber-500/40 text-amber-700 dark:text-amber-400",
                                )}
                              >
                                {isAssigned
                                  ? b.assignedExecutive?.name || "Assigned"
                                  : "Not assigned"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">
                          No test drives in this list.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={closeDetail}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
