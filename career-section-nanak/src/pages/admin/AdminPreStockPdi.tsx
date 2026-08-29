import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import PipelineDeleteButton from "@/components/admin/PipelineDeleteButton";
import StockPrintButton from "@/components/admin/StockPrintButton";
import {
  deletePdi,
  fetchPdiQueue,
  fetchPdis,
  submitPreStockPdi,
  type StockPdiRecord,
  type StockUnit,
} from "@/lib/stockPipelineApi";

type HoldDialogState = {
  unit: StockUnit;
  result: "FAIL" | "TECHNICAL_HOLD" | "OEM_HOLD";
};

const HOLD_REASONS = [
  { value: "TECHNICAL", label: "Technical issue" },
  { value: "DAMAGE", label: "Physical damage" },
  { value: "BATTERY", label: "Battery / HV" },
  { value: "OEM_CAMPAIGN", label: "OEM campaign" },
  { value: "OTHER", label: "Other" },
];

export default function AdminPreStockPdi() {
  const admin = getAdminUser();
  const canDelete =
    canPerformAction(admin, "stock_pdi", "delete") ||
    canPerformAction(admin, "stock_delivery", "delete");

  const [queue, setQueue] = useState<StockUnit[]>([]);
  const [completed, setCompleted] = useState<StockPdiRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [soc, setSoc] = useState("80");
  const [holdDialog, setHoldDialog] = useState<HoldDialogState | null>(null);
  const [holdFeedback, setHoldFeedback] = useState("");
  const [holdReason, setHoldReason] = useState("TECHNICAL");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, done] = await Promise.all([fetchPdiQueue(), fetchPdis("PRE_STOCK")]);
      setQueue(q);
      setCompleted(done);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitPass = async (unit: StockUnit) => {
    try {
      await submitPreStockPdi(unit._id, {
        result: "PASS",
        socPercent: Number(soc),
        hvBatteryStatus: "OK",
        batteryWarning: false,
        diagnosticScan: true,
        dtcPresent: false,
        checklist: [],
        notes: "Pre-stock PDI passed",
      });
      toast.success(`PDI PASS — ${unit.vinNo}`);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const openHoldDialog = (unit: StockUnit, result: HoldDialogState["result"]) => {
    setHoldDialog({ unit, result });
    setHoldFeedback("");
    setHoldReason(
      result === "OEM_HOLD" ? "OEM_CAMPAIGN" : result === "FAIL" ? "TECHNICAL" : "TECHNICAL",
    );
  };

  const submitHold = async () => {
    if (!holdDialog) return;
    if (!holdFeedback.trim()) {
      toast.error("Enter hold feedback — describe the issue for replacement tracking");
      return;
    }
    setSubmitting(true);
    try {
      await submitPreStockPdi(holdDialog.unit._id, {
        result: holdDialog.result,
        holdReason,
        socPercent: Number(soc),
        hvBatteryStatus: "OK",
        batteryWarning: false,
        diagnosticScan: true,
        dtcPresent: false,
        checklist: [],
        notes: holdFeedback.trim(),
        holdFeedback: holdFeedback.trim(),
      });
      toast.success(
        `${holdDialog.result.replace(/_/g, " ")} — ${holdDialog.unit.vinNo}. Visible in Vehicle Stock as hold.`,
      );
      setHoldDialog(null);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Pre-Stock PDI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            PASS → available stock. FAIL / HOLD → flagged in Vehicle Stock with feedback for future replacement.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Default SOC %</span>
          <Input className="w-20 h-9" value={soc} onChange={(e) => setSoc(e.target.value)} placeholder="SOC" />
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">PDI queue ({queue.length})</h2>
              <Badge variant="secondary">PDI Executive</Badge>
            </div>
            {queue.length === 0 ? (
              <Card className="p-8 text-center border-dashed space-y-3">
                <Wrench className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <p className="font-medium text-foreground">No vehicles waiting for pre-stock PDI</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Complete <strong>Receipt Verification</strong> on vehicles in RECEIVED status first.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/stock/receipt">Go to Receipt Verification</Link>
                </Button>
              </Card>
            ) : (
              queue.map((u) => (
                <Card key={u._id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <p className="font-mono font-semibold">{u.vinNo}</p>
                    <p className="text-sm text-muted-foreground">
                      {u.model}{u.variant ? ` · ${u.variant}` : ""}{u.colour ? ` · ${u.colour}` : ""}
                    </p>
                    <Badge variant="outline" className="mt-1 text-[10px]">{u.vehicleStatus ?? u.status}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button size="sm" onClick={() => void submitPass(u)}>PASS</Button>
                    <Button size="sm" variant="destructive" onClick={() => openHoldDialog(u, "FAIL")}>FAIL</Button>
                    <Button size="sm" variant="outline" onClick={() => openHoldDialog(u, "TECHNICAL_HOLD")}>
                      Technical hold
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openHoldDialog(u, "OEM_HOLD")}>
                      OEM hold
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          {completed.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Recent pre-stock PDI ({completed.length})</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {completed.slice(0, 12).map((p) => (
                  <Card key={p._id} className="p-3 text-sm space-y-2">
                    <p className="font-mono font-medium truncate">{p.vin || p.pdiNumber}</p>
                    <p className="text-muted-foreground text-xs">
                      {p.pdiNumber} · {p.result}
                      {p.performedAt ? ` · ${new Date(p.performedAt).toLocaleDateString()}` : ""}
                    </p>
                    {p.notes && !["Pre-stock PDI passed", "Issue found"].includes(p.notes) ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400 line-clamp-3">{p.notes}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <StockPrintButton
                        getPrintOptions={() => ({
                          title: "Pre-Stock PDI",
                          documentNo: p.pdiNumber || p.vin || p._id,
                          vendor: { name: "VinFast" },
                          meta: [
                            { label: "VIN", value: p.vin || "—" },
                            { label: "Result", value: p.result || "—" },
                            { label: "Notes", value: p.notes || "—" },
                          ],
                          bodyHtml: `<p>Pre-stock PDI ${p.result || ""} for VIN ${p.vin || "—"}.</p>${p.notes ? `<p><strong>Feedback:</strong> ${p.notes}</p>` : ""}`,
                        })}
                      />
                      {canDelete ? (
                      <PipelineDeleteButton
                        label="Delete"
                        title={`Delete PDI ${p.pdiNumber}?`}
                        description="Reverts vehicle to PDI_PENDING. Blocked if vehicle is allocated."
                        onConfirm={async () => {
                          try {
                            await deletePdi(p._id);
                            toast.success("PDI record deleted");
                            void load();
                          } catch (e) {
                            toast.error(formatApiErrors(e));
                            throw e;
                          }
                        }}
                      />
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      <Dialog open={Boolean(holdDialog)} onOpenChange={(open) => !open && setHoldDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {holdDialog?.result.replace(/_/g, " ")} — {holdDialog?.unit.vinNo}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This vehicle will appear in <strong>Vehicle Stock</strong> as hold stock with your feedback, so it can be tracked for replacement.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Hold category</Label>
              <Select value={holdReason} onValueChange={setHoldReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOLD_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Issue feedback *</Label>
              <Textarea
                value={holdFeedback}
                onChange={(e) => setHoldFeedback(e.target.value)}
                placeholder="Describe defect, DTC, damage, or OEM instruction — needed for replacement / claim"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void submitHold()} disabled={submitting}>
              {submitting ? "Saving…" : "Confirm hold"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
