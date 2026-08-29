import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import {
  deliverOrder,
  fetchVehicleOrders,
  markDeliveryReady,
  retailSale,
  submitFinalPdi,
  type VehicleOrder,
} from "@/lib/stockDeliveryApi";

type StageMode = "final-pdi" | "retail" | "delivery-ready";

const CONFIG: Record<
  StageMode,
  { title: string; subtitle: string; stages: string[] }
> = {
  "final-pdi": {
    title: "Final PDI",
    subtitle: "Post-allocation delivery inspection — PASS required before retail invoice.",
    stages: ["REGISTRATION", "FINAL_PDI", "ALLOCATED", "PAYMENT", "INSURANCE"],
  },
  retail: {
    title: "Retail & Invoice",
    subtitle: "Record retail sale / invoice after Final PDI PASS (INVOICED).",
    stages: ["FINAL_PDI", "RETAIL", "INVOICED"],
  },
  "delivery-ready": {
    title: "Delivery Ready & Handover",
    subtitle: "Mark delivery ready and complete customer handover (DELIVERED).",
    stages: ["INVOICED", "DELIVERY_READY", "RETAIL", "DELIVERED"],
  },
};

type Props = { mode: StageMode; icon: ReactNode };

export default function AdminStockPipelineStage({ mode, icon }: Props) {
  const cfg = CONFIG[mode];
  const admin = getAdminUser();
  const canPdi = canPerformAction(admin, "stock_delivery", "pdi");
  const canDeliver = canPerformAction(admin, "stock_delivery", "deliver");
  const [rows, setRows] = useState<VehicleOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchVehicleOrders({ limit: 200 });
      setRows(all.filter((o) => cfg.stages.includes(o.stage)));
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [cfg.stages]);

  useEffect(() => {
    void load();
  }, [load]);

  const runFinalPdi = async (id: string, result: "PASS" | "FAIL") => {
    try {
      await submitFinalPdi(id, { result });
      toast.success(`Final PDI ${result}`);
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const runRetail = async (id: string) => {
    try {
      await retailSale(id);
      toast.success("Retail / invoice recorded");
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const runDeliveryReady = async (id: string) => {
    try {
      await markDeliveryReady(id);
      toast.success("Marked delivery ready");
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const runDeliver = async (id: string) => {
    try {
      await deliverOrder(id);
      toast.success("Vehicle delivered");
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {icon}
            {cfg.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{cfg.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/admin/stock/orders">Vehicle Orders</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          No orders in this stage. Continue the pipeline on{" "}
          <Link to="/admin/stock/orders" className="text-primary underline">
            Vehicle Orders
          </Link>
          .
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((o) => (
            <Card key={o._id} className="p-4 flex flex-wrap gap-3 justify-between items-start">
              <div>
                <p className="font-medium">{o.orderNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {o.customerName || o.leadId?.name} · VIN {o.vinNo || o.stockId?.vinNo || "—"}
                </p>
                <Badge className="mt-2">{o.stage}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {mode === "final-pdi" && canPdi && o.stockId && !o.finalPdiPassed ? (
                  <>
                    <Button size="sm" onClick={() => void runFinalPdi(o._id, "PASS")}>
                      Final PDI PASS
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void runFinalPdi(o._id, "FAIL")}>
                      FAIL
                    </Button>
                  </>
                ) : null}
                {mode === "retail" && canDeliver && o.finalPdiPassed && !["INVOICED", "DELIVERY_READY", "DELIVERED"].includes(o.stage) ? (
                  <Button size="sm" onClick={() => void runRetail(o._id)}>
                    Retail / Invoice
                  </Button>
                ) : null}
                {mode === "delivery-ready" && canDeliver && o.stage === "INVOICED" ? (
                  <Button size="sm" variant="outline" onClick={() => void runDeliveryReady(o._id)}>
                    Mark Delivery Ready
                  </Button>
                ) : null}
                {mode === "delivery-ready" && canDeliver && ["DELIVERY_READY", "RETAIL", "INVOICED"].includes(o.stage) && o.stage !== "DELIVERED" ? (
                  <Button size="sm" onClick={() => void runDeliver(o._id)}>
                    Complete Handover
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
