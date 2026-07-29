import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  Users, Search, RefreshCw, Loader2, Phone, Clock,
  MessageSquare, ArrowRight, CheckCircle2, CalendarClock, UserCheck, BarChart3, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, isFieldStaffUser, canPerformAction, canPerformManagerAction } from "@/lib/adminAuth";
import {
  addCrmFollowUp,
  assignCrmLeadExecutive,
  completeCrmFollowUp,
  fetchAssignableStaffUsers,
  fetchCrmLeadDetail,
  fetchCrmLeads,
  updateCrmLeadRemarks,
  updateCrmLeadStage,
  type AssignableStaffUser,
  type CrmLead,
  type CrmLeadDetail,
} from "@/lib/leadCrmApi";
import { CRM_LEAD_STAGES, normalizeCrmStage, STAGE_COLORS } from "@/lib/leadStages";
import { cn } from "@/lib/utils";
import { AddCrmLeadDialog } from "@/components/admin/AddCrmLeadDialog";

function stageBadgeClass(stage: string) {
  const normalized = normalizeCrmStage(stage);
  return STAGE_COLORS[normalized] ?? "bg-muted text-muted-foreground";
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy · h:mm a");
  } catch {
    return "—";
  }
}

export default function AdminTDLeads() {
  const adminUser = getAdminUser();
  const isExecutive = isFieldStaffUser(adminUser);
  const canCreate = canPerformAction(adminUser, "crm_leads", "create");
  const canUpdate = canPerformAction(adminUser, "crm_leads", "update");
  const canAssignLeads = canPerformManagerAction(adminUser, "crm_leads", "assign");

  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [executives, setExecutives] = useState<AssignableStaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterExecutive, setFilterExecutive] = useState("all");
  const [followUpDueOnly, setFollowUpDueOnly] = useState(false);
  const [selected, setSelected] = useState<CrmLead | null>(null);
  const [detail, setDetail] = useState<CrmLeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [stageDraft, setStageDraft] = useState("");
  const [stageReason, setStageReason] = useState("");
  const [remarksDraft, setRemarksDraft] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpScheduled, setFollowUpScheduled] = useState("");
  const [followUpOutcome, setFollowUpOutcome] = useState("");
  const [followUpCompleted, setFollowUpCompleted] = useState(false);
  const [assignExecutiveId, setAssignExecutiveId] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);

  const loadStaffUsers = useCallback(async () => {
    if (!canAssignLeads) return;
    try {
      const list = await fetchAssignableStaffUsers();
      setExecutives(list);
    } catch (e) {
      toast.error(formatApiErrors(e));
      setExecutives([]);
    }
  }, [canAssignLeads]);

  useEffect(() => {
    void loadStaffUsers();
  }, [loadStaffUsers]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCrmLeads({
        search: search.trim() || undefined,
        status: filterStatus,
        followUpDue: followUpDueOnly,
        assignedTo:
          canAssignLeads && filterExecutive !== "all"
            ? filterExecutive === "unassigned"
              ? "unassigned"
              : filterExecutive
            : undefined,
      });
      setLeads(Array.isArray(res.leads) ? res.leads : []);
    } catch (e) {
      setLeads([]);
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, followUpDueOnly, filterExecutive, canAssignLeads]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of CRM_LEAD_STAGES) counts[s] = 0;
    const rows = Array.isArray(leads) ? leads : [];
    for (const l of rows) {
      const key = normalizeCrmStage(l.status);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [leads]);

  const safeLeads = Array.isArray(leads) ? leads : [];
  const staffUsers = Array.isArray(executives) ? executives : [];
  const detailFollowUps = Array.isArray(detail?.followUps) ? detail.followUps : [];
  const detailHistory = Array.isArray(detail?.history) ? detail.history : [];

  const openLead = async (lead: CrmLead) => {
    setSelected(lead);
    setDetail(null);
    setStageDraft(normalizeCrmStage(lead.status));
    setStageReason("");
    setRemarksDraft(lead.remarks ?? "");
    setFollowUpNote("");
    setFollowUpScheduled("");
    setFollowUpOutcome("");
    setFollowUpCompleted(false);
    setAssignExecutiveId(lead.assignedTo?._id ?? "");
    if (canAssignLeads) void loadStaffUsers();
    setDetailLoading(true);
    try {
      const d = await fetchCrmLeadDetail(lead._id);
      setDetail(d);
      setStageDraft(normalizeCrmStage(d.lead.status));
      setRemarksDraft(d.lead.remarks ?? "");
      setAssignExecutiveId(d.lead.assignedTo?._id ?? "");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (id: string) => {
    const d = await fetchCrmLeadDetail(id);
    setDetail(d);
    setSelected(d.lead);
    setStageDraft(normalizeCrmStage(d.lead.status));
    setRemarksDraft(d.lead.remarks ?? "");
    void loadLeads();
  };

  const handleAssignExecutive = async () => {
    if (!selected || !canAssignLeads) return;
    setSaving(true);
    try {
      await assignCrmLeadExecutive(selected._id, assignExecutiveId || null);
      toast.success(assignExecutiveId ? "Lead assigned to executive" : "Lead unassigned");
      await refreshDetail(selected._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleStageUpdate = async () => {
    if (!selected || !stageDraft) return;
    setSaving(true);
    try {
      await updateCrmLeadStage(selected._id, stageDraft, stageReason.trim() || undefined);
      toast.success(`Stage updated to ${stageDraft}`);
      await refreshDetail(selected._id);
      setStageReason("");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRemarksSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updateCrmLeadRemarks(selected._id, remarksDraft);
      toast.success("Remarks saved");
      await refreshDetail(selected._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!selected || !followUpNote.trim()) {
      toast.error("Enter a follow-up note");
      return;
    }
    setSaving(true);
    try {
      await addCrmFollowUp(selected._id, {
        note: followUpNote.trim(),
        scheduledAt: followUpScheduled || undefined,
        outcome: followUpOutcome.trim() || undefined,
        markCompleted: followUpCompleted,
      });
      toast.success("Follow-up logged");
      setFollowUpNote("");
      setFollowUpScheduled("");
      setFollowUpOutcome("");
      setFollowUpCompleted(false);
      await refreshDetail(selected._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      await completeCrmFollowUp(selected._id, followUpId);
      toast.success("Follow-up marked completed");
      await refreshDetail(selected._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Lead Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isExecutive
              ? "Your assigned leads — update stages, remarks, and follow-ups."
              : "All showroom leads — track conversion and follow-ups."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate ? (
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setShowAddLead(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Lead
            </Button>
          ) : null}
          {!isExecutive ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/td/leads/reports">
                <BarChart3 className="w-4 h-4 mr-2" /> Lead Reports
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void loadLeads()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CRM_LEAD_STAGES.map((s) => (
          <Badge key={s} variant="outline" className={cn("text-xs", stageBadgeClass(s))}>
            {s}: {stageCounts[s] ?? 0}
          </Badge>
        ))}
      </div>

      <div className={`grid grid-cols-1 gap-3 ${canAssignLeads ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, mobile, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="bg-secondary/50">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {CRM_LEAD_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canAssignLeads ? (
          <Select value={filterExecutive} onValueChange={setFilterExecutive}>
            <SelectTrigger className="bg-secondary/50">
              <SelectValue placeholder="Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (my team)</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {staffUsers.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.name}{e.designationLabel ? ` · ${e.designationLabel}` : ""}
                  {adminUser && (e._id === adminUser._id || e.email?.toLowerCase() === adminUser.email?.toLowerCase())
                    ? " · Me"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button
          variant={followUpDueOnly ? "default" : "outline"}
          size="sm"
          className="h-10"
          onClick={() => setFollowUpDueOnly((v) => !v)}
        >
          <CalendarClock className="w-4 h-4 mr-2" />
          Follow-ups due
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : safeLeads.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No leads found{isExecutive ? " assigned to you" : ""}.</p>
          <p className="text-xs mt-2">Use <strong>Add Lead</strong> to register a walk-in or referral customer.</p>
          {canCreate ? (
            <Button size="sm" className="mt-4 bg-primary text-primary-foreground" onClick={() => setShowAddLead(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Lead
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {safeLeads.map((lead) => (
            <Card
              key={lead._id}
              className="p-4 border-border/50 bg-card/50 cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => void openLead(lead)}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{lead.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 shrink-0" /> {lead.mobile}
                  </p>
                </div>
                <Badge variant="outline" className={cn("text-[10px] shrink-0", stageBadgeClass(lead.status))}>
                  {normalizeCrmStage(lead.status)}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{lead.model} · {lead.source ?? "Website"}</p>
                <p className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 shrink-0" />
                  {lead.assignedTo?.name ?? "Unassigned"}
                </p>
                {lead.nextFollowUp ? (
                  <p className={cn(new Date(lead.nextFollowUp) <= new Date() && "text-amber-600 dark:text-amber-400")}>
                    <Clock className="w-3 h-3 inline mr-1" />
                    Follow-up: {formatDateTime(lead.nextFollowUp)}
                  </p>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{selected?.name ?? "Lead"}</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : selected && detail?.lead ? (
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className={stageBadgeClass(detail.lead.status)}>
                  {normalizeCrmStage(detail.lead.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">{detail.lead.model}</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 rounded-lg border border-border/50 bg-secondary/20 p-4 text-xs">
                <p><span className="text-muted-foreground">Mobile</span><br />{detail.lead.mobile}</p>
                <p><span className="text-muted-foreground">Email</span><br />{detail.lead.email || "—"}</p>
                <p><span className="text-muted-foreground">City</span><br />{detail.lead.city || "—"}</p>
                <p><span className="text-muted-foreground">Source</span><br />{detail.lead.source || "—"}</p>
                <p><span className="text-muted-foreground">Assigned to</span><br />{detail.lead.assignedTo?.name || "—"}</p>
                <p><span className="text-muted-foreground">Next follow-up</span><br />{formatDateTime(detail.lead.nextFollowUp)}</p>
              </div>

              {canAssignLeads ? (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary" /> Assign staff (User Master)
                  </p>
                  {staffUsers.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      No active staff found. Add users under Test Drive → User Master first.
                    </p>
                  ) : null}
                  <Select
                    value={assignExecutiveId || "none"}
                    onValueChange={(v) => setAssignExecutiveId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Choose staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Unassigned —</SelectItem>
                      {staffUsers.map((e) => (
                        <SelectItem key={e._id} value={e._id}>
                          {e.name}
                          {e.designationLabel ? ` · ${e.designationLabel}` : ""}
                          {e.email ? ` (${e.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={saving || staffUsers.length === 0}
                    onClick={() => void handleAssignExecutive()}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                    Save assignment
                  </Button>
                </div>
              ) : null}

              <Tabs defaultValue="stage">
                <TabsList className="bg-secondary/50 w-full flex flex-wrap h-auto">
                  <TabsTrigger value="stage" className="text-xs">Stage</TabsTrigger>
                  <TabsTrigger value="remarks" className="text-xs">Remarks</TabsTrigger>
                  <TabsTrigger value="followups" className="text-xs">Follow-ups ({detailFollowUps.length})</TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
                </TabsList>

                <TabsContent value="stage" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Update stage</Label>
                    <Select value={stageDraft} onValueChange={setStageDraft}>
                      <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CRM_LEAD_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Reason (optional)</Label>
                    <Input
                      value={stageReason}
                      onChange={(e) => setStageReason(e.target.value)}
                      placeholder="Why is the stage changing?"
                      className="bg-secondary/50"
                    />
                  </div>
                  <Button onClick={() => void handleStageUpdate()} disabled={saving || !canUpdate} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Update stage
                  </Button>
                </TabsContent>

                <TabsContent value="remarks" className="mt-4 space-y-3">
                  <Label className="text-xs">Remarks</Label>
                  <Textarea
                    value={remarksDraft}
                    onChange={(e) => setRemarksDraft(e.target.value)}
                    rows={5}
                    className="bg-secondary/50"
                    placeholder="Customer preferences, objections, next steps…"
                  />
                  <Button onClick={() => void handleRemarksSave()} disabled={saving || !canUpdate} variant="outline" className="w-full">
                    Save remarks
                  </Button>
                </TabsContent>

                <TabsContent value="followups" className="mt-4 space-y-4">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> Log follow-up
                    </p>
                    <Textarea
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      rows={3}
                      placeholder="What was discussed? Next action?"
                      className="bg-background/80"
                    />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Schedule next call (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={followUpScheduled}
                          onChange={(e) => setFollowUpScheduled(e.target.value)}
                          className="bg-background/80"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Outcome (optional)</Label>
                        <Input
                          value={followUpOutcome}
                          onChange={(e) => setFollowUpOutcome(e.target.value)}
                          placeholder="e.g. Will visit showroom"
                          className="bg-background/80"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={followUpCompleted}
                        onChange={(e) => setFollowUpCompleted(e.target.checked)}
                        className="rounded border-border"
                      />
                      Mark as completed (call already done)
                    </label>
                    <Button onClick={() => void handleAddFollowUp()} disabled={saving || !canUpdate} size="sm" className="w-full">
                      Add follow-up
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {detailFollowUps.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No follow-ups yet.</p>
                    ) : (
                      detailFollowUps.map((fu) => (
                        <div key={fu._id} className="rounded-lg border border-border/50 p-3 text-xs space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <Badge variant="outline" className={fu.status === "pending" ? "text-amber-600" : "text-emerald-600"}>
                              {fu.status}
                            </Badge>
                            <span className="text-muted-foreground">{formatDateTime(fu.createdAt)}</span>
                          </div>
                          <p className="text-foreground leading-relaxed">{fu.note}</p>
                          {fu.scheduledAt ? (
                            <p className="text-muted-foreground">Scheduled: {formatDateTime(fu.scheduledAt)}</p>
                          ) : null}
                          {fu.outcome ? <p className="text-muted-foreground">Outcome: {fu.outcome}</p> : null}
                          <p className="text-muted-foreground">By {fu.createdBy?.name ?? "Staff"}</p>
                          {fu.status === "pending" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 h-7 text-[10px]"
                              disabled={saving}
                              onClick={() => void handleCompleteFollowUp(fu._id)}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Mark done
                            </Button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4 space-y-2 max-h-72 overflow-y-auto">
                  {detailHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No stage changes recorded yet.</p>
                  ) : (
                    detailHistory.map((h) => (
                      <div key={h._id} className="flex gap-3 text-xs border-l-2 border-primary/30 pl-3 py-1">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">
                            {h.fromStage ? `${normalizeCrmStage(h.fromStage)} → ` : ""}
                            {normalizeCrmStage(h.toStage)}
                          </p>
                          {h.reason ? <p className="text-muted-foreground mt-0.5">{h.reason}</p> : null}
                          <p className="text-muted-foreground mt-0.5">
                            {h.changedBy?.name ?? "System"} · {formatDateTime(h.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {showAddLead ? (
        <AddCrmLeadDialog
          open={showAddLead}
          onOpenChange={setShowAddLead}
          isExecutive={isExecutive}
          canAssignToExecutive={canAssignLeads}
          executives={staffUsers}
          onCreated={() => void loadLeads()}
        />
      ) : null}
    </div>
  );
}
