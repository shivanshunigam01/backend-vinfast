import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchRectifications, updateRectification } from "@/lib/stockPipelineApi";
import { formatApiErrors } from "@/lib/api";

export default function AdminRectifications() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await fetchRectifications()) as Array<Record<string, unknown>>);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const complete = async (id: string) => {
    try {
      await updateRectification(id, { status: "COMPLETED", actionTaken: "Rectification completed" });
      toast.success("Marked complete — re-PDI queued if required");
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6" /> Rectifications</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading ? <Loader2 className="animate-spin mx-auto" /> : rows.map((r) => (
        <Card key={String(r._id)} className="p-4 flex justify-between items-start gap-4">
          <div>
            <p className="font-medium">{String(r.rectificationNo)} — {String(r.vin)}</p>
            <p className="text-sm text-muted-foreground">{String(r.issueDescription)}</p>
            <Badge className="mt-2">{String(r.status)}</Badge>
          </div>
          {r.status !== "CLOSED" && r.status !== "RE_PDI_PENDING" ? (
            <Button size="sm" onClick={() => complete(String(r._id))}>Complete</Button>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
