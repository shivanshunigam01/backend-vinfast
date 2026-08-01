import { Link } from "react-router-dom";
import {
  BarChart3, RefreshCw, Loader2, Users, UserCheck, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CreDashboard } from "@/lib/executiveDashboardApi";
import type { PvCrmLead } from "@/lib/pvLeadCrmApi";
import { STAGE_COLORS, normalizeCrmStage } from "@/lib/leadStages";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["#00d4ff", "#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];
const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

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

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type Props = {
  data: CreDashboard;
  year: number;
  setYear: (y: number) => void;
  loading: boolean;
  onRefresh: () => void;
  adminName?: string;
  pipelineData: Array<{ name: string; value: number }>;
  sourceData: Array<{ name: string; value: number }>;
  openAssignedLeads: () => void;
  openUnassignedLeads: () => void;
  openAllRecent: () => void;
  detailOpen: boolean;
  detailLoading: boolean;
  detailTitle: string;
  detailSubtitle: string;
  detailMode: "leads" | "tds";
  detailLeads: PvCrmLead[];
  detailTds: TeamTdRow[];
  detailCrmLink: string;
  detailTdLink: string;
  closeDetail: () => void;
};

export function CreMyDashboard({
  data,
  year,
  setYear,
  loading,
  onRefresh,
  adminName,
  pipelineData,
  sourceData,
  openAssignedLeads,
  openUnassignedLeads,
  openAllRecent,
  detailOpen,
  detailLoading,
  detailTitle,
  detailSubtitle,
  detailMode,
  detailLeads,
  detailTds,
  detailCrmLink,
  detailTdLink,
  closeDetail,
}: Props) {
  const ov = data.overview || {
    totalCreatedAllTime: 0,
    totalCreated: 0,
    totalCreatedPrev: 0,
    assigned: 0,
    unassigned: 0,
    assignmentRate: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            My Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {adminName || data.cre?.name || "CRE"} · Calling queue — unassigned, unfollowed, and in-calling leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[120px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card
          className={cn(
            "bg-card border-border/50 p-4",
            ov.totalCreated > 0 && "cursor-pointer hover:border-primary/40",
          )}
          onClick={ov.totalCreated > 0 ? openAllRecent : undefined}
        >
          <p className="text-xs text-muted-foreground">Created ({data.year})</p>
          <p className={cn("text-2xl font-bold mt-1", ov.totalCreated > 0 && "text-primary")}>
            {ov.totalCreated}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Prev year {ov.totalCreatedPrev} · all-time {ov.totalCreatedAllTime}
          </p>
          {ov.totalCreated > 0 ? (
            <p className="text-[10px] text-muted-foreground mt-1">Click for details</p>
          ) : null}
        </Card>
        <Card
          className={cn(
            "bg-card border-border/50 p-4",
            ov.assigned > 0 && "cursor-pointer hover:border-primary/40",
          )}
          onClick={ov.assigned > 0 ? openAssignedLeads : undefined}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Assigned</p>
              <p className={cn("text-2xl font-bold mt-1", ov.assigned > 0 && "text-primary")}>
                {ov.assigned}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Assignment rate {ov.assignmentRate}%
              </p>
            </div>
            <UserCheck className="w-5 h-5 text-emerald-500" />
          </div>
        </Card>
        <Card
          className={cn(
            "bg-card border-border/50 p-4",
            ov.unassigned > 0 && "cursor-pointer hover:border-primary/40",
          )}
          onClick={ov.unassigned > 0 ? openUnassignedLeads : undefined}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Unassigned</p>
              <p className={cn("text-2xl font-bold mt-1", ov.unassigned > 0 && "text-primary")}>
                {ov.unassigned}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Need executive assignment</p>
            </div>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
        </Card>
        <Card className="bg-card border-border/50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">All-time created</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{ov.totalCreatedAllTime}</p>
              <Link to="/admin/crm/leads" className="text-[11px] text-primary hover:underline mt-1 inline-block">
                Open Lead CRM
              </Link>
            </div>
            <Users className="w-5 h-5 text-primary" />
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 border-border/50">
          <h3 className="font-semibold text-sm mb-3">Lead pipeline</h3>
          {pipelineData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pipelineData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
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
        <h3 className="font-semibold text-sm mb-4">{data.year} monthly created vs assigned</h3>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.monthly || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="created" name="Created" stroke="#00d4ff" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="assigned" name="Assigned" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-semibold text-sm">Recent leads you created</h3>
          <Button size="sm" variant="outline" onClick={openAllRecent}>
            View list
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                {["Name", "Mobile", "Model", "Stage", "Assigned", "Created"].map((h) => (
                  <th key={h} className="text-left p-3 font-medium text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data.recentLeads || []).length ? (
                (data.recentLeads || []).slice(0, 25).map((lead) => {
                  const assigned = Boolean(lead.assignedTo?._id);
                  return (
                    <tr key={lead._id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="p-3 font-medium">{lead.name}</td>
                      <td className="p-3 font-mono">{lead.mobile || "—"}</td>
                      <td className="p-3">{lead.model || "—"}</td>
                      <td className="p-3">
                        <Badge
                          className={cn(
                            "text-[10px]",
                            STAGE_COLORS[normalizeCrmStage(lead.status || "")] ?? "bg-muted",
                          )}
                        >
                          {normalizeCrmStage(lead.status || "")}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            assigned
                              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                              : "border-amber-500/40 text-amber-700 dark:text-amber-400",
                          )}
                        >
                          {assigned ? lead.assignedTo?.name || "Assigned" : "Not assigned"}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{fmtDate(lead.createdAt)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No leads created in {data.year}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={detailOpen} onOpenChange={(o) => !o && closeDetail()}>
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
              <div className="flex justify-between items-center">
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
                      <th className="p-2 font-medium">Stage</th>
                      <th className="p-2 font-medium">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLeads.length ? (
                      detailLeads.map((lead) => {
                        const isAssigned = Boolean(lead.assignedTo?._id || lead.assignedTo?.name);
                        return (
                          <tr key={lead._id} className="border-t border-border/40">
                            <td className="p-2 font-medium">{lead.name}</td>
                            <td className="p-2 font-mono">{lead.mobile || "—"}</td>
                            <td className="p-2">
                              <Badge
                                className={cn(
                                  "text-[10px]",
                                  STAGE_COLORS[normalizeCrmStage(lead.status)] ?? "bg-muted",
                                )}
                              >
                                {normalizeCrmStage(lead.status)}
                              </Badge>
                            </td>
                            <td className="p-2">
                              {isAssigned ? lead.assignedTo?.name || "Assigned" : "Not assigned"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-muted-foreground">
                          No leads in this list.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {detailTds.length} test drive(s) ·{" "}
              <Link to={detailTdLink} className="text-primary hover:underline">
                Open TD Bookings
              </Link>
            </p>
          )}
          <Button variant="outline" className="w-full" onClick={closeDetail}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
