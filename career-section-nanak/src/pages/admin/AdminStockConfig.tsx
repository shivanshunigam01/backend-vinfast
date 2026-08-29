import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchStockConfig, updateStockConfig } from "@/lib/stockPipelineApi";
import { formatApiErrors } from "@/lib/api";

export default function AdminStockConfig() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConfig((await fetchStockConfig()) as Record<string, unknown>);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await updateStockConfig({
        socLowThreshold: config.socLowThreshold,
        storageInspectionDays: config.storageInspectionDays,
        reservationExpiryHours: config.reservationExpiryHours,
      });
      toast.success("Configuration saved");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-xl">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="h-6 w-6" /> Stock Configuration</h1>
      {loading ? <Loader2 className="animate-spin" /> : config ? (
        <Card className="p-4 space-y-4">
          <div><Label>Low SOC threshold (%)</Label>
            <Input type="number" value={String(config.socLowThreshold ?? 20)} onChange={(e) => setConfig({ ...config, socLowThreshold: Number(e.target.value) })} /></div>
          <div><Label>Storage inspection (days)</Label>
            <Input type="number" value={String(config.storageInspectionDays ?? 30)} onChange={(e) => setConfig({ ...config, storageInspectionDays: Number(e.target.value) })} /></div>
          <div><Label>Reservation expiry (hours)</Label>
            <Input type="number" value={String(config.reservationExpiryHours ?? 72)} onChange={(e) => setConfig({ ...config, reservationExpiryHours: Number(e.target.value) })} /></div>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> {saving ? "Saving…" : "Save"}</Button>
        </Card>
      ) : null}
    </div>
  );
}
