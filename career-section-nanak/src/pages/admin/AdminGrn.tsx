import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchGrns } from "@/lib/stockPipelineApi";
import { formatApiErrors } from "@/lib/api";

export default function AdminGrn() {
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
      {loading ? <Loader2 className="animate-spin mx-auto" /> : rows.map((r) => (
        <Card key={String(r._id)} className="p-4">
          <p className="font-medium">{String(r.grnNumber)}</p>
          <p className="text-sm text-muted-foreground">PO {String(r.poNumber)} · Qty {String(r.receivedQty)}/{String(r.expectedQty)} · {String(r.status)}</p>
        </Card>
      ))}
    </div>
  );
}
