import { useCallback, useEffect, useState } from "react";
import { PackageCheck, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatApiErrors } from "@/lib/api";
import { deliverOrder, fetchDeliveries, retailSale, type VehicleOrder } from "@/lib/stockDeliveryApi";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";

export default function AdminStockDeliveries() {
  const admin = getAdminUser();
  const canDeliver = canPerformAction(admin, "stock_delivery", "deliver");
  const [rows, setRows] = useState<VehicleOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchDeliveries(100));
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-primary" />
            Deliveries
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Retail sale and handover list with post-delivery feedback links.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No retail/delivered orders yet.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((o) => (
            <Card key={o._id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-semibold">{o.orderNumber}</p>
                  <p className="text-sm">
                    {o.customerName} · {o.preferredModel}
                    {o.vinNo ? ` · ${o.vinNo}` : ""}
                  </p>
                </div>
                <Badge>{o.stage}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {canDeliver && o.stage !== "DELIVERED" && o.stage === "RETAIL" ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      void (async () => {
                        try {
                          await deliverOrder(o._id);
                          toast.success("Delivered");
                          void load();
                        } catch (e) {
                          toast.error(formatApiErrors(e));
                        }
                      })()
                    }
                  >
                    Complete handover
                  </Button>
                ) : null}
                {canDeliver && o.finalPdiPassed && o.stage !== "RETAIL" && o.stage !== "DELIVERED" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void (async () => {
                        try {
                          await retailSale(o._id);
                          toast.success("Retail sale");
                          void load();
                        } catch (e) {
                          toast.error(formatApiErrors(e));
                        }
                      })()
                    }
                  >
                    Retail sale
                  </Button>
                ) : null}
                {o.feedbackUrl ? (
                  <Button size="sm" variant="ghost" asChild>
                    <a href={o.feedbackUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" /> Feedback
                    </a>
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
