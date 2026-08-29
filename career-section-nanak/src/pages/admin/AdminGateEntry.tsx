import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import PipelineDeleteButton from "@/components/admin/PipelineDeleteButton";
import StockPrintButton from "@/components/admin/StockPrintButton";
import { vendorDisplayName, vendorFromPo } from "@/lib/stockVendorsApi";
import { deleteGateEntry, fetchDispatches, fetchGateEntries, type PurchaseOrder } from "@/lib/stockPipelineApi";

export default function AdminGateEntry() {
  const admin = getAdminUser();
  const canDelete =
    canPerformAction(admin, "stock_gate", "delete") ||
    canPerformAction(admin, "stock_delivery", "delete");

  const [entries, setEntries] = useState<Array<Record<string, unknown>>>([]);
  const [dispatches, setDispatches] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

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
              </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
