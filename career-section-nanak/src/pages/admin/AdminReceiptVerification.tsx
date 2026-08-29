import { useCallback, useEffect, useState } from "react";
import { Key, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createReceipt, fetchReceiptQueue, type StockUnit } from "@/lib/stockPipelineApi";
import { formatApiErrors } from "@/lib/api";

export default function AdminReceiptVerification() {
  const [queue, setQueue] = useState<StockUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("ACCEPTED");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await fetchReceiptQueue());
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const verify = async (unit: StockUnit) => {
    try {
      await createReceipt({
        vehicleStockId: unit._id,
        receiptStatus: status,
        documents: [
          { key: "oem_invoice", label: "OEM Invoice", value: "Received", ok: true },
          { key: "lr_copy", label: "LR Copy", value: "Received", ok: true },
        ],
        accessories: [
          { key: "key_1", label: "Key 1", value: "Available", ok: true },
          { key: "charging_cable", label: "Charging Cable", value: "Available", ok: true },
        ],
      });
      toast.success(`Receipt ${status} for ${unit.vinNo}`);
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Key className="h-6 w-6" /> Receipt Verification</h1>
        <div className="flex gap-2 items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["ACCEPTED", "ACCEPTED_WITH_OBSERVATION", "HOLD", "REJECTED"].map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>
      {loading ? <Loader2 className="animate-spin mx-auto" /> : queue.map((u) => (
        <Card key={u._id} className="p-4 flex justify-between items-center">
          <div><p className="font-medium">{u.vinNo}</p><p className="text-sm text-muted-foreground">{u.model} {u.variant} · {u.colour}</p></div>
          <Button size="sm" onClick={() => verify(u)}>Verify</Button>
        </Card>
      ))}
    </div>
  );
}
