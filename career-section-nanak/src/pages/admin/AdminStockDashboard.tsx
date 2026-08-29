import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatApiErrors } from "@/lib/api";
import { fetchStockDashboard, type DashboardKpis } from "@/lib/stockPipelineApi";

export default function AdminStockDashboard() {
  const [data, setData] = useState<DashboardKpis | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchStockDashboard());
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const kpi = (label: string, value: number | string, sub?: string) => (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground mt-1">{sub}</p> : null}
    </Card>
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Stock Dashboard</h1>
          <p className="text-muted-foreground text-sm">Procurement, transit, receipt, PDI, stock & EV health KPIs</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpi("PO Released", data.procurement.poRaised)}
          {kpi("PO Value", `₹${(data.procurement.poValue || 0).toLocaleString()}`)}
          {kpi("In Transit", data.transit.inTransit)}
          {kpi("GRN Pending", data.receipt.grnPending)}
          {kpi("Receipt Exceptions", data.receipt.receiptExceptions)}
          {kpi("PDI Pending", data.pdi.pdiPending)}
          {kpi("PDI Failed/Hold", data.pdi.pdiFailedHold)}
          {kpi("Physical Stock", data.stock.physicalStock)}
          {kpi("Available Stock", data.stock.availableStock)}
          {kpi("Reserved/Booked", data.stock.reservedBooked)}
          {kpi("Ageing 60+", data.stock.ageing60Plus)}
          {kpi("Low SOC Alert", data.evHealth.lowSocAlert)}
        </div>
      ) : null}
    </div>
  );
}
