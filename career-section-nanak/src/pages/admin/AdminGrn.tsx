import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import PipelineDeleteButton from "@/components/admin/PipelineDeleteButton";
import StockPrintButton from "@/components/admin/StockPrintButton";
import { vendorDisplayName, vendorFromPo } from "@/lib/stockVendorsApi";
import {
  createGrnRecord,
  deleteGrn,
  fetchDispatches,
  fetchGateEntries,
  fetchGrns,
  updateGrn,
  type DispatchRecord,
  type PurchaseOrder,
} from "@/lib/stockPipelineApi";

const GRN_STATUSES = ["RECEIVED", "EXCEPTION", "CLOSED"] as const;

export default function AdminGrn() {
  const admin = getAdminUser();
  const canDelete =
    canPerformAction(admin, "stock_grn", "delete") ||
    canPerformAction(admin, "stock_delivery", "delete");
  const canCreate =
    canPerformAction(admin, "stock_grn", "create") ||
    canPerformAction(admin, "stock_delivery", "receive");
  const canUpdate =
    canPerformAction(admin, "stock_grn", "update") ||
    canPerformAction(admin, "stock_delivery", "update") ||
    admin?.userType === "admin" ||
    admin?.role === "superadmin";

  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [gateEntries, setGateEntries] = useState<Array<Record<string, unknown>>>([]);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState({ remarks: "", invoiceNumber: "", status: "RECEIVED" });
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    gateEntryId: "",
    invoiceNumber: "",
    grnDatetime: "",
    vins: [] as Array<{ vin: string; odometerKm: string; selected: boolean }>,
  });

  const grnGateIds = new Set(rows.map((r) => String(r.gateEntryId ?? "")));
  const pendingGates = gateEntries.filter(
    (g) => !grnGateIds.has(String(g._id)) && String(g.status ?? "ARRIVED") !== "GRN_IN_PROGRESS",
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [grns, gates, disp] = await Promise.all([
        fetchGrns(),
        fetchGateEntries(),
        fetchDispatches(200),
      ]);
      setRows(grns as Array<Record<string, unknown>>);
      setGateEntries(gates as Array<Record<string, unknown>>);
      setDispatches(disp);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (r: Record<string, unknown>) => {
    setEditRow(r);
    setEditForm({
      remarks: String(r.remarks ?? ""),
      invoiceNumber: String(r.invoiceNumber ?? ""),
      status: String(r.status ?? "RECEIVED"),
    });
  };

  const openCreate = () => {
    const gate = pendingGates[0];
    const dispatchId =
      typeof gate?.dispatchId === "object" && gate.dispatchId
        ? String((gate.dispatchId as { _id?: string })._id ?? "")
        : String(gate?.dispatchId ?? "");
    const dispatch = dispatches.find((d) => d._id === dispatchId);
    setCreateForm({
      gateEntryId: gate?._id ? String(gate._id) : "",
      invoiceNumber: dispatch?.oemInvoiceNumber ?? "",
      grnDatetime: new Date().toISOString().slice(0, 16),
      vins: (dispatch?.items ?? []).map((item) => ({
        vin: item.vin,
        odometerKm: "",
        selected: true,
      })),
    });
    setCreateOpen(true);
  };

  const onGateChange = (gateEntryId: string) => {
    const gate = gateEntries.find((g) => String(g._id) === gateEntryId);
    const dispatchId =
      typeof gate?.dispatchId === "object" && gate.dispatchId
        ? String((gate.dispatchId as { _id?: string })._id ?? "")
        : String(gate?.dispatchId ?? "");
    const dispatch = dispatches.find((d) => d._id === dispatchId);
    setCreateForm({
      gateEntryId,
      invoiceNumber: dispatch?.oemInvoiceNumber ?? "",
      grnDatetime: new Date().toISOString().slice(0, 16),
      vins: (dispatch?.items ?? []).map((item) => ({
        vin: item.vin,
        odometerKm: "",
        selected: true,
      })),
    });
  };

  const saveCreate = async () => {
    const items = createForm.vins
      .filter((v) => v.selected)
      .map((v) => ({
        vin: v.vin,
        odometerKm: v.odometerKm ? Number(v.odometerKm) : undefined,
      }));
    if (!createForm.gateEntryId) return toast.error("Select a gate entry");
    if (!items.length) return toast.error("Select at least one VIN");
    setSaving(true);
    try {
      await createGrnRecord({
        gateEntryId: createForm.gateEntryId,
        invoiceNumber: createForm.invoiceNumber.trim() || undefined,
        grnDatetime: createForm.grnDatetime ? new Date(createForm.grnDatetime).toISOString() : undefined,
        items,
      });
      toast.success("GRN recorded — PO received quantities updated");
      setCreateOpen(false);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editRow?._id) return;
    setSaving(true);
    try {
      await updateGrn(String(editRow._id), {
        remarks: editForm.remarks.trim() || undefined,
        invoiceNumber: editForm.invoiceNumber.trim() || undefined,
        status: editForm.status,
      });
      toast.success("GRN updated");
      setEditRow(null);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap justify-between gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck className="h-6 w-6" /> GRN</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          {canCreate ? (
            <Button size="sm" onClick={openCreate} disabled={!pendingGates.length}>
              <Plus className="h-4 w-4 mr-1" /> Record GRN
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">VIN-wise receipt with configuration match, odometer, photos and exception handling.</p>
      {loading ? <Loader2 className="animate-spin mx-auto" /> : rows.map((r) => {
        const po = r.purchaseOrderId as PurchaseOrder | undefined;
        const vendor = vendorFromPo(po);
        return (
        <Card key={String(r._id)} className="p-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2 flex-1">
            <div>
              <p className="font-medium">{String(r.grnNumber)}</p>
              <p className="text-sm text-muted-foreground">
                Vendor: {vendorDisplayName(vendor.name)} · PO {String(r.poNumber)} · Qty {String(r.receivedQty)}/{String(r.expectedQty)} · {String(r.status)}
              </p>
            </div>
            <StockPrintButton
              getPrintOptions={() => ({
                title: "Goods Receipt Note (GRN)",
                documentNo: String(r.grnNumber),
                vendor,
                meta: [
                  { label: "PO", value: String(r.poNumber) },
                  { label: "Status", value: String(r.status) },
                  { label: "Received Qty", value: `${String(r.receivedQty)}/${String(r.expectedQty)}` },
                  { label: "Invoice", value: String(r.invoiceNumber || "—") },
                ],
                bodyHtml: `<p>GRN recorded for vendor ${vendorDisplayName(vendor.name)} against PO ${String(r.poNumber)}.</p>`,
              })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {canUpdate ? (
              <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
            ) : null}
            {canDelete ? (
              <PipelineDeleteButton
                label="Delete"
                title={`Delete ${String(r.grnNumber)}?`}
                description="Reverts VINs to ARRIVED. Blocked if receipt verification exists."
                onConfirm={async () => {
                  try {
                    await deleteGrn(String(r._id));
                    toast.success("GRN deleted");
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record GRN</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Gate entry *</Label>
              <Select value={createForm.gateEntryId || undefined} onValueChange={onGateChange}>
                <SelectTrigger><SelectValue placeholder="Select gate entry" /></SelectTrigger>
                <SelectContent>
                  {pendingGates.map((g) => (
                    <SelectItem key={String(g._id)} value={String(g._id)}>
                      {String(g.gateEntryNo)} — truck {String(g.truckNumber ?? "—")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Invoice number</Label>
                <Input value={createForm.invoiceNumber} onChange={(e) => setCreateForm((f) => ({ ...f, invoiceNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>GRN datetime</Label>
                <Input type="datetime-local" value={createForm.grnDatetime} onChange={(e) => setCreateForm((f) => ({ ...f, grnDatetime: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Chassis / VIN receipt</Label>
              {createForm.vins.map((v, i) => (
                <div key={v.vin} className="flex items-center gap-2 text-sm border rounded-md p-2">
                  <input
                    type="checkbox"
                    checked={v.selected}
                    onChange={(e) => {
                      setCreateForm((f) => ({
                        ...f,
                        vins: f.vins.map((row, idx) => idx === i ? { ...row, selected: e.target.checked } : row),
                      }));
                    }}
                  />
                  <span className="font-mono flex-1">{v.vin}</span>
                  <Input
                    className="w-24 h-8"
                    type="number"
                    placeholder="Odo km"
                    value={v.odometerKm}
                    onChange={(e) => {
                      setCreateForm((f) => ({
                        ...f,
                        vins: f.vins.map((row, idx) => idx === i ? { ...row, odometerKm: e.target.value } : row),
                      }));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveCreate()} disabled={saving}>{saving ? "Saving…" : "Record GRN"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editRow)} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit GRN — {String(editRow?.grnNumber ?? "")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Invoice number</Label>
              <Input value={editForm.invoiceNumber} onChange={(e) => setEditForm((f) => ({ ...f, invoiceNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(status) => setEditForm((f) => ({ ...f, status }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRN_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Remarks</Label>
              <Textarea value={editForm.remarks} onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
