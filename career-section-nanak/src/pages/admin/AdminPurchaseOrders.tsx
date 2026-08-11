import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Plus, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { exteriorColoursForModel } from "@/data/stockColourOptions";
import {
  createPurchaseOrder,
  fetchPurchaseOrders,
  raisePurchaseOrder,
  receiveTransit,
  type PurchaseOrder,
} from "@/lib/stockDeliveryApi";

export default function AdminPurchaseOrders() {
  const admin = getAdminUser();
  const canCreate = canPerformAction(admin, "stock_delivery", "create");
  const canUpdate = canPerformAction(admin, "stock_delivery", "update");
  const canReceive = canPerformAction(admin, "stock_delivery", "receive");
  const { models: catalogModels, trimsFor } = useVehicleCatalog();

  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [colour, setColour] = useState("");
  const [qty, setQty] = useState("1");
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);
  const [vinNo, setVinNo] = useState("");
  const [motorNo, setMotorNo] = useState("");
  const [yardPdiResult, setYardPdiResult] = useState<"PASS" | "FAIL">("PASS");
  const [yardPdiNotes, setYardPdiNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const variantOptions = useMemo(() => trimsFor(model), [trimsFor, model]);
  const colourOptions = useMemo(() => {
    const base = exteriorColoursForModel(model);
    if (colour && !base.includes(colour)) return [colour, ...base];
    return base;
  }, [model, colour]);

  useEffect(() => {
    if (!model && catalogModels.length) {
      const m = catalogModels[0];
      setModel(m);
      const v = trimsFor(m)[0] ?? "";
      setVariant(v);
      setColour(exteriorColoursForModel(m)[0] ?? "");
    }
  }, [catalogModels, model, trimsFor]);

  const applyModel = (m: string) => {
    setModel(m);
    const v = trimsFor(m)[0] ?? "";
    setVariant(v);
    setColour(exteriorColoursForModel(m)[0] ?? "");
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchPurchaseOrders({ limit: 100 }));
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = async () => {
    if (!model.trim()) {
      toast.error("Select a vehicle model");
      return;
    }
    setSaving(true);
    try {
      await createPurchaseOrder({
        lines: [
          {
            model: model.trim(),
            variant: variant.trim() || undefined,
            colour: colour.trim() || undefined,
            qty: Math.max(1, Number(qty) || 1),
          },
        ],
      });
      toast.success("Purchase order created");
      setCreateOpen(false);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const onRaise = async (id: string) => {
    try {
      await raisePurchaseOrder(id);
      toast.success("PO raised");
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const onReceive = async () => {
    if (!receivePo) return;
    if (!vinNo.trim()) {
      toast.error("Enter VIN");
      return;
    }
    setSaving(true);
    try {
      const line = receivePo.lines[0];
      await receiveTransit(
        receivePo._id,
        [
          {
            model: line?.model || model,
            vinNo: vinNo.trim(),
            variant: line?.variant,
            colour: line?.colour,
            motorNo: motorNo.trim() || undefined,
          },
        ],
        {
          result: yardPdiResult,
          notes: yardPdiNotes.trim() || undefined,
          location: yardPdiResult === "PASS" ? "Yard" : undefined,
        },
      );
      toast.success(
        yardPdiResult === "PASS"
          ? "Received — Yard PDI PASS (now free stock)"
          : "Received — Yard PDI FAIL (held in transit)",
      );
      setReceivePo(null);
      setVinNo("");
      setMotorNo("");
      setYardPdiResult("PASS");
      setYardPdiNotes("");
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Purchase Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Raise PO → Receive + Yard PDI → Free stock → allocate on Vehicle Orders.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {canCreate ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New PO
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No purchase orders yet.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((po) => (
            <Card key={po._id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-semibold">{po.poNumber}</p>
                  <p className="text-xs text-muted-foreground">{po.supplier || "VinFast"}</p>
                </div>
                <Badge variant="secondary">{po.status}</Badge>
              </div>
              <ul className="text-sm space-y-1">
                {po.lines.map((l, i) => (
                  <li key={l._id || i}>
                    {l.model}
                    {l.variant ? ` · ${l.variant}` : ""}
                    {l.colour ? ` · ${l.colour}` : ""} — {l.receivedQty ?? 0}/{l.qty} received
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {canUpdate && po.status === "DRAFT" ? (
                  <Button size="sm" variant="outline" onClick={() => void onRaise(po._id)}>
                    Raise PO
                  </Button>
                ) : null}
                {canReceive && ["RAISED", "PARTIAL"].includes(po.status) ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setReceivePo(po);
                      setYardPdiResult("PASS");
                      setYardPdiNotes("");
                      setVinNo("");
                      setMotorNo("");
                    }}
                  >
                    <Truck className="h-4 w-4 mr-1" /> Receive + Yard PDI
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Vehicle model</Label>
              <Select value={model || undefined} onValueChange={applyModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {catalogModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Variant</Label>
                {variantOptions.length === 0 ? (
                  <Input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Optional" />
                ) : (
                  <Select value={variant || undefined} onValueChange={setVariant}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select variant" />
                    </SelectTrigger>
                    <SelectContent>
                      {variantOptions.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1">
                <Label>Colour</Label>
                {colourOptions.length === 0 ? (
                  <Input value={colour} onChange={(e) => setColour(e.target.value)} placeholder="Optional" />
                ) : (
                  <Select value={colour || undefined} onValueChange={setColour}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select colour" />
                    </SelectTrigger>
                    <SelectContent>
                      {colourOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Qty</Label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving || !model} onClick={() => void onCreate()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(receivePo)} onOpenChange={(o) => !o && setReceivePo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive + Yard PDI — {receivePo?.poNumber}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <p className="text-xs text-muted-foreground">
              Line: {receivePo?.lines[0]?.model}
              {receivePo?.lines[0]?.variant ? ` · ${receivePo.lines[0].variant}` : ""}
              {receivePo?.lines[0]?.colour ? ` · ${receivePo.lines[0].colour}` : ""}
            </p>
            <div className="space-y-1">
              <Label>VIN *</Label>
              <Input value={vinNo} onChange={(e) => setVinNo(e.target.value)} className="uppercase" />
            </div>
            <div className="space-y-1">
              <Label>Motor no (optional)</Label>
              <Input value={motorNo} onChange={(e) => setMotorNo(e.target.value)} className="uppercase" />
            </div>
            <div className="space-y-1">
              <Label>Yard receiving PDI</Label>
              <Select
                value={yardPdiResult}
                onValueChange={(v) => setYardPdiResult(v as "PASS" | "FAIL")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PASS">PASS — move to free stock</SelectItem>
                  <SelectItem value="FAIL">FAIL — hold in transit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>PDI notes (optional)</Label>
              <Input
                value={yardPdiNotes}
                onChange={(e) => setYardPdiNotes(e.target.value)}
                placeholder="Inspection remarks"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivePo(null)}>
              Cancel
            </Button>
            <Button disabled={saving || !vinNo.trim()} onClick={() => void onReceive()}>
              Receive vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
