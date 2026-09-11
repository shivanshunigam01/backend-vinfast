import { useCallback, useEffect, useState } from "react";
import { ArrowLeftRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatApiErrors, adminGet } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import { fetchTransfers, moveStock, type StockTransfer } from "@/lib/stockPipelineApi";

type StockOption = {
  _id: string;
  stockId: string;
  vinNo: string;
  model: string;
  variant?: string | null;
  colour?: string | null;
  yardName?: string | null;
  zoneName?: string | null;
  bayName?: string | null;
  location?: string | null;
};

const TRANSFER_TYPES = ["LOCATION", "BRANCH", "DEALER"] as const;

export default function AdminStockTransfer() {
  const admin = getAdminUser();
  const canMove =
    canPerformAction(admin, "stock_inventory", "update") ||
    canPerformAction(admin, "vehicle_stock", "update");

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [vehicles, setVehicles] = useState<StockOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicleStockId: "",
    yardName: "",
    zoneName: "",
    bayName: "",
    transferType: "LOCATION",
    toDealerName: "",
    remarks: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, stockRes] = await Promise.all([
        fetchTransfers(100),
        adminGet<StockOption[]>("/admin/stock/vehicles?limit=200"),
      ]);
      setTransfers(t);
      setVehicles(Array.isArray(stockRes.data) ? stockRes.data : []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onVehicleChange = (id: string) => {
    const v = vehicles.find((x) => x._id === id);
    setForm((f) => ({
      ...f,
      vehicleStockId: id,
      yardName: v?.yardName || "",
      zoneName: v?.zoneName || "",
      bayName: v?.bayName || "",
    }));
  };

  const submit = async () => {
    if (!form.vehicleStockId) {
      toast.error("Select a vehicle");
      return;
    }
    if (form.transferType === "DEALER" && !form.toDealerName.trim()) {
      toast.error("Enter dealer name for dealer transfer");
      return;
    }
    setSaving(true);
    try {
      await moveStock(form.vehicleStockId, {
        yardName: form.yardName.trim() || undefined,
        zoneName: form.zoneName.trim() || undefined,
        bayName: form.bayName.trim() || undefined,
        transferType: form.transferType,
        toDealerName: form.transferType === "DEALER" ? form.toDealerName.trim() : undefined,
        remarks: form.remarks.trim() || undefined,
      });
      toast.success("Stock transfer recorded");
      setForm({
        vehicleStockId: "",
        yardName: "",
        zoneName: "",
        bayName: "",
        transferType: "LOCATION",
        toDealerName: "",
        remarks: "",
      });
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6" /> Stock Transfer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Move vehicles between yard / zone / bay, branch, or dealer
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {canMove ? (
        <Card className="p-4 space-y-3">
          <p className="font-medium text-sm">New transfer</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vehicle</Label>
              <Select value={form.vehicleStockId || undefined} onValueChange={onVehicleChange}>
                <SelectTrigger><SelectValue placeholder="Select VIN / stock" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.stockId} · {v.vinNo} · {v.model}
                      {v.variant ? ` ${v.variant}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Yard</Label>
              <Input value={form.yardName} onChange={(e) => setForm((f) => ({ ...f, yardName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Input value={form.zoneName} onChange={(e) => setForm((f) => ({ ...f, zoneName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Bay</Label>
              <Input value={form.bayName} onChange={(e) => setForm((f) => ({ ...f, bayName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Transfer type</Label>
              <Select
                value={form.transferType}
                onValueChange={(transferType) => setForm((f) => ({ ...f, transferType }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSFER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.transferType === "DEALER" ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>To dealer name</Label>
                <Input
                  value={form.toDealerName}
                  onChange={(e) => setForm((f) => ({ ...f, toDealerName: e.target.value }))}
                />
              </div>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Move stock
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <Loader2 className="animate-spin mx-auto" />
      ) : (
        <div className="space-y-2">
          <p className="font-medium text-sm">Recent transfers ({transfers.length})</p>
          {transfers.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">No transfers yet</Card>
          ) : (
            transfers.map((t) => {
              const stock =
                typeof t.vehicleStockId === "object" && t.vehicleStockId
                  ? t.vehicleStockId
                  : null;
              const movedBy =
                typeof t.movedBy === "object" && t.movedBy ? t.movedBy.name : "—";
              return (
                <Card key={t._id} className="p-4 space-y-1">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant="secondary">{t.transferType || "LOCATION"}</Badge>
                    <span className="font-mono text-sm">{t.vin || stock?.vinNo || "—"}</span>
                    {stock?.model ? <span className="text-sm text-muted-foreground">{stock.model}</span> : null}
                  </div>
                  <p className="text-sm">
                    {t.fromLocation || "—"} → {t.toLocation || "—"}
                    {t.toDealerName ? ` · Dealer: ${t.toDealerName}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {movedBy}
                    {t.createdAt ? ` · ${new Date(t.createdAt).toLocaleString("en-IN")}` : ""}
                    {t.remarks ? ` · ${t.remarks}` : ""}
                  </p>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
