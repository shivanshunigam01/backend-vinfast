import { useCallback, useEffect, useState } from "react";
import {
  MessageSquareWarning, PhoneIncoming, PhoneOutgoing, Plus, RefreshCw, Loader2, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import {
  addComplaintCommunication,
  createComplaint,
  deleteComplaint,
  fetchComplaints,
  updateComplaint,
  type ComplaintDirection,
  type ComplaintPriority,
  type ComplaintStatus,
  type CustomerComplaint,
} from "@/lib/complaintsApi";

const STATUSES: ComplaintStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES: ComplaintPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const CHANNELS = ["Phone", "WhatsApp", "Email", "Walk-in", "Social Media", "Referral", "Other"];

type Props = {
  direction: ComplaintDirection;
};

const emptyForm = () => ({
  customerName: "",
  mobile: "",
  email: "",
  subject: "",
  description: "",
  category: "",
  channel: "Phone",
  priority: "MEDIUM" as ComplaintPriority,
  model: "",
});

function statusBadge(status: string) {
  if (status === "OPEN") return "bg-amber-500/15 text-amber-700 border-amber-500/30";
  if (status === "IN_PROGRESS") return "bg-blue-500/15 text-blue-700 border-blue-500/30";
  if (status === "RESOLVED") return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export default function AdminComplaints({ direction }: Props) {
  const admin = getAdminUser();
  const moduleKey = direction === "INBOUND" ? "complaint_inbound" : "complaint_outbound";
  const canCreate = canPerformAction(admin, moduleKey, "create") || canPerformAction(admin, "crm_leads", "create");
  const canUpdate = canPerformAction(admin, moduleKey, "update") || canPerformAction(admin, "crm_leads", "update");
  const canDelete = canPerformAction(admin, moduleKey, "delete") || canPerformAction(admin, "crm_leads", "delete");

  const [rows, setRows] = useState<CustomerComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<CustomerComplaint | null>(null);
  const [commNote, setCommNote] = useState("");
  const [commBusy, setCommBusy] = useState(false);

  const title = direction === "INBOUND" ? "Complaint Inbound" : "Complaint Outbound";
  const Icon = direction === "INBOUND" ? PhoneIncoming : PhoneOutgoing;
  const blurb =
    direction === "INBOUND"
      ? "Track complaints raised by customers and their resolution status."
      : "Log outbound complaint follow-ups and proactive customer calls.";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items } = await fetchComplaints({
        direction,
        status: statusFilter,
        search: search.trim() || undefined,
        limit: 100,
      });
      setRows(items);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [direction, statusFilter, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!form.customerName.trim() || form.customerName.trim().length < 2) {
      toast.error("Enter customer name");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      toast.error("Enter a valid 10-digit mobile");
      return;
    }
    if (!form.subject.trim()) {
      toast.error("Enter subject");
      return;
    }
    setSaving(true);
    try {
      await createComplaint({
        direction,
        customerName: form.customerName.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim() || undefined,
        subject: form.subject.trim(),
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        channel: form.channel,
        priority: form.priority,
        model: form.model.trim() || undefined,
      });
      toast.success("Complaint logged");
      setOpen(false);
      setForm(emptyForm());
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const onStatusChange = async (row: CustomerComplaint, status: ComplaintStatus) => {
    if (!canUpdate) return;
    try {
      const updated = await updateComplaint(row._id, { status });
      setRows((prev) => prev.map((r) => (r._id === row._id ? updated : r)));
      if (detail?._id === row._id) setDetail(updated);
      toast.success(`Marked ${status.replace("_", " ").toLowerCase()}`);
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const onAddComm = async () => {
    if (!detail || !commNote.trim()) {
      toast.error("Enter a communication note");
      return;
    }
    setCommBusy(true);
    try {
      const updated = await addComplaintCommunication(detail._id, {
        note: commNote.trim(),
        direction,
      });
      setDetail(updated);
      setRows((prev) => prev.map((r) => (r._id === detail._id ? updated : r)));
      setCommNote("");
      toast.success("Communication added");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setCommBusy(false);
    }
  };

  const onDelete = async (row: CustomerComplaint) => {
    if (!canDelete) return;
    if (!window.confirm(`Delete complaint ${row.complaintNo}?`)) return;
    try {
      await deleteComplaint(row._id);
      toast.success("Complaint deleted");
      if (detail?._id === row._id) setDetail(null);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Icon className="h-6 w-6 text-primary" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{blurb}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {canCreate ? (
            <Button size="sm" onClick={() => { setForm(emptyForm()); setOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> New complaint
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search name, mobile, subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <MessageSquareWarning className="h-8 w-8 mx-auto mb-2 opacity-60" />
          No {direction.toLowerCase()} complaints yet
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <button type="button" className="text-left space-y-1 min-w-0 flex-1" onClick={() => setDetail(row)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{row.complaintNo}</span>
                  <Badge variant="outline" className={statusBadge(row.status)}>
                    {row.status.replace("_", " ")}
                  </Badge>
                  <Badge variant="secondary">{row.priority}</Badge>
                </div>
                <p className="font-medium truncate">{row.customerName} · {row.mobile}</p>
                <p className="text-sm text-muted-foreground truncate">{row.subject}</p>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {canUpdate ? (
                  <Select
                    value={row.status}
                    onValueChange={(v) => void onStatusChange(row, v as ComplaintStatus)}
                  >
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {canDelete ? (
                  <Button variant="ghost" size="icon" onClick={() => void onDelete(row)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New {direction === "INBOUND" ? "inbound" : "outbound"} complaint</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Customer name *</Label>
              <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mobile *</Label>
                <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as ComplaintPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="VF 7" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Service / Delivery / Product…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void onCreate()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.complaintNo} — {detail?.subject}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p><span className="text-muted-foreground">Customer</span><br />{detail.customerName}</p>
                <p><span className="text-muted-foreground">Mobile</span><br />{detail.mobile}</p>
                <p><span className="text-muted-foreground">Status</span><br />{detail.status.replace("_", " ")}</p>
                <p><span className="text-muted-foreground">Priority</span><br />{detail.priority}</p>
              </div>
              {detail.description ? (
                <p className="text-muted-foreground whitespace-pre-wrap">{detail.description}</p>
              ) : null}
              <div>
                <p className="font-medium mb-2">Communications</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {(detail.communications || []).length === 0 ? (
                    <p className="text-muted-foreground text-xs">No updates yet</p>
                  ) : (
                    (detail.communications || []).map((c, idx) => (
                      <div key={c._id || idx} className="rounded-md border border-border/60 p-2">
                        <p className="text-xs text-muted-foreground">
                          {c.direction} · {c.byName || "Staff"} ·{" "}
                          {c.at ? new Date(c.at).toLocaleString("en-IN") : ""}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{c.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {canUpdate ? (
                <div className="space-y-2">
                  <Label>Add communication / status note</Label>
                  <Textarea rows={2} value={commNote} onChange={(e) => setCommNote(e.target.value)} />
                  <Button size="sm" onClick={() => void onAddComm()} disabled={commBusy}>
                    {commBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Log update
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
