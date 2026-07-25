import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminGet, adminPatchJson, formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";

type Slot = { slotDate?: string; slotTime?: string };
type RescheduleRow = {
  _id: string;
  bookingCode?: string;
  status: string;
  originalSlot?: Slot;
  preferredSlots?: Slot[];
  approvedSlot?: Slot;
  reason?: string | null;
  requestedByName?: string | null;
  approvedByName?: string | null;
  decidedAt?: string | null;
  createdAt?: string;
};

function slotLabel(s?: Slot) {
  if (!s?.slotDate) return "—";
  const d = new Date(s.slotDate).toLocaleDateString("en-IN");
  return `${d} ${s.slotTime || ""}`.trim();
}

export default function AdminRescheduleHistory() {
  const adminUser = getAdminUser();
  const canApprove = canPerformAction(adminUser, "td_reschedule_history", "approve");
  const [rows, setRows] = useState<RescheduleRow[]>([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [decideTarget, setDecideTarget] = useState<RescheduleRow | null>(null);
  const [preferredIndex, setPreferredIndex] = useState("0");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = status === "all" ? "" : `?status=${status}`;
      const res = await adminGet<RescheduleRow[]>(`/admin/td/bookings/reschedule/history${q}`);
      setRows(res.data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    if (!decideTarget) return;
    setSaving(true);
    try {
      await adminPatchJson(`/admin/td/bookings/reschedule/${decideTarget._id}/decide`, {
        decision,
        preferredIndex: decision === "APPROVED" ? Number(preferredIndex) : undefined,
      });
      toast.success(decision === "APPROVED" ? "Reschedule approved" : "Reschedule rejected");
      setDecideTarget(null);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Reschedule History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Original, requested, and approved slots with requester and approver audit trail.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No reschedule records found.</Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r._id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.bookingCode || "—"}</span>
                <Badge variant="outline">{r.status}</Badge>
                {r.status === "PENDING" && canApprove ? (
                  <Button size="sm" variant="outline" onClick={() => { setDecideTarget(r); setPreferredIndex("0"); }}>
                    Review
                  </Button>
                ) : null}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                <p><span className="text-muted-foreground">Original:</span> {slotLabel(r.originalSlot)}</p>
                <p><span className="text-muted-foreground">Approved:</span> {slotLabel(r.approvedSlot)}</p>
                <p><span className="text-muted-foreground">Requested by:</span> {r.requestedByName || "—"}</p>
                <p><span className="text-muted-foreground">Approved by:</span> {r.approvedByName || "—"}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground">Reason:</span> {r.reason || "—"}</p>
              </div>
              {r.preferredSlots?.length ? (
                <div className="text-xs text-muted-foreground">
                  Preferred options:{" "}
                  {r.preferredSlots.map((s, i) => ` (${i + 1}) ${slotLabel(s)}`).join(" · ")}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(decideTarget)} onOpenChange={(o) => !o && setDecideTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve reschedule · {decideTarget?.bookingCode}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Choose preferred option to approve</Label>
            <Select value={preferredIndex} onValueChange={setPreferredIndex}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(decideTarget?.preferredSlots || []).map((s, i) => (
                  <SelectItem key={i} value={String(i)}>
                    Option {i + 1}: {slotLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="destructive" disabled={saving} onClick={() => void decide("REJECTED")}>
              Reject
            </Button>
            <Button disabled={saving} onClick={() => void decide("APPROVED")}>
              Approve selected slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
