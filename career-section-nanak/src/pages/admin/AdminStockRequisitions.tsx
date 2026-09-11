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
  submitRequisition,
  type StockRequisition,
} from "@/lib/stockPipelineApi";

const PRIORITIES = ["NORMAL", "URGENT"] as const;

const emptyForm = () => ({
  model: "",
  variant: "",
  colour: "",
  qty: "1",
  priority: "NORMAL",
  neededBy: "",
  remarks: "",
});

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
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    setForm({
      ...emptyForm(),
      model,
      variant,
      colour: exteriorColoursFor(model, variant)[0] ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.model.trim()) {
      toast.error("Model is required");
      return;
    }
    const qty = Math.max(1, Number(form.qty) || 1);
    setSaving(true);
    try {
      await createRequisition({
        model: form.model,
        variant: form.variant || undefined,
        colour: form.colour || undefined,
        qty,
        priority: form.priority,
        neededBy: form.neededBy || undefined,
        remarks: form.remarks.trim() || undefined,
      });
      toast.success("Requisition created");
      setOpen(false);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: "submit" | "approve") => {
    setBusyId(id);
    try {
      if (action === "submit") {
        await submitRequisition(id);
        toast.success("Requisition submitted");
      } else {
        await approveRequisition(id);
        toast.success("Requisition approved");
      }
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Requisition Planning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan model / colour demand before raising purchase orders
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

      {loading ? (
        <Loader2 className="animate-spin mx-auto" />
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No requisitions yet</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const requester =
              typeof r.requestedBy === "object" && r.requestedBy ? r.requestedBy.name : "—";
            return (
              <Card key={r._id} className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium font-mono">{r.requisitionNo}</p>
                    <Badge variant="secondary">{r.status}</Badge>
                    <Badge variant="outline">{r.priority}</Badge>
                  </div>
                  <p className="text-sm">
                    {r.model}
                    {r.variant ? ` · ${r.variant}` : ""}
                    {r.colour ? ` · ${r.colour}` : ""} · Qty {r.qty}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {requester}
                    {r.neededBy ? ` · Needed by ${new Date(r.neededBy).toLocaleDateString("en-IN")}` : ""}
                    {r.remarks ? ` · ${r.remarks}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canUpdate && r.status === "DRAFT" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === r._id}
                      onClick={() => void runAction(r._id, "submit")}
                    >
                      {busyId === r._id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Submit
                    </Button>
                  ) : null}
                  {canApprove && (r.status === "SUBMITTED" || r.status === "DRAFT") ? (
                    <Button
                      size="sm"
                      disabled={busyId === r._id}
                      onClick={() => void runAction(r._id, "approve")}
                    >
                      Approve
                    </Button>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New stock requisition</DialogTitle>
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
                <SelectTrigger><SelectValue placeholder="Select variant" /></SelectTrigger>
                <SelectContent>
                  {trimsFor(form.model).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <Select
                value={form.colour || undefined}
                onValueChange={(colour) => setForm((f) => ({ ...f, colour }))}
              >
                <SelectTrigger><SelectValue placeholder="Select colour" /></SelectTrigger>
                <SelectContent>
                  {colourOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.qty}
                  onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))}
                />
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
              <Label>Needed by</Label>
              <Input
                type="date"
                value={form.neededBy}
                onChange={(e) => setForm((f) => ({ ...f, neededBy: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
