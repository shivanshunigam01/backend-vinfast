import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Car, Loader2, RefreshCw } from "lucide-react";
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
import {
  allocateOrder,
  deliverOrder,
  fetchAvailability,
  fetchVehicleOrders,
  releaseOrder,
  retailSale,
  submitFinalPdi,
  updateOrderInsurance,
  updateOrderPayment,
  updateOrderRegistration,
  type VehicleOrder,
} from "@/lib/stockDeliveryApi";

const STAGES = [
  "all",
  "DRAFT",
  "AWAITING_STOCK",
  "ALLOCATED",
  "PAYMENT",
  "INSURANCE",
  "REGISTRATION",
  "FINAL_PDI",
  "INVOICED",
  "DELIVERY_READY",
  "RETAIL",
  "DELIVERED",
];

function nextStepLabel(o: VehicleOrder): string {
  if (o.stage === "DELIVERED") return "Complete — see Deliveries";
  if (o.stage === "RETAIL") return "Next: Mark delivered";
  if (o.stage === "AWAITING_STOCK" || (!o.stockId && ["DRAFT", "AWAITING_STOCK"].includes(o.stage))) {
    return "Next: Raise PO or allocate when free stock arrives";
  }
  if (!o.stockId) return "Next: Allocate VIN";
  if (!o.payment?.done) return "Next: Record payment";
  if (!o.insurance?.done) return "Next: Mark insurance done";
  if (!o.registration?.done) return "Next: Mark registration done";
  if (!o.finalPdiPassed) return "Next: Final PDI PASS";
  if (o.stage !== "RETAIL" && o.stage !== "DELIVERED") return "Next: Retail sale";
  return "Open for details";
}

