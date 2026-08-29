import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { exteriorColoursForModel } from "@/data/stockColourOptions";
import {
  approvePurchaseOrder,
  createPipelinePurchaseOrder,
  fetchPipelinePurchaseOrders,
  releasePurchaseOrder,
  submitPurchaseOrder,
  type PurchaseOrder,
} from "@/lib/stockPipelineApi";

export default function AdminPurchaseOrders() {
  const admin = getAdminUser();
  const canCreate = canPerformAction(admin, "stock_delivery", "create");
  const canUpdate = canPerformAction(admin, "stock_delivery", "update");
  const { models: catalogModels, trimsFor } = useVehicleCatalog();

  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [model, setModel] = useState("");
  const [variant, setVariant] = useState("");
  const [colour, setColour] = useState("");
  const [qty, setQty] = useState("1");
  const [poType, setPoType] = useState("Regular");
  const [paymentTerms, setPaymentTerms] = useState("Advance");
  const [basicPrice, setBasicPrice] = useState("");
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
      setVariant(trimsFor(m)[0] ?? "");
      setColour(exteriorColoursForModel(m)[0] ?? "");
    }
  }, [catalogModels, model, trimsFor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchPipelinePurchaseOrders({ limit: 100 }));
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onCreate = async () => {
    if (!model.trim()) return toast.error("Select a vehicle model");
    setSaving(true);
    try {
      await createPipelinePurchaseOrder({
        poType,
        paymentTerms,
        supplier: "VinFast",
        bookingLinked: false,
        lines: [{
          model: model.trim(),
          variant: variant.trim() || undefined,
          colour: colour.trim() || undefined,
          qty: Math.max(1, Number(qty) || 1),
          basicPrice: Number(basicPrice) || 0,
          modelYear: new Date().getFullYear(),
        }],
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><ClipboardList className="h-6 w-6" /> Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Draft → Submit → Approve → Release → Dispatch → Gate → GRN → Receipt → PDI</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
          {canCreate ? <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> New PO</Button> : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {rows.map((po) => (
            <Card key={po._id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-semibold">{po.poNumber}</p>
                  <p className="text-xs text-muted-foreground">{po.poType || "Regular"} · {po.paymentTerms || "Advance"}</p>
                </div>
                <Badge variant="secondary">{po.status}</Badge>
              </div>
              <ul className="text-sm space-y-1">
                {po.lines.map((l, i) => (
                  <li key={l._id || i}>
                    {l.model}{l.variant ? ` · ${l.variant}` : ""}{l.colour ? ` · ${l.colour}` : ""} — {l.receivedQty ?? 0}/{l.qty}
                    {l.netPurchaseValue ? ` · ₹${l.netPurchaseValue.toLocaleString()}` : ""}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {canUpdate && po.status === "DRAFT" ? (
                  <Button size="sm" variant="outline" onClick={async () => { try { await submitPurchaseOrder(po._id); toast.success("Submitted"); load(); } catch (e) { toast.error(formatApiErrors(e)); } }}>Submit</Button>
                ) : null}
                {canUpdate && po.status === "SUBMITTED" ? (
                  <Button size="sm" variant="outline" onClick={async () => { try { await approvePurchaseOrder(po._id); toast.success("Approved"); load(); } catch (e) { toast.error(formatApiErrors(e)); } }}>Approve</Button>
                ) : null}
                {canUpdate && po.status === "APPROVED" ? (
                  <Button size="sm" onClick={async () => { try { await releasePurchaseOrder(po._id); toast.success("Released"); load(); } catch (e) { toast.error(formatApiErrors(e)); } }}>Release PO</Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>PO Type</Label>
                <Select value={poType} onValueChange={setPoType}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Regular", "Additional", "Demo", "Test Drive", "Replacement"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Advance", "Credit", "Inventory Funding", "Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div><Label>Model</Label>
              <Select value={model || undefined} onValueChange={(m) => { setModel(m); setVariant(trimsFor(m)[0] ?? ""); setColour(exteriorColoursForModel(m)[0] ?? ""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{catalogModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Variant</Label><Input value={variant} onChange={(e) => setVariant(e.target.value)} /></div>
              <div><Label>Colour</Label><Input value={colour} onChange={(e) => setColour(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Qty</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
              <div><Label>Basic Price</Label><Input type="number" value={basicPrice} onChange={(e) => setBasicPrice(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={saving || !model} onClick={() => void onCreate()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
