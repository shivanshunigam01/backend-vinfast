import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminGet, formatApiErrors } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, RefreshCw, Loader2, TrendingUp, Users,
  CalendarCheck, Star, CheckCircle2, XCircle, Clock, Target, MessageSquare
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/tdSlotSchedule";
import ReportPeriodPresets, { type ReportPeriod } from "@/components/admin/ReportPeriodPresets";
import { resolvePeriodRange } from "@/lib/reportPeriod";

type AdminReport = {
  overview: {
    totalBookings: number;
    completed: number;
    pending: number;
    cancelled: number;
    missed: number;
    inProgress: number;
    totalCustomers: number;
    completionRate: number;
    leadConversionRate: number;
    leadsFromTestDrives: number;
    convertedToBusiness: number;
    feedbackCount: number;
  };
  vehicleFleet: Record<string, number>;
  vehicleAvailability: { model: string; total: number; available: number; booked: number; other: number }[];
  feedback: { avgOverall: number; avgPurchase?: number; count: number };
  charts: {
    bookingsByStatus: Record<string, number>;
    bookingsByModel: Record<string, number>;
    bookingTrend: { _id: string; count: number }[];
    leadByStatus?: Record<string, number>;
  };
  executivePerformance: { _id: string; name: string; total: number; completed: number }[];
  topFeedback: FeedbackRow[];
  allFeedback: FeedbackRow[];
  customerTestDriveLog: CustomerDriveRow[];
  vehicleWiseReport: VehicleReportRow[];
};

type FeedbackRow = {
  createdAt?: string;
  customerName: string;
  mobile: string;
  bookingId: string;
  slotDate?: string;
  slotTime?: string;
  model: string;
  vehicleLabel: string;
  executiveName: string;
  overallRating?: number;
  purchaseIntention?: number;
  remarks: string;
  bookingRemarks?: string;
  leadStatus?: string | null;
  converted?: boolean;
};

type CustomerDriveRow = {
  bookingId: string;
  customerName: string;
  mobile: string;
  model: string;
  variant: string;
  vehicleLabel: string;
  slotDate: string;
  slotTime: string;
  status: string;
  executiveName: string;
  remarks: string;
  feedback: { overallRating?: number; purchaseIntention?: number; remarks?: string } | null;
  leadStatus?: string | null;
  converted?: boolean;
};

type VehicleReportRow = {
  vehicleId: string;
  registrationNo: string;
  model: string;
  variant: string;
  color: string;
  status: string;
  availableAgainAt?: string | null;
  batteryPercent: number;
  totalTestDrives: number;
  totalKM: number;
  branchName: string;
  avgFeedbackRating: number | null;
  completedDrives: number;
  scheduledBookings: number;
  customers: {
    name: string;
    mobile: string;
    slotDate: string;
    slotTime: string;
    bookingId: string;
    feedbackRating?: number | null;
    purchaseIntention?: number | null;
    feedbackRemarks: string;
    executiveRemarks: string;
    leadStatus?: string | null;
    converted?: boolean;
  }[];
};

