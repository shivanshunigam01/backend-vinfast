import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Plus, RefreshCw } from "lucide-react";
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
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { exteriorColoursFor } from "@/data/stockColourOptions";
import PipelineDeleteButton from "@/components/admin/PipelineDeleteButton";
import {
  approveRequisition,
  createRequisition,
  deleteRequisition,
  fetchRequisitions,
  recommendRequisition,
  rejectRequisition,
  returnRequisition,
  submitRequisition,
  updateRequisition,
  type StockRequisition,
} from "@/lib/stockPipelineApi";

const PRIORITIES = ["NORMAL", "URGENT"] as const;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Pending recommendation",
  PENDING_MD: "Pending MD approval",
  APPROVED: "Approved",
  PART_ORDERED: "Partly ordered",
  ORDERED: "Ordered",
  RETURNED: "Returned",
  REJECTED: "Rejected",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const emptyForm = () => ({
  model: "",
  variant: "",
  colour: "",
  qty: "1",
  priority: "NORMAL",
  neededBy: "",
  receivingLocation: "Main Warehouse",
  purpose: "",
  justification: "",
  indicativeAmount: "",
  planReference: "",
  remarks: "",
});

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "APPROVED" || status === "ORDERED") return "default";
  if (status === "REJECTED") return "destructive";
  if (status === "SUBMITTED" || status === "PENDING_MD") return "default";
  return "secondary";
}

