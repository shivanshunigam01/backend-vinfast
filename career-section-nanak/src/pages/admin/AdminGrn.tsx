import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import PipelineDeleteButton from "@/components/admin/PipelineDeleteButton";
import StockPrintButton from "@/components/admin/StockPrintButton";
import { dataTable } from "@/lib/stockPrint";
import { vendorDisplayName, vendorFromPo } from "@/lib/stockVendorsApi";
import { deleteGrn, fetchGrns, type PurchaseOrder } from "@/lib/stockPipelineApi";

export default function AdminGrn() {
  const admin = getAdminUser();
  const canDelete =
    canPerformAction(admin, "stock_grn", "delete") ||
    canPerformAction(admin, "stock_delivery", "delete");

  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await fetchGrns()) as Array<Record<string, unknown>>);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck className="h-6 w-6" /> GRN</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
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
        </Card>
        );
      })}
    </div>
  );
}
