import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Car, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchVehicle360 } from "@/lib/stockPipelineApi";
import { formatApiErrors } from "@/lib/api";

export default function AdminVehicle360() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      setData((await fetchVehicle360(id)) as Record<string, unknown>);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const stock = data?.stock as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild><Link to="/admin/stock"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Car className="h-6 w-6" /> VIN 360</h1>
      </div>
      {loading ? <Loader2 className="animate-spin mx-auto" /> : stock ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-4">
            <p className="font-medium text-lg">{String(stock.vinNo)}</p>
            <p className="text-sm text-muted-foreground">{String(stock.model)} {String(stock.variant)} · {String(stock.colour)}</p>
            <p className="mt-2">Status: <strong>{String(stock.vehicleStatus || stock.status)}</strong></p>
            <p className="text-sm">GRN: {stock.grnDate ? new Date(String(stock.grnDate)).toLocaleDateString() : "—"}</p>
            <p className="text-sm">Ageing: {String(stock.ageingBucket || "—")} · SOC: {String(stock.lastSoc ?? "—")}%</p>
          </Card>
          <Card className="p-4 space-y-2 text-sm">
            <p>PDI records: {Array.isArray(data?.pdis) ? data.pdis.length : 0}</p>
            <p>Rectifications: {Array.isArray(data?.rectifications) ? data.rectifications.length : 0}</p>
            <p>Movements: {Array.isArray(data?.movements) ? data.movements.length : 0}</p>
            <p>Charging logs: {Array.isArray(data?.charging) ? data.charging.length : 0}</p>
            <p>Audit entries: {Array.isArray(data?.audit) ? data.audit.length : 0}</p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
