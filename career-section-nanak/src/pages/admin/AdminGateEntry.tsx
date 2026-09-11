import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import PipelineDeleteButton from "@/components/admin/PipelineDeleteButton";
import StockPrintButton from "@/components/admin/StockPrintButton";
import { vendorDisplayName, vendorFromPo } from "@/lib/stockVendorsApi";
import {
  deleteGateEntry,
  fetchDispatches,
  fetchGateEntries,
  updateGateEntry,
  type PurchaseOrder,
} from "@/lib/stockPipelineApi";

function toDatetimeLocal(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminGateEntry() {
  const admin = getAdminUser();
  const canDelete =
    canPerformAction(admin, "stock_gate", "delete") ||
    canPerformAction(admin, "stock_delivery", "delete");
  const canUpdate =
    canPerformAction(admin, "stock_gate", "update") ||
    canPerformAction(admin, "stock_delivery", "update") ||
    admin?.userType === "admin" ||
    admin?.role === "superadmin";

  const [entries, setEntries] = useState<Array<Record<string, unknown>>>([]);
  const [dispatches, setDispatches] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState({
    truckNumber: "",
    sealNumber: "",
    remarks: "",
    arrivalDatetime: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, d] = await Promise.all([fetchGateEntries(), fetchDispatches()]);
      setEntries(e as Array<Record<string, unknown>>);
      setDispatches(d.filter((x) => x.status === "IN_TRANSIT" || x.status === "ARRIVED") as unknown as Array<Record<string, unknown>>);
    } catch (err) {
      toast.error(formatApiErrors(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (e: Record<string, unknown>) => {
    setEditRow(e);
    setEditForm({
      truckNumber: String(e.truckNumber ?? ""),
      sealNumber: String(e.sealNumber ?? ""),
      remarks: String(e.remarks ?? ""),
      arrivalDatetime: toDatetimeLocal(e.arrivalDatetime),
    });
  };

  const saveEdit = async () => {
    if (!editRow?._id) return;
    setSaving(true);
    try {
      await updateGateEntry(String(editRow._id), {
        truckNumber: editForm.truckNumber.trim() || undefined,
        sealNumber: editForm.sealNumber.trim() || undefined,
        remarks: editForm.remarks.trim() || undefined,
        arrivalDatetime: editForm.arrivalDatetime ? new Date(editForm.arrivalDatetime).toISOString() : undefined,
      });
      toast.success("Gate entry updated");
      setEditRow(null);
      void load();
    } catch (err) {
      toast.error(formatApiErrors(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><DoorOpen className="h-6 w-6" /> Gate Entry</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <p className="text-sm text-muted-foreground">Record truck arrival with seal check and mandatory arrival photo via API (multipart).</p>
      {loading ? <Loader2 className="animate-spin mx-auto" /> : (
        <>
          <Card className="p-4">
            <p className="font-medium mb-2">Pending dispatches ({dispatches.length})</p>
            {dispatches.map((d) => (
              <p key={String(d._id)} className="text-sm">{String(d.dispatchNumber)} — {String(d.truckNumber)}</p>
            ))}
          </Card>
          <div className="space-y-2">
            <p className="font-medium">Recent gate entries</p>
            {entries.map((e) => {
              const dispatch = e.dispatchId as { dispatchNumber?: string; truckNumber?: string; purchaseOrderId?: PurchaseOrder } | undefined;
              const vendor = vendorFromPo(dispatch?.purchaseOrderId);
              return (
              <Card key={String(e._id)} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <div>
                    <p className="font-medium">{String(e.gateEntryNo)}</p>
                    <p className="text-sm text-muted-foreground">
                      Vendor: {vendorDisplayName(vendor)} · Truck {String(e.truckNumber)} · Dispatch {dispatch?.dispatchNumber || "—"}
                    </p>
                    <Badge variant="secondary" className="mt-1">{String(e.status ?? "ARRIVED")}</Badge>
                  </div>
                  <StockPrintButton
                    getPrintOptions={() => ({
                      title: "Gate Entry",
                      documentNo: String(e.gateEntryNo),
                      vendor,
                      meta: [
                        { label: "Truck", value: String(e.truckNumber) },
                        { label: "Dispatch", value: dispatch?.dispatchNumber || "—" },
                        { label: "Arrival", value: e.arrivalDatetime ? new Date(String(e.arrivalDatetime)).toLocaleString() : "—" },
                      ],
                      bodyHtml: `<p>Gate entry recorded for vendor ${vendorDisplayName(vendor)} shipment.</p>`,
                    })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {canUpdate ? (
                    <Button size="sm" variant="outline" onClick={() => openEdit(e)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <PipelineDeleteButton
                      label="Delete"
                      title={`Delete ${String(e.gateEntryNo)}?`}
                      description="Reverts dispatch and VINs to IN_TRANSIT. Blocked if GRN exists."
                      onConfirm={async () => {
                        try {
                          await deleteGateEntry(String(e._id));
                          toast.success("Gate entry deleted");
                          void load();
                        } catch (err) {
                          toast.error(formatApiErrors(err));
                          throw err;
                        }
                      }}
                    />
                  ) : null}
                </div>
              </Card>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={Boolean(editRow)} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit gate entry — {String(editRow?.gateEntryNo ?? "")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Truck number</Label>
              <Input value={editForm.truckNumber} onChange={(e) => setEditForm((f) => ({ ...f, truckNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Seal number</Label>
              <Input value={editForm.sealNumber} onChange={(e) => setEditForm((f) => ({ ...f, sealNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Arrival datetime</Label>
              <Input
                type="datetime-local"
                value={editForm.arrivalDatetime}
                onChange={(e) => setEditForm((f) => ({ ...f, arrivalDatetime: e.target.value }))}
              />
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