export default function AdminVehicleOrders() {
  const admin = getAdminUser();
  const canAllocate = canPerformAction(admin, "stock_delivery", "allocate");
  const canUpdate = canPerformAction(admin, "stock_delivery", "update");
  const canPdi = canPerformAction(admin, "stock_delivery", "pdi");
  const canDeliver = canPerformAction(admin, "stock_delivery", "deliver");

  const [stage, setStage] = useState("all");
  const [rows, setRows] = useState<VehicleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VehicleOrder | null>(null);
  const [avail, setAvail] = useState<{ _id: string; vinNo: string; stockId: string; motorNo?: string }[]>([]);
  const [pickStockId, setPickStockId] = useState("");
  const [payForm, setPayForm] = useState({ downPayment: "", finance: "", paymentMode: "", notes: "" });
  const [regNo, setRegNo] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchVehicleOrders({ stage: stage === "all" ? undefined : stage, limit: 100 }));
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [stage]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAvailability = async (order: VehicleOrder) => {
    if (!order.stockId && order.preferredModel) {
      try {
        const a = await fetchAvailability({
          model: order.preferredModel,
          variant: order.preferredVariant,
          colour: order.preferredColour,
        });
        setAvail(
          a.units.map((u) => ({
            _id: u._id,
            vinNo: u.vinNo,
            stockId: u.stockId,
            motorNo: u.motorNo,
          })),
        );
      } catch {
        setAvail([]);
      }
    } else {
      setAvail([]);
    }
  };

  const openOrder = async (order: VehicleOrder) => {
    setSelected(order);
    setPickStockId("");
    setPayForm({
      downPayment: order.payment?.downPayment || "",
      finance: order.payment?.finance || "",
      paymentMode: order.payment?.paymentMode || "",
      notes: order.payment?.notes || "",
    });
    setRegNo("");
    await loadAvailability(order);
  };

  /** Close dialog after success (milestone steps). */
  const run = async (fn: () => Promise<VehicleOrder | unknown>, ok: string) => {
    setSaving(true);
    try {
      await fn();
      toast.success(ok);
      setSelected(null);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  /** Keep dialog open and refresh order (e.g. after allocate so VIN/motor show). */
  const runKeepOpen = async (fn: () => Promise<VehicleOrder>, ok: string) => {
    setSaving(true);
    try {
      const updated = await fn();
      toast.success(ok);
      setSelected(updated);
      setPickStockId("");
      setAvail([]);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const needsStock =
    selected &&
    !selected.stockId &&
    (selected.stage === "AWAITING_STOCK" || avail.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Car className="h-6 w-6 text-primary" />
            Vehicle Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Booking creates an order automatically → allocate VIN → payment → insurance →
            registration → final PDI → retail → deliver.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "all" ? "All stages" : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center space-y-3 text-muted-foreground">
          <p>No vehicle orders yet.</p>
          <p className="text-sm">
            Set a lead to <span className="font-medium text-foreground">Booking</span> in Lead CRM —
            an order is created automatically. Or open an existing Booking lead and use{" "}
            <span className="font-medium text-foreground">Open vehicle order / Allocate stock</span>.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin/crm/leads">Open Lead CRM</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin/stock/purchase-orders">Raise Purchase Order</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((o) => (
            <button
              key={o._id}
              type="button"
              className="w-full text-left"
              onClick={() => void openOrder(o)}
            >
              <Card className="p-4 hover:bg-muted/40 transition-colors flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-semibold">{o.orderNumber}</p>
                  <p className="text-sm">
                    {o.customerName || o.leadId?.name || "—"} · {o.preferredModel}
                    {o.vinNo ? ` · VIN ${o.vinNo}` : ""}
                    {o.motorNo ? ` · Motor ${o.motorNo}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{nextStepLabel(o)}</p>
                </div>
                <Badge>{o.stage}</Badge>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.orderNumber}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4 text-sm">
              <p>
                {selected.customerName} · {selected.customerMobile}
                <br />
                Model: {selected.preferredModel}
                {selected.preferredVariant ? ` · ${selected.preferredVariant}` : ""}
                {selected.preferredColour ? ` · ${selected.preferredColour}` : ""}
              </p>
              <Badge variant="secondary">{selected.stage}</Badge>
              <p className="text-xs text-muted-foreground">{nextStepLabel(selected)}</p>

              {selected.vinNo || selected.motorNo || selected.stockId ? (
                <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                  <p className="font-medium">Allocated vehicle</p>
                  <p>
                    VIN:{" "}
                    <span className="font-mono font-semibold">
                      {selected.vinNo || selected.stockId?.vinNo || "—"}
                    </span>
                  </p>
                  <p>
                    Motor:{" "}
                    <span className="font-mono">
                      {selected.motorNo || selected.stockId?.motorNo || "—"}
                    </span>
                  </p>
                  {selected.stockId?.stockId ? (
                    <p className="text-xs text-muted-foreground">Stock ID: {selected.stockId.stockId}</p>
                  ) : null}
                </div>
              ) : null}

              {needsStock ? (
                <div className="space-y-2 border border-amber-500/40 rounded-md p-3 bg-amber-500/5">
                  <p className="font-medium">Awaiting free stock</p>
                  <p className="text-xs text-muted-foreground">
                    No free unit for this model yet. Raise a purchase order, receive + Yard PDI PASS,
                    then allocate here.
                  </p>
                  <Button size="sm" asChild>
                    <Link to="/admin/stock/purchase-orders">Raise Purchase Order</Link>
                  </Button>
                </div>
              ) : null}

              {!selected.stockId && canAllocate ? (
                <div className="space-y-2 border rounded-md p-3">
                  <p className="font-medium">Allocate free stock</p>
                  {avail.length ? (
                    <Select value={pickStockId} onValueChange={setPickStockId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick VIN" />
                      </SelectTrigger>
                      <SelectContent>
                        {avail.map((u) => (
                          <SelectItem key={u._id} value={u._id}>
                            {u.vinNo}
                            {u.motorNo ? ` · Motor ${u.motorNo}` : ""} ({u.stockId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-muted-foreground text-xs">
                      No free stock listed — use Raise Purchase Order above, or Allocate to try
                      auto-pick.
                    </p>
                  )}
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() =>
                      void runKeepOpen(
                        () => allocateOrder(selected._id, pickStockId || undefined),
                        "Allocated — VIN & motor saved on order",
                      )
                    }
                  >
                    Allocate
                  </Button>
                </div>
              ) : null}

              {selected.stockId && canAllocate && !["RETAIL", "DELIVERED"].includes(selected.stage) ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => void run(() => releaseOrder(selected._id), "Released")}
                >
                  Release allocation
                </Button>
              ) : null}

              {selected.stockId && canUpdate ? (
                <div className="space-y-2 border rounded-md p-3">
                  <p className="font-medium">Payment</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Down payment"
                      value={payForm.downPayment}
                      onChange={(e) => setPayForm((p) => ({ ...p, downPayment: e.target.value }))}
                    />
                    <Input
                      placeholder="Finance"
                      value={payForm.finance}
                      onChange={(e) => setPayForm((p) => ({ ...p, finance: e.target.value }))}
                    />
                    <Input
                      placeholder="Payment mode"
                      value={payForm.paymentMode}
                      onChange={(e) => setPayForm((p) => ({ ...p, paymentMode: e.target.value }))}
                    />
                    <Input
                      placeholder="Notes"
                      value={payForm.notes}
                      onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={saving || selected.payment?.done}
                    onClick={() =>
                      void run(
                        () => updateOrderPayment(selected._id, { ...payForm, done: true }),
                        "Payment recorded — next: insurance",
                      )
                    }
                  >
                    {selected.payment?.done ? "Payment done" : "Mark payment done"}
                  </Button>
                </div>
              ) : null}

              {canUpdate && selected.payment?.done ? (
                <Button
                  size="sm"
                  disabled={saving || selected.insurance?.done}
                  onClick={() =>
                    void run(
                      () => updateOrderInsurance(selected._id, { done: true }),
                      "Insurance done — next: registration",
                    )
                  }
                >
                  {selected.insurance?.done ? "Insurance done" : "Mark insurance done"}
                </Button>
              ) : null}

              {canUpdate && selected.insurance?.done ? (
                <div className="space-y-2 border rounded-md p-3">
                  <Label>Registration no</Label>
                  <Input value={regNo} onChange={(e) => setRegNo(e.target.value)} className="uppercase" />
                  <Button
                    size="sm"
                    disabled={saving || selected.registration?.done}
                    onClick={() =>
                      void run(
                        () =>
                          updateOrderRegistration(selected._id, {
                            done: true,
                            registrationNo: regNo || undefined,
                          }),
                        "Registration done — next: final PDI",
                      )
                    }
                  >
                    {selected.registration?.done ? "Registration done" : "Mark registration done"}
                  </Button>
                </div>
              ) : null}

              {canPdi && selected.stockId && selected.registration?.done ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={saving || selected.finalPdiPassed}
                    onClick={() =>
                      void run(
                        () => submitFinalPdi(selected._id, { result: "PASS" }),
                        "Final PDI PASS — next: retail sale",
                      )
                    }
                  >
                    Final PDI PASS
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      void run(() => submitFinalPdi(selected._id, { result: "FAIL" }), "Final PDI FAIL")
                    }
                  >
                    FAIL
                  </Button>
                </div>
              ) : null}

              {canDeliver && selected.finalPdiPassed && selected.stage !== "DELIVERED" ? (
                <div className="flex gap-2">
                  {selected.stage !== "RETAIL" && selected.stage !== "DELIVERED" ? (
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() =>
                        void run(() => retailSale(selected._id), "Retail sale — next: deliver")
                      }
                    >
                      Retail sale
                    </Button>
                  ) : null}
                  {selected.stage === "RETAIL" ? (
                    <Button
                      size="sm"
                      disabled={saving}
                      onClick={() => void run(() => deliverOrder(selected._id), "Delivered")}
                    >
                      Mark delivered
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {selected.feedbackUrl ? (
                <p className="text-xs text-muted-foreground">
                  Feedback:{" "}
                  <a className="underline" href={selected.feedbackUrl} target="_blank" rel="noreferrer">
                    {selected.feedbackUrl}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