const CHART_COLORS = ["#00d4ff", "#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

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

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminTDReports() {
  const [data, setData] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const initialRange = resolvePeriodRange({ period: "monthly" });
  const [period, setPeriod] = useState<ReportPeriod>(initialRange.period);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupTitle, setPopupTitle] = useState("");
  const [popupMode, setPopupMode] = useState<"bookings" | "feedback">("bookings");
  const [popupBookings, setPopupBookings] = useState<CustomerDriveRow[]>([]);
  const [popupFeedback, setPopupFeedback] = useState<FeedbackRow[]>([]);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await adminGet<AdminReport>(`/admin/td/reports/admin?${params}`);
      setData(res.data);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void fetchReport(); }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading reports...
      </div>
    );
  }

  if (!data) return null;

  const overview = data.overview ?? {
    totalBookings: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
    missed: 0,
    inProgress: 0,
    totalCustomers: 0,
    completionRate: 0,
    leadConversionRate: 0,
    leadsFromTestDrives: 0,
    convertedToBusiness: 0,
    feedbackCount: 0,
  };
  const vehicleFleet = data.vehicleFleet ?? {};
  const vehicleAvailability = data.vehicleAvailability ?? [];
  const feedback = data.feedback ?? { avgOverall: 0, count: 0 };
  const charts = {
    bookingsByStatus: data.charts?.bookingsByStatus ?? {},
    bookingsByModel: data.charts?.bookingsByModel ?? {},
    bookingTrend: data.charts?.bookingTrend ?? [],
    leadByStatus: data.charts?.leadByStatus ?? {},
  };
  const executivePerformance = data.executivePerformance ?? [];
  const allFeedback = data.allFeedback ?? [];
  const customerTestDriveLog = data.customerTestDriveLog ?? [];
  const vehicleWiseReport = data.vehicleWiseReport ?? [];

  const bookingStatusData = Object.entries(charts.bookingsByStatus).map(([name, value]) => ({ name, value }));
  const modelData = Object.entries(charts.bookingsByModel).map(([name, value]) => ({ name: name || "Unknown", value }));
  const leadStatusData = Object.entries(charts.leadByStatus ?? {}).map(([name, value]) => ({ name, value }));
  const convertedRows = customerTestDriveLog.filter((r) => r.converted);
  const leadsFromTdRows = customerTestDriveLog.filter((r) => Boolean(r.leadStatus));

  const openBookingPopup = (title: string, rows: CustomerDriveRow[]) => {
    setPopupTitle(title);
    setPopupMode("bookings");
    setPopupBookings(rows);
    setPopupOpen(true);
  };

  const openFeedbackPopup = (title: string, rows: FeedbackRow[]) => {
    setPopupTitle(title);
    setPopupMode("feedback");
    setPopupFeedback(rows);
    setPopupOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" /> TD Reports & Analytics
          </h1>
          <p className="text-muted-foreground text-sm">
            Test drives, vehicle usage, customer feedback & lead conversion ·{" "}
            <Link to="/admin/td/leads/reports" className="text-primary hover:underline">Lead CRM reports</Link>
          </p>
        </div>
        <Button onClick={() => void fetchReport()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card className="bg-card border-border/50 p-4 space-y-4">
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
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void fetchReport()} className="bg-primary text-primary-foreground shrink-0">
            Apply Filter
          </Button>
          <Button
            onClick={() => {
              const range = resolvePeriodRange({ period: "monthly" });
              setPeriod(range.period);
              setFrom(range.from);
              setTo(range.to);
            }}
            variant="outline"
            className="shrink-0"
          >
            Clear
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Bookings"
          value={overview.totalBookings}
          icon={CalendarCheck}
          onClick={() => openBookingPopup("Total Bookings", customerTestDriveLog)}
        />
        <StatCard
          label="Completed TDs"
          value={overview.completed}
          icon={CheckCircle2}
          color="text-green-400"
          sub={`${overview.completionRate}% completion`}
          onClick={() => openBookingPopup("Completed TDs", customerTestDriveLog.filter((r) => r.status === "COMPLETED"))}
        />
        <StatCard
          label="Lead conversion"
          value={`${overview.leadConversionRate}%`}
          icon={Target}
          color="text-primary"
          sub={`${overview.convertedToBusiness} of ${overview.completed} became business`}
          onClick={() => openBookingPopup("Converted To Business", convertedRows)}
        />
        <StatCard
          label="Avg Feedback"
          value={feedback.count > 0 ? `${feedback.avgOverall?.toFixed(1)} ⭐` : "N/A"}
          icon={Star}
          color="text-yellow-400"
          sub={`${feedback.count} reviews`}
          onClick={() => openFeedbackPopup("All Feedback", allFeedback)}
        />
        <StatCard
          label="Pending / Confirmed"
          value={overview.pending}
          icon={Clock}
          color="text-yellow-400"
          onClick={() => openBookingPopup("Pending / Confirmed TDs", customerTestDriveLog.filter((r) => r.status === "PENDING" || r.status === "CONFIRMED"))}
        />
        <StatCard
          label="In Progress"
          value={overview.inProgress}
          icon={TrendingUp}
          color="text-purple-400"
          onClick={() => openBookingPopup("In Progress TDs", customerTestDriveLog.filter((r) => r.status === "IN_PROGRESS"))}
        />
        <StatCard
          label="Leads from TD"
          value={overview.leadsFromTestDrives}
          icon={Users}
          onClick={() => openBookingPopup("Leads From TD", leadsFromTdRows)}
        />
        <StatCard
          label="Cancelled / Missed"
          value={overview.cancelled + overview.missed}
          icon={XCircle}
          color="text-red-400"
          onClick={() => openBookingPopup("Cancelled / Missed TDs", customerTestDriveLog.filter((r) => r.status === "CANCELLED" || r.status === "MISSED"))}
        />
      </div>

      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{popupTitle}</DialogTitle>
          </DialogHeader>
          {popupMode === "bookings" ? (
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left p-2">Booking</th>
                    <th className="text-left p-2">Customer</th>
                    <th className="text-left p-2">Model / Vehicle</th>
                    <th className="text-left p-2">Slot</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Executive</th>
                    <th className="text-left p-2">Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {popupBookings.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No records found</td></tr>
                  ) : (
                    popupBookings.map((row) => (
                      <tr key={`${row.bookingId}-${row.mobile}`} className="border-b border-border/20">
                        <td className="p-2 font-mono">{row.bookingId}</td>
                        <td className="p-2"><p className="font-medium">{row.customerName}</p><p className="text-muted-foreground">{row.mobile}</p></td>
                        <td className="p-2"><p>{row.model} {row.variant !== "—" ? row.variant : ""}</p><p className="text-muted-foreground">{row.vehicleLabel}</p></td>
                        <td className="p-2 whitespace-nowrap">{fmtDate(row.slotDate)} {formatTime12h(row.slotTime)}</td>
                        <td className="p-2"><Badge variant="outline">{row.status}</Badge></td>
                        <td className="p-2">{row.executiveName}</td>
                        <td className="p-2">{row.leadStatus ? <Badge variant="outline">{row.leadStatus}</Badge> : "—"}</td>
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
                popupFeedback.map((fb) => (
                  <Card key={`${fb.bookingId}-${fb.mobile}-${fb.createdAt ?? ""}`} className="bg-card border-border/50 p-3">
                    <p className="font-medium text-sm">{fb.customerName} · {fb.mobile}</p>
                    <p className="text-xs text-muted-foreground">
                      {fb.bookingId} · {fmtDate(fb.slotDate)} {fb.slotTime ? formatTime12h(fb.slotTime) : ""} · {fb.model}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Rating: {fb.overallRating ?? "—"}⭐ · Purchase intent: {fb.purchaseIntention ?? "—"}/5
                    </p>
                    {fb.remarks && fb.remarks !== "—" ? <p className="text-xs mt-1">{fb.remarks}</p> : null}
                  </Card>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="vehicles">
        <TabsList className="bg-secondary/50 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="vehicles">Vehicle-wise</TabsTrigger>
          <TabsTrigger value="customers">Customer TD log</TabsTrigger>
          <TabsTrigger value="feedback">All feedback</TabsTrigger>
          <TabsTrigger value="leads">Lead conversion</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="fleet">Fleet status</TabsTrigger>
          <TabsTrigger value="executives">Executives</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="mt-4 space-y-4">
          {vehicleWiseReport.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No demo vehicles found</p>
          ) : (
            vehicleWiseReport.map((v) => (
              <Card key={v.vehicleId} className="bg-card border-border/50 p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{v.vehicleId}</p>
                    <p className="font-semibold text-foreground">{v.model} {v.variant} · {v.registrationNo}</p>
                    <p className="text-xs text-muted-foreground">{v.color} · {v.branchName}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{v.status.replace("_", " ")}</Badge>
                    <Badge variant="outline">{v.completedDrives} completed TDs</Badge>
                    {v.avgFeedbackRating != null ? (
                      <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20">{v.avgFeedbackRating} ⭐ avg</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="grid sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <span>Battery: {v.batteryPercent}%</span>
                  <span>Total KM: {v.totalKM}</span>
                  <span>Scheduled: {v.scheduledBookings}</span>
                  {v.availableAgainAt ? (
                    <span className="text-amber-500">Available again: {fmtDate(v.availableAgainAt)}</span>
                  ) : null}
                </div>
                {(v.customers ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No completed test drives on this vehicle yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left p-2">Customer</th>
                          <th className="text-left p-2">Slot</th>
                          <th className="text-left p-2">Feedback</th>
                          <th className="text-left p-2">Remarks</th>
                          <th className="text-left p-2">Lead</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(v.customers ?? []).map((c, i) => (
                          <tr key={i} className="border-b border-border/20">
                            <td className="p-2"><p className="font-medium">{c.name}</p><p className="text-muted-foreground">{c.mobile}</p></td>
                            <td className="p-2 whitespace-nowrap">{fmtDate(c.slotDate)} {formatTime12h(c.slotTime)}</td>
                            <td className="p-2">{c.feedbackRating != null ? `${c.feedbackRating}⭐ · intent ${c.purchaseIntention ?? "—"}/5` : "—"}</td>
                            <td className="p-2 max-w-[12rem] truncate" title={c.feedbackRemarks}>{c.feedbackRemarks}</td>
                            <td className="p-2">
                              {c.converted ? (
                                <Badge className="bg-green-400/10 text-green-400 border-green-400/20">{c.leadStatus}</Badge>
                              ) : c.leadStatus ? (
                                <Badge variant="outline">{c.leadStatus}</Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="customers" className="mt-4">
          <Card className="bg-card border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 bg-secondary/30 text-muted-foreground">
                    <th className="text-left p-3">Booking</th>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Model / Vehicle</th>
                    <th className="text-left p-3">Slot</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Executive</th>
                    <th className="text-left p-3">Feedback</th>
                    <th className="text-left p-3">Lead</th>
                  </tr>
                </thead>
                <tbody>
                  {customerTestDriveLog.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No test drive records</td></tr>
                  ) : (
                    customerTestDriveLog.map((row) => (
                      <tr key={row.bookingId} className="border-b border-border/20 hover:bg-secondary/10">
                        <td className="p-3 font-mono">{row.bookingId}</td>
                        <td className="p-3"><p className="font-medium">{row.customerName}</p><p className="text-muted-foreground">{row.mobile}</p></td>
                        <td className="p-3"><p>{row.model} {row.variant !== "—" ? row.variant : ""}</p><p className="text-muted-foreground">{row.vehicleLabel}</p></td>
                        <td className="p-3 whitespace-nowrap">{fmtDate(row.slotDate)} {formatTime12h(row.slotTime)}</td>
                        <td className="p-3"><Badge variant="outline">{row.status}</Badge></td>
                        <td className="p-3">{row.executiveName}</td>
                        <td className="p-3">{row.feedback ? `${row.feedback.overallRating ?? "—"}⭐` : "—"}</td>
                        <td className="p-3">
                          {row.converted ? (
                            <Badge className="bg-green-400/10 text-green-400 border-green-400/20">{row.leadStatus}</Badge>
                          ) : row.leadStatus ? (
                            <Badge variant="outline">{row.leadStatus}</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4 space-y-3">
          {allFeedback.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No feedback submitted yet</p>
          ) : (
            allFeedback.map((fb, i) => (
              <Card key={i} className="bg-card border-border/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{fb.customerName} · {fb.mobile}</p>
                    <p className="text-xs text-muted-foreground">
                      {fb.bookingId} · {fmtDate(fb.slotDate)} {fb.slotTime ? formatTime12h(fb.slotTime) : ""} · {fb.model} · {fb.vehicleLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">Executive: {fb.executiveName}</p>
                  </div>
                  <Badge className="bg-yellow-400/10 text-yellow-400 border-yellow-400/20 shrink-0">
                    {fb.overallRating?.toFixed(1)} ⭐ · intent {fb.purchaseIntention ?? "—"}/5
                  </Badge>
                </div>
                {fb.remarks && fb.remarks !== "—" ? (
                  <p className="text-sm text-muted-foreground mt-2 italic">&ldquo;{fb.remarks}&rdquo;</p>
                ) : null}
                {fb.bookingRemarks && fb.bookingRemarks !== "—" ? (
                  <p className="text-xs text-muted-foreground mt-1">Booking notes: {fb.bookingRemarks}</p>
                ) : null}
                {fb.converted ? (
                  <Badge className="mt-2 bg-green-400/10 text-green-400 border-green-400/20">Converted · {fb.leadStatus}</Badge>
                ) : null}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="leads" className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <StatCard label="Completed test drives" value={overview.completed} icon={CheckCircle2} color="text-green-400" />
            <StatCard label="Linked to CRM leads" value={overview.leadsFromTestDrives} icon={Users} />
            <StatCard label="Converted to business" value={overview.convertedToBusiness} icon={Target} color="text-primary" sub="Interested / Negotiation / Booked / Delivered" />
          </div>
          {leadStatusData.length > 0 ? (
            <Card className="bg-card border-border/50 p-4">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Leads by status (from TD customers)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={leadStatusData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          ) : null}
          <Card className="bg-card border-border/50 p-4">
            <h3 className="font-semibold text-sm mb-3">Converted customers</h3>
            <div className="space-y-2">
              {convertedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No converted leads yet — capture feedback after test drives to create CRM leads.</p>
              ) : (
                convertedRows.map((r) => (
                  <div key={r.bookingId} className="flex flex-wrap justify-between gap-2 text-sm border-b border-border/20 pb-2">
                    <span className="font-medium">{r.customerName}</span>
                    <span className="text-muted-foreground">{r.model} · {fmtDate(r.slotDate)}</span>
                    <Badge className="bg-green-400/10 text-green-400 border-green-400/20">{r.leadStatus}</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="charts" className="space-y-6 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-card border-border/50 p-4">
              <h3 className="font-semibold text-sm mb-4">Booking Trend</h3>
              {charts.bookingTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts.bookingTrend}>
                    <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm text-center py-10">No data</p>}
            </Card>
            <Card className="bg-card border-border/50 p-4">
              <h3 className="font-semibold text-sm mb-4">Bookings by Status</h3>
              {bookingStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={bookingStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }: { name: string; value: number }) => `${name}: ${value}`} fontSize={10}>
                      {bookingStatusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm text-center py-10">No data</p>}
            </Card>
            <Card className="bg-card border-border/50 p-4">
              <h3 className="font-semibold text-sm mb-4">Bookings by Model</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={modelData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fleet" className="mt-4 space-y-4">
          {vehicleAvailability.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {vehicleAvailability.map((v) => (
                <Card key={v.model} className="bg-card border-border/50 p-4">
                  <p className="font-semibold">{v.model}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Total: {v.total}</span>
                    <span className="text-green-400">Available: {v.available}</span>
                    <span className="text-blue-400">Booked: {v.booked}</span>
                    <span>Other: {v.other}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : null}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(vehicleFleet).map(([status, count]) => (
              <Card key={status} className="bg-card border-border/50 p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{status.replace("_", " ")}</p>
                <p className="text-3xl font-bold text-foreground mt-1">{count}</p>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="executives" className="mt-4">
          {executivePerformance.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No executive data</p>
          ) : (
            <div className="space-y-3">
              {executivePerformance.map((e, i) => (
                <Card key={e._id} className="bg-card border-border/50 p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold text-muted-foreground w-8">#{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-semibold">{e.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">Total: {e.total} · Completed: {e.completed}</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">{e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0}%</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