export default function AdminStockRequisitions() {
  const admin = getAdminUser();
  const canCreate = canPerformAction(admin, "stock_requisition", "create") || canPerformAction(admin, "stock_delivery", "create");
  const canUpdate = canPerformAction(admin, "stock_requisition", "update") || canPerformAction(admin, "stock_delivery", "update");
  const canApprove = canPerformAction(admin, "stock_requisition", "approve") || canPerformAction(admin, "stock_delivery", "update");
  const canDelete = canPerformAction(admin, "stock_requisition", "delete") || canPerformAction(admin, "stock_delivery", "delete");

  const { models: catalogModels, trimsFor } = useVehicleCatalog();
  const [rows, setRows] = useState<StockRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockRequisition | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commentOpen, setCommentOpen] = useState<{ id: string; action: "return" | "reject" } | null>(null);
  const [comment, setComment] = useState("");

  const colourOptions = useMemo(
    () => exteriorColoursFor(form.model, form.variant),
    [form.model, form.variant],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchRequisitions({ limit: 100 }));
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    const model = catalogModels[0] ?? "";
    const variant = trimsFor(model)[0] ?? "";
    setEditing(null);
    setForm({
      ...emptyForm(),
      model,
      variant,
      colour: exteriorColoursFor(model, variant)[0] ?? "",
    });
    setOpen(true);
  };

  const openEdit = (r: StockRequisition) => {
    setEditing(r);
    setForm({
      model: r.model,
      variant: r.variant ?? "",
      colour: r.colour ?? "",
      qty: String(r.qty),
      priority: r.priority,
      neededBy: r.neededBy ? r.neededBy.slice(0, 10) : "",
      receivingLocation: r.receivingLocation ?? "Main Warehouse",
      purpose: r.purpose ?? "",
      justification: r.justification ?? "",
      indicativeAmount: r.indicativeAmount != null ? String(r.indicativeAmount) : "",
      planReference: r.planReference ?? "",
      remarks: r.remarks ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.model.trim()) {
      toast.error("Model is required");
      return;
    }
    const qty = Math.max(1, Number(form.qty) || 1);
    const payload = {
      model: form.model,
      variant: form.variant || undefined,
      colour: form.colour || undefined,
      qty,
      priority: form.priority,
      neededBy: form.neededBy || undefined,
      receivingLocation: form.receivingLocation.trim() || undefined,
      purpose: form.purpose.trim() || undefined,
      justification: form.justification.trim() || undefined,
      indicativeAmount: form.indicativeAmount ? Number(form.indicativeAmount) : undefined,
      planReference: form.planReference.trim() || undefined,
      remarks: form.remarks.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateRequisition(editing._id, payload);
        toast.success("Requisition updated");
      } else {
        await createRequisition(payload);
        toast.success("Requisition created");
      }
      setOpen(false);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const runWithComment = async () => {
    if (!commentOpen) return;
    if (!comment.trim()) {
      toast.error("Comment is required");
      return;
    }
    setBusyId(commentOpen.id);
    try {
      if (commentOpen.action === "return") {
        await returnRequisition(commentOpen.id, comment.trim());
        toast.success("Requisition returned to planner");
      } else {
        await rejectRequisition(commentOpen.id, comment.trim());
        toast.success("Requisition rejected");
      }
      setCommentOpen(null);
      setComment("");
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setBusyId(null);
    }
  };

  const runAction = async (id: string, action: "submit" | "recommend" | "approve") => {
    setBusyId(id);
    try {
      if (action === "submit") {
        await submitRequisition(id);
        toast.success("Submitted to Sales Head");
      } else if (action === "recommend") {
        await recommendRequisition(id);
        toast.success("Recommended to MD");
      } else {
        await approveRequisition(id);
        toast.success("Approved — ready for external PO");
      }
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setBusyId(null);
    }
  };

  const pendingRecommend = rows.filter((r) => r.status === "SUBMITTED").length;
  const pendingMd = rows.filter((r) => r.status === "PENDING_MD").length;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Requisition Planning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Draft → Sales Head recommendation → MD approval → external PO entry
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canCreate ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> New requisition
            </Button>
          ) : null}
        </div>
      </div>

      {(pendingRecommend > 0 || pendingMd > 0) && canApprove ? (
        <Card className="p-3 border-amber-500/40 bg-amber-500/5 text-sm">
          {pendingRecommend > 0 ? <span><strong>{pendingRecommend}</strong> awaiting Sales Head recommendation. </span> : null}
          {pendingMd > 0 ? <span><strong>{pendingMd}</strong> awaiting MD approval.</span> : null}
        </Card>
      ) : null}

      {loading ? (
        <Loader2 className="animate-spin mx-auto" />
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No requisitions yet</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const requester =
              typeof r.requestedBy === "object" && r.requestedBy ? r.requestedBy.name : "—";
            const linkedPo =
              typeof r.linkedPoId === "object" && r.linkedPoId ? r.linkedPoId.poNumber : undefined;
            const remaining = r.qty - (r.orderedQty ?? 0);
            return (
              <Card key={r._id} className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium font-mono">{r.requisitionNo}</p>
                    {r.version && r.version > 1 ? (
                      <Badge variant="outline">v{r.version}</Badge>
                    ) : null}
                    <Badge variant={statusBadgeVariant(r.status)}>
                      {STATUS_LABELS[r.status] ?? r.status}
                    </Badge>
                    <Badge variant="outline">{r.priority}</Badge>
                  </div>
                  <p className="text-sm">
                    {r.model}
                    {r.variant ? ` · ${r.variant}` : ""}
                    {r.colour ? ` · ${r.colour}` : ""} · Qty {r.qty}
                    {(r.orderedQty ?? 0) > 0 ? ` (${r.orderedQty} ordered, ${remaining} remaining)` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {requester}
                    {r.receivingLocation ? ` · To ${r.receivingLocation}` : ""}
                    {r.neededBy ? ` · Needed by ${new Date(r.neededBy).toLocaleDateString("en-IN")}` : ""}
                    {linkedPo ? ` · PO ${linkedPo}` : ""}
                  </p>
                  {r.justification ? (
                    <p className="text-xs text-muted-foreground">Justification: {r.justification}</p>
                  ) : null}
                  {r.approvalHistory?.length ? (
                    <ul className="text-xs text-muted-foreground border-t pt-2 mt-2 space-y-0.5">
                      {r.approvalHistory.slice(-4).map((h, i) => (
                        <li key={i}>
                          {h.action} → {h.status}
                          {h.byName ? ` by ${h.byName}` : ""}
                          {h.remarks ? ` — ${h.remarks}` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {canUpdate && ["DRAFT", "RETURNED"].includes(r.status) ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === r._id}
                        onClick={() => void runAction(r._id, "submit")}
                      >
                        Submit
                      </Button>
                    </>
                  ) : null}
                  {canApprove && r.status === "SUBMITTED" ? (
                    <>
                      <Button size="sm" disabled={busyId === r._id} onClick={() => void runAction(r._id, "recommend")}>
                        Recommend
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setCommentOpen({ id: r._id, action: "return" }); setComment(""); }}
                      >
                        Return
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setCommentOpen({ id: r._id, action: "reject" }); setComment(""); }}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {canApprove && r.status === "PENDING_MD" ? (
                    <>
                      <Button size="sm" disabled={busyId === r._id} onClick={() => void runAction(r._id, "approve")}>
                        MD Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setCommentOpen({ id: r._id, action: "return" }); setComment(""); }}
                      >
                        Return
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { setCommentOpen({ id: r._id, action: "reject" }); setComment(""); }}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {canDelete && r.status === "DRAFT" ? (
                    <PipelineDeleteButton
                      label="Delete"
                      title={`Delete ${r.requisitionNo}?`}
                      description="Only draft requisitions can be deleted."
                      onConfirm={async () => {
                        try {
                          await deleteRequisition(r._id);
                          toast.success("Requisition deleted");
                          void load();
                        } catch (e) {
                          toast.error(formatApiErrors(e));
                          throw e;
                        }
                      }}
                    />
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit requisition" : "New stock requisition"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Model *</Label>
              <Select
                value={form.model || undefined}
                onValueChange={(model) => {
                  const variant = trimsFor(model)[0] ?? "";
                  setForm((f) => ({
                    ...f,
                    model,
                    variant,
                    colour: exteriorColoursFor(model, variant)[0] ?? "",
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {catalogModels.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Variant</Label>
                <Select
                  value={form.variant || undefined}
                  onValueChange={(variant) =>
                    setForm((f) => ({
                      ...f,
                      variant,
                      colour: exteriorColoursFor(f.model, variant)[0] ?? "",
                    }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Variant" /></SelectTrigger>
                  <SelectContent>
                    {trimsFor(form.model).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Colour</Label>
                <Select value={form.colour || undefined} onValueChange={(colour) => setForm((f) => ({ ...f, colour }))}>
                  <SelectTrigger><SelectValue placeholder="Colour" /></SelectTrigger>
                  <SelectContent>
                    {colourOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Qty *</Label>
                <Input type="number" min={1} value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(priority) => setForm((f) => ({ ...f, priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Receiving location</Label>
              <Input value={form.receivingLocation} onChange={(e) => setForm((f) => ({ ...f, receivingLocation: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Needed by</Label>
              <Input type="date" value={form.neededBy} onChange={(e) => setForm((f) => ({ ...f, neededBy: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <Input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Justification *</Label>
              <Textarea value={form.justification} onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Indicative amount (₹)</Label>
                <Input type="number" min={0} value={form.indicativeAmount} onChange={(e) => setForm((f) => ({ ...f, indicativeAmount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Plan reference</Label>
                <Input value={form.planReference} onChange={(e) => setForm((f) => ({ ...f, planReference: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(commentOpen)} onOpenChange={(v) => !v && setCommentOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{commentOpen?.action === "return" ? "Return requisition" : "Reject requisition"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Comment *</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Reason for return or rejection" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentOpen(null)}>Cancel</Button>
            <Button onClick={() => void runWithComment()} disabled={busyId != null}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
