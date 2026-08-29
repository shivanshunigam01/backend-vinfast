import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { createDispatch, fetchDispatches, fetchPipelinePurchaseOrders, type DispatchRecord, type PurchaseOrder } from "@/lib/stockPipelineApi";

export default function AdminDispatches() {
  const [rows, setRows] = useState<DispatchRecord[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [poId, setPoId] = useState("");
  const [form, setForm] = useState({ oemInvoiceNumber: "", oemInvoiceDate: "", transporter: "", lrNumber: "", truckNumber: "", vin: "", model: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([fetchDispatches(), fetchPipelinePurchaseOrders({ status: "RELEASED" })]);
      setRows(d);
      setPos(p);
      if (!poId && p[0]) setPoId(p[0]._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!poId || !form.vin || !form.model) return toast.error("PO, VIN and model required");
    setSaving(true);
    try {
      await createDispatch({
        purchaseOrderId: poId,
        oemInvoiceNumber: form.oemInvoiceNumber,
        oemInvoiceDate: form.oemInvoiceDate,
        dispatchDate: new Date().toISOString(),
        transporter: form.transporter,
        lrNumber: form.lrNumber,
        truckNumber: form.truckNumber,
        items: [{ vin: form.vin.toUpperCase(), model: form.model }],
      });
      toast.success("Dispatch created");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" /> Dispatch & Transit</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Dispatch</Button>
        </div>
      </div>
      {loading ? <Loader2 className="animate-spin mx-auto" /> : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r._id} className="p-4 flex flex-wrap gap-3 items-center justify-between">
              <div>
                <p className="font-medium">{r.dispatchNumber}</p>
                <p className="text-sm text-muted-foreground">PO: {r.poNumber} · Invoice: {r.oemInvoiceNumber} · Truck: {r.truckNumber}</p>
              </div>
              <Badge>{r.status}</Badge>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Dispatch</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>PO</Label>
            <Select value={poId} onValueChange={setPoId}>
              <SelectTrigger><SelectValue placeholder="Select PO" /></SelectTrigger>
              <SelectContent>{pos.map((p) => <SelectItem key={p._id} value={p._id}>{p.poNumber}</SelectItem>)}</SelectContent>
            </Select>
            {(["oemInvoiceNumber", "oemInvoiceDate", "transporter", "lrNumber", "truckNumber", "vin", "model"] as const).map((k) => (
              <div key={k}><Label>{k}</Label><Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
          </div>
          <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
