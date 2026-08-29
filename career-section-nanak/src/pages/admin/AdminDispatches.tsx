import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2, Truck } from "lucide-react";
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
import { formatPoLineLabel } from "@/components/admin/PoLineEditorRow";
import PipelineDeleteButton from "@/components/admin/PipelineDeleteButton";
import StockPrintButton from "@/components/admin/StockPrintButton";
import { dataTable } from "@/lib/stockPrint";
import { vendorDisplayName, vendorFromPo } from "@/lib/stockVendorsApi";
import {
  createDispatch,
  deleteDispatch,
  emptyLineTransport,
  fetchDispatches,
  fetchPipelinePurchaseOrders,
  updateDispatch,
  type DispatchRecord,
  type LineTransport,
  type PoLine,
  type PurchaseOrder,
} from "@/lib/stockPipelineApi";

type VinEntry = { key: string; poLineId: string; vin: string; motorNo: string };

function pendingQty(line: PoLine) {
  return Math.max(0, line.qty - (line.dispatchedQty ?? 0));
}

export default function AdminDispatches() {
  const admin = getAdminUser();
  const canUpdate =
    canPerformAction(admin, "stock_dispatch", "update") ||
    canPerformAction(admin, "stock_delivery", "update");
  const canDelete =
    canPerformAction(admin, "stock_dispatch", "delete") ||
    canPerformAction(admin, "stock_delivery", "delete");

  const [rows, setRows] = useState<DispatchRecord[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [poId, setPoId] = useState("");
  const [lineTransport, setLineTransport] = useState<Record<string, LineTransport>>({});
  const [vinEntries, setVinEntries] = useState<VinEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<DispatchRecord | null>(null);
  const [editTransport, setEditTransport] = useState({
    oemInvoiceNumber: "",
    oemInvoiceDate: "",
    transporter: "",
    lrNumber: "",
    truckNumber: "",
    driverName: "",
    driverMobile: "",
  });

  const selectedPo = useMemo(() => pos.find((p) => p._id === poId), [pos, poId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, released, partial] = await Promise.all([
        fetchDispatches(),
        fetchPipelinePurchaseOrders({ status: "RELEASED" }),
        fetchPipelinePurchaseOrders({ status: "PART_SUPPLIED" }),
      ]);
      setRows(d);
      const merged = [...released, ...partial.filter((p) => !released.some((r) => r._id === p._id))];
      setPos(merged);
      if (!poId && merged[0]) setPoId(merged[0]._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedPo) {
      setVinEntries([]);
      setLineTransport({});
      return;
    }
    setVinEntries([]);
    setLineTransport((prev) => {
      const next: Record<string, LineTransport> = {};
      for (const line of selectedPo.lines) {
        if (line._id) next[line._id] = prev[line._id] ?? emptyLineTransport();
      }
      return next;
    });
  }, [selectedPo?._id]);

  const updateLineTransport = (poLineId: string, patch: Partial<LineTransport>) => {
    setLineTransport((prev) => ({
      ...prev,
      [poLineId]: { ...(prev[poLineId] ?? emptyLineTransport()), ...patch },
    }));
  };

  const addVinRow = (line: PoLine) => {
    if (!line._id) return;
    const pending = pendingQty(line);
    const existing = vinEntries.filter((v) => v.poLineId === line._id).length;
    if (existing >= pending) {
      toast.error(`Line already has ${pending} pending VIN slot(s)`);
      return;
    }
    setVinEntries((prev) => [
      ...prev,
      { key: `${line._id}-${Date.now()}`, poLineId: line._id!, vin: "", motorNo: "" },
    ]);
  };

  const submit = async () => {
    if (!poId || !selectedPo) return toast.error("Select a released PO");

    const lineShipments = selectedPo.lines
      .map((line) => {
        if (!line._id) return null;
        const lineVins = vinEntries.filter((v) => v.poLineId === line._id && v.vin.trim());
        if (!lineVins.length) return null;

        const transport = lineTransport[line._id] ?? emptyLineTransport();
        if (!transport.oemInvoiceNumber || !transport.lrNumber || !transport.truckNumber || !transport.transporter) {
          toast.error(`Line ${formatPoLineLabel(line)}: invoice, transporter, LR and truck are required`);
          return "invalid" as const;
        }

        return {
          poLineId: line._id,
          oemInvoiceNumber: transport.oemInvoiceNumber,
          oemInvoiceDate: transport.oemInvoiceDate,
          transporter: transport.transporter,
          lrNumber: transport.lrNumber,
          truckNumber: transport.truckNumber,
          driverName: transport.driverName || undefined,
          driverMobile: transport.driverMobile || undefined,
          items: lineVins.map((v) => ({
            poLineId: line._id!,
            vin: v.vin.trim().toUpperCase(),
            model: line.model,
            variant: line.variant,
            colour: line.colour,
            motorNo: v.motorNo.trim() || undefined,
          })),
        };
      });

    if (lineShipments.some((s) => s === "invalid")) return;
    const shipments = lineShipments.filter((s): s is NonNullable<typeof s> => Boolean(s && s !== "invalid"));
    if (!shipments.length) return toast.error("Enter at least one VIN against a PO line");

    setSaving(true);
    try {
      const result = await createDispatch({
        purchaseOrderId: poId,
        lineShipments: shipments,
      }) as { data?: { dispatches?: DispatchRecord[]; dispatch?: DispatchRecord; stock?: unknown[] } };
      const count = result?.data?.dispatches?.length ?? (result?.data?.dispatch ? 1 : shipments.length);
      const vinCount = shipments.reduce((n, s) => n + s.items.length, 0);
      toast.success(
        count > 1
          ? `${count} line dispatch(es) created with ${vinCount} VIN(s)`
          : `Dispatch created with ${vinCount} VIN(s)`,
      );
      setOpen(false);
      setVinEntries([]);
      setLineTransport({});
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: DispatchRecord) => {
    setEditing(row);
    setEditTransport({
      oemInvoiceNumber: row.oemInvoiceNumber,
      oemInvoiceDate: row.oemInvoiceDate?.slice(0, 10) ?? "",
      transporter: row.transporter,
      lrNumber: row.lrNumber,
      truckNumber: row.truckNumber,
      driverName: (row as DispatchRecord & { driverName?: string }).driverName ?? "",
      driverMobile: (row as DispatchRecord & { driverMobile?: string }).driverMobile ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateDispatch(editing._id, editTransport);
      toast.success(`Dispatch ${editing.dispatchNumber} updated`);
      setEditOpen(false);
      setEditing(null);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="h-6 w-6" /> Dispatch & Transit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dispatch VINs per PO line — each line can have its own truck, driver and OEM invoice
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> New Dispatch</Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground border-dashed">No dispatches yet.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r._id} className="p-4 space-y-3">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <p className="font-medium">{r.dispatchNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    Vendor: {typeof r.purchaseOrderId === "object" ? vendorDisplayName(vendorFromPo(r.purchaseOrderId)) : "VinFast"} · PO: {r.poNumber} · Invoice: {r.oemInvoiceNumber} · Truck: {r.truckNumber}
                  </p>
                </div>
                <Badge>{r.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <StockPrintButton
                  getPrintOptions={() => ({
                    title: "Dispatch & Transit",
                    documentNo: r.dispatchNumber,
                    vendor: typeof r.purchaseOrderId === "object" ? vendorFromPo(r.purchaseOrderId) : { name: "VinFast" },
                    meta: [
                      { label: "PO", value: r.poNumber || "—" },
                      { label: "Status", value: r.status },
                      { label: "OEM Invoice", value: r.oemInvoiceNumber },
                      { label: "Transporter", value: r.transporter },
                      { label: "LR Number", value: r.lrNumber },
                      { label: "Truck", value: r.truckNumber },
                    ],
                    bodyHtml: dataTable(
                      ["VIN", "PO line", "Match"],
                      (r.items ?? []).map((item) => [item.vin, formatPoLineLabel(item), item.configMatch ?? "—"]),
                    ),
                  })}
                />
                {canUpdate && r.status === "IN_TRANSIT" ? (
                  <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                ) : null}
                {canDelete ? (
                  <PipelineDeleteButton
                    label="Delete"
                    title={`Delete ${r.dispatchNumber}?`}
                    description="Removes dispatch and in-transit VINs. Blocked if gate entry exists."
                    onConfirm={async () => {
                      try {
                        await deleteDispatch(r._id);
                        toast.success(`Dispatch ${r.dispatchNumber} deleted`);
                        void load();
                      } catch (e) {
                        toast.error(formatApiErrors(e));
                        throw e;
                      }
                    }}
                  />
                ) : null}
              </div>
              {r.items?.length ? (
                <div className="overflow-x-auto rounded border border-border/40">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground bg-secondary/30 text-left">
                        <th className="p-2">VIN</th>
                        <th className="p-2">PO line</th>
                        <th className="p-2">Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.items.map((item, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="p-2 font-mono">{item.vin}</td>
                          <td className="p-2">
                            {formatPoLineLabel(item)}
                          </td>
                          <td className="p-2">{item.configMatch ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create dispatch from PO lines</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Each PO line gets its own truck, driver and invoice — add VINs and transport details per line.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Purchase order *</Label>
              <Select value={poId} onValueChange={setPoId}>
                <SelectTrigger><SelectValue placeholder="Select released PO" /></SelectTrigger>
                <SelectContent>
                  {pos.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.poNumber} · {p.lines.length} line(s) · {p.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPo ? (
              <div className="space-y-3 rounded-lg border border-border/50 p-3 bg-secondary/10">
                <p className="text-xs font-semibold text-muted-foreground uppercase">PO lines — VIN + transport per line</p>
                {selectedPo.lines.map((line, index) => {
                  const pending = pendingQty(line);
                  const lineVins = vinEntries.filter((v) => v.poLineId === line._id);
                  const transport = line._id ? (lineTransport[line._id] ?? emptyLineTransport()) : emptyLineTransport();
                  return (
                    <div key={line._id || index} className="rounded-md border border-border/40 bg-background/80 p-3 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">Line {index + 1}: {formatPoLineLabel(line)}</p>
                          <p className="text-xs text-muted-foreground">
                            Ordered {line.qty} · Dispatched {line.dispatchedQty ?? 0} · Pending {pending}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!line._id || pending <= 0}
                          onClick={() => addVinRow(line)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add VIN
                        </Button>
                      </div>

                      {line._id && (pending > 0 || lineVins.length > 0) ? (
                        <div className="rounded border border-dashed border-border/50 p-3 space-y-2 bg-secondary/5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">
                            Transport for this line (truck / driver / invoice)
                          </p>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {(
                              [
                                ["oemInvoiceNumber", "OEM Invoice No. *"],
                                ["oemInvoiceDate", "OEM Invoice Date *"],
                                ["transporter", "Transporter *"],
                                ["lrNumber", "LR Number *"],
                                ["truckNumber", "Truck Number *"],
                                ["driverName", "Driver Name"],
                                ["driverMobile", "Driver Mobile"],
                              ] as const
                            ).map(([key, label]) => (
                              <div key={key}>
                                <Label className="text-xs">{label}</Label>
                                <Input
                                  type={key === "oemInvoiceDate" ? "date" : "text"}
                                  value={transport[key]}
                                  onChange={(e) => updateLineTransport(line._id!, { [key]: e.target.value })}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {lineVins.map((entry) => (
                        <div key={entry.key} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                          <div>
                            <Label className="text-xs">VIN *</Label>
                            <Input
                              value={entry.vin}
                              onChange={(e) =>
                                setVinEntries((prev) =>
                                  prev.map((v) => (v.key === entry.key ? { ...v, vin: e.target.value.toUpperCase() } : v)),
                                )
                              }
                              className="font-mono uppercase"
                              placeholder="VIN for this line"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Motor no.</Label>
                            <Input
                              value={entry.motorNo}
                              onChange={(e) =>
                                setVinEntries((prev) =>
                                  prev.map((v) => (v.key === entry.key ? { ...v, motorNo: e.target.value.toUpperCase() } : v)),
                                )
                              }
                              className="font-mono uppercase"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => setVinEntries((prev) => prev.filter((v) => v.key !== entry.key))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving
                ? "Creating…"
                : (() => {
                    const vinCount = vinEntries.filter((v) => v.vin.trim()).length;
                    const lineCount = new Set(
                      vinEntries.filter((v) => v.vin.trim()).map((v) => v.poLineId),
                    ).size;
                    return lineCount > 1
                      ? `Create ${lineCount} dispatches (${vinCount} VINs)`
                      : `Create dispatch (${vinCount} VINs)`;
                  })()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit dispatch {editing?.dispatchNumber}</DialogTitle>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            {(
              [
                ["oemInvoiceNumber", "OEM Invoice No."],
                ["oemInvoiceDate", "OEM Invoice Date"],
                ["transporter", "Transporter"],
                ["lrNumber", "LR Number"],
                ["truckNumber", "Truck Number"],
                ["driverName", "Driver Name"],
                ["driverMobile", "Driver Mobile"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input
                  type={key === "oemInvoiceDate" ? "date" : "text"}
                  value={editTransport[key]}
                  onChange={(e) => setEditTransport({ ...editTransport, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
