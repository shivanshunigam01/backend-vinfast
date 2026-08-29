import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchPdiQueue, submitPreStockPdi, type StockUnit } from "@/lib/stockPipelineApi";
import { formatApiErrors } from "@/lib/api";

export default function AdminPreStockPdi() {
  const [queue, setQueue] = useState<StockUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [soc, setSoc] = useState("80");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await fetchPdiQueue());
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (unit: StockUnit, result: string) => {
    try {
      await submitPreStockPdi(unit._id, {
        result,
        socPercent: Number(soc),
        hvBatteryStatus: "OK",
        batteryWarning: false,
        diagnosticScan: true,
        dtcPresent: false,
        checklist: [],
        notes: result === "PASS" ? "Pre-stock PDI passed" : "Issue found",
      });
      toast.success(`PDI ${result} — ${unit.vinNo}`);
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="h-6 w-6" /> Pre-Stock PDI</h1>
        <div className="flex gap-2 items-center">
          <Input className="w-20" value={soc} onChange={(e) => setSoc(e.target.value)} placeholder="SOC %" />
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>
      {loading ? <Loader2 className="animate-spin mx-auto" /> : queue.map((u) => (
        <Card key={u._id} className="p-4 flex flex-wrap gap-2 justify-between items-center">
          <div><p className="font-medium">{u.vinNo}</p><p className="text-sm text-muted-foreground">{u.model} · {u.vehicleStatus}</p></div>
          <div className="flex gap-2">
            <Button size="sm" variant="default" onClick={() => submit(u, "PASS")}>PASS</Button>
            <Button size="sm" variant="destructive" onClick={() => submit(u, "FAIL")}>FAIL</Button>
            <Button size="sm" variant="outline" onClick={() => submit(u, "TECHNICAL_HOLD")}>HOLD</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
