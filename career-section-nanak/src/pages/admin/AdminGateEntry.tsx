import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchDispatches, fetchGateEntries } from "@/lib/stockPipelineApi";
import { formatApiErrors } from "@/lib/api";

export default function AdminGateEntry() {
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
          <Card className="p-4"><p className="font-medium mb-2">Pending dispatches ({dispatches.length})</p>
            {dispatches.map((d) => <p key={String(d._id)} className="text-sm">{String(d.dispatchNumber)} — {String(d.truckNumber)}</p>)}
          </Card>
          <Card className="p-4"><p className="font-medium mb-2">Recent gate entries</p>
            {entries.map((e) => <p key={String(e._id)} className="text-sm">{String(e.gateEntryNo)} — {String(e.truckNumber)}</p>)}
          </Card>
        </>
      )}
    </div>
  );
}
