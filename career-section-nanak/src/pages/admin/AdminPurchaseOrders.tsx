import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { exteriorColoursFor } from "@/data/stockColourOptions";
import PoLineEditorRow, { emptyPoLineDraft, formatPoLineLabel, type PoLineDraft } from "@/components/admin/PoLineEditorRow";
import PipelineDeleteButton from "@/components/admin/PipelineDeleteButton";
import StockPrintButton from "@/components/admin/StockPrintButton";
import { dataTable, escapeHtml } from "@/lib/stockPrint";
import { fetchVendors, pickDefaultVendor, vendorDisplayName, vendorFromPo, type Vendor } from "@/lib/stockVendorsApi";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  deletePurchaseOrder,
  createPipelinePurchaseOrder,
  fetchPipelinePurchaseOrders,
  rejectPurchaseOrder,
  releasePurchaseOrder,
  submitPurchaseOrder,
  updatePipelinePurchaseOrder,
  type PurchaseOrder,
} from "@/lib/stockPipelineApi";

function poToLineDrafts(po: PurchaseOrder): PoLineDraft[] {
  return po.lines.map((l) => ({
    key: l._id || `${l.model}-${l.variant}-${l.colour}-${Math.random().toString(36).slice(2, 6)}`,
    model: l.model,
    variant: l.variant ?? "",
    colour: l.colour ?? "",
    qty: String(l.qty),
    basicPrice: l.basicPrice != null ? String(l.basicPrice) : "",
  }));
}

function openCreateLines(catalogModels: string[], trimsFor: (m: string) => string[]): PoLineDraft[] {
  const model = catalogModels[0] ?? "";
  const variant = trimsFor(model)[0] ?? "";
  return [emptyPoLineDraft(model, variant, exteriorColoursFor(model, variant)[0] ?? "")];
}

function PoVendorBanner({
  vendor,
}: {
  vendor: { name?: string; legalName?: string; gstin?: string };
}) {
  const display = vendor.legalName || vendor.name || "VinFast";
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Procurement vendor (from Vendor Master)
      </p>
      <p className="text-base font-semibold mt-0.5">{display}</p>
      {vendor.name && vendor.legalName && vendor.legalName !== vendor.name ? (
        <p className="text-xs text-muted-foreground">{vendor.name}</p>
      ) : null}
      {vendor.gstin ? (
        <p className="text-xs text-muted-foreground mt-1">GSTIN: {vendor.gstin}</p>
      ) : null}
    </div>
  );
}

function poPrintBodyHtml(po: PurchaseOrder) {
  const vendor = vendorFromPo(po);
  const vendorLabel = vendor.legalName || vendor.name || "VinFast";
  return `
    <p style="margin:0 0 14px;font-size:13px;line-height:1.5;">
      This purchase order is raised to <strong>${escapeHtml(vendorLabel)}</strong>
      for procurement of the following vehicle line(s):
    </p>
    ${dataTable(
      ["#", "Model line", "Qty", "Dispatched", "Received", "Basic price"],
      po.lines.map((l, i) => [
        String(i + 1),
        formatPoLineLabel(l),
        String(l.qty),
        String(l.dispatchedQty ?? 0),
        String(l.receivedQty ?? 0),
        l.basicPrice ? `₹${l.basicPrice.toLocaleString()}` : "—",
      ]),
    )}
  `;
}

export default function AdminPurchaseOrders() {
  const admin = getAdminUser();
  const canCreatePo =
    canPerformAction(admin, "stock_po", "create") ||
    canPerformAction(admin, "stock_delivery", "create");
  const canSubmitPo =
    canPerformAction(admin, "stock_po", "update") ||
    canPerformAction(admin, "stock_delivery", "update");
  const canApprovePo = canPerformAction(admin, "stock_po", "approve");
  const canReleasePo =
    canPerformAction(admin, "stock_po", "update") ||
    canPerformAction(admin, "stock_delivery", "update");
  const canDeletePo =
    canPerformAction(admin, "stock_po", "delete") ||
    canPerformAction(admin, "stock_delivery", "delete");

  const editablePoStatuses = new Set(["DRAFT", "SUBMITTED", "REJECTED"]);

  const { models: catalogModels, trimsFor } = useVehicleCatalog();

  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [lines, setLines] = useState<PoLineDraft[]>([]);
  const [poType, setPoType] = useState("Regular");
  const [paymentTerms, setPaymentTerms] = useState("Advance");
  const [supplierId, setSupplierId] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v._id === supplierId) ?? vendors[0],
    [vendors, supplierId],
  );

  const loadVendors = useCallback(async () => {
    try {
      const list = await fetchVendors();
      setVendors(list);
      const defaultVendor = pickDefaultVendor(list);
      if (defaultVendor && !supplierId) setSupplierId(defaultVendor._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  }, [supplierId]);

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

  useEffect(() => {
    void load();
    void loadVendors();
  }, [load, loadVendors]);

  const openCreateDialog = () => {
    setEditingPo(null);
    setPoType("Regular");
    const defaultVendor = pickDefaultVendor(vendors);
    setPaymentTerms(defaultVendor?.paymentTermsDefault || "Advance");
    setSupplierId(defaultVendor?._id || vendors[0]?._id || "");
    setLines(openCreateLines(catalogModels, trimsFor));
    setFormOpen(true);
  };

  const openEditDialog = (po: PurchaseOrder) => {
    setEditingPo(po);
    setPoType(po.poType || "Regular");
    setPaymentTerms(po.paymentTerms || "Advance");
    const vendorId =
      typeof po.supplierId === "object" && po.supplierId?._id
        ? po.supplierId._id
        : typeof po.supplierId === "string"
          ? po.supplierId
          : vendors.find((v) => v.name === po.supplier)?._id || vendors[0]?._id || "";
    setSupplierId(vendorId);
    const drafts = poToLineDrafts(po);
    setLines(drafts.length ? drafts : openCreateLines(catalogModels, trimsFor));
    setFormOpen(true);
  };

  const closeFormDialog = () => {
    setFormOpen(false);
    setEditingPo(null);
  };

  const buildPayloadLines = () =>
    lines
      .filter((l) => l.model.trim())
      .map((l) => ({
        ...( /^[a-f0-9]{24}$/i.test(l.key) ? { _id: l.key } : {}),
        model: l.model.trim(),
        variant: l.variant.trim() || undefined,
        colour: l.colour.trim() || undefined,
        qty: Math.max(1, Number(l.qty) || 1),
        basicPrice: Number(l.basicPrice) || 0,
        modelYear: new Date().getFullYear(),
      }));

  const onCreate = async () => {
    const payloadLines = buildPayloadLines();
    if (!payloadLines.length) return toast.error("Add at least one PO line with a model");
    setSaving(true);
    try {
      await createPipelinePurchaseOrder({
        poType,
        paymentTerms,
        supplierId: supplierId || undefined,
        supplier: selectedVendor?.name,
        bookingLinked: false,
        lines: payloadLines,
      });
      toast.success(`Purchase order created with ${payloadLines.length} line(s)`);
      closeFormDialog();
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const onSaveEdit = async () => {
    if (!editingPo) return;
    const payloadLines = buildPayloadLines();
    if (!payloadLines.length) return toast.error("Add at least one PO line with a model");
    setSaving(true);
    try {
      await updatePipelinePurchaseOrder(editingPo._id, {
        poType,
        paymentTerms,
        supplierId: supplierId || undefined,
        supplier: selectedVendor?.name,
        lines: payloadLines,
      });
      toast.success(`PO ${editingPo.poNumber} updated`);
      closeFormDialog();
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const updateLine = (key: string, next: PoLineDraft) => {
    setLines((prev) => prev.map((l) => (l.key === key ? next : l)));
  };

  const addLine = () => {
    const model = catalogModels[0] ?? "";
    const variant = trimsFor(model)[0] ?? "";
    setLines((prev) => [...prev, emptyPoLineDraft(model, variant, exteriorColoursFor(model, variant)[0] ?? "")]);
  };

  const canEditPo = canSubmitPo;

  const lineSummary = useMemo(
    () => (po: PurchaseOrder) => po.lines.map((l) => formatPoLineLabel(l)).join(" | "),
    [],
  );

  const pendingApproval = rows.filter((po) => po.status === "SUBMITTED").length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Purchase Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            One PO can include multiple model lines — each line is model + variant + colour + qty
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {canCreatePo ? (
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" /> New PO
            </Button>
          ) : null}
        </div>
      </div>

      {canApprovePo && pendingApproval > 0 ? (
        <Card className="p-3 border-amber-500/40 bg-amber-500/5 text-sm">
          <strong>{pendingApproval}</strong> PO(s) awaiting your approval (SUBMITTED).
        </Card>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground border-dashed">No purchase orders yet.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((po) => (
            <Card key={po._id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono font-semibold">{po.poNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Vendor: {vendorDisplayName(typeof po.supplierId === "object" ? po.supplierId : po.supplier)} · {po.poType || "Regular"} · {po.paymentTerms || "Advance"} · {po.lines.length} line(s)
                  </p>
                </div>
                <Badge variant={po.status === "SUBMITTED" ? "default" : "secondary"}>{po.status}</Badge>
              </div>
              <PoVendorBanner vendor={vendorFromPo(po)} />
              <div className="overflow-x-auto rounded-md border border-border/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground bg-secondary/30">
                      <th className="p-2 font-medium">#</th>
                      <th className="p-2 font-medium">Model line</th>
                      <th className="p-2 font-medium">Qty</th>
                      <th className="p-2 font-medium">Dispatched</th>
                      <th className="p-2 font-medium">Received</th>
                      <th className="p-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.lines.map((l, i) => (
                      <tr key={l._id || i} className="border-t border-border/30">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-medium">{formatPoLineLabel(l)}</td>
                        <td className="p-2">{l.qty}</td>
                        <td className="p-2">{l.dispatchedQty ?? 0} / {l.qty}</td>
                        <td className="p-2">{l.receivedQty ?? 0} / {l.qty}</td>
                        <td className="p-2">{l.netPurchaseValue ? `₹${l.netPurchaseValue.toLocaleString()}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground truncate" title={lineSummary(po)}>
                {lineSummary(po)}
              </p>
              {po.approvalHistory?.length ? (
                <ul className="text-xs text-muted-foreground border-t border-border/40 pt-2 space-y-0.5">
                  {po.approvalHistory.map((h, i) => (
                    <li key={i}>
                      {h.action} → {h.status}
                      {h.byName ? ` by ${h.byName}` : ""}
                      {h.at ? ` · ${new Date(h.at).toLocaleString()}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <StockPrintButton
                  getPrintOptions={() => ({
                    title: "Purchase Order",
                    documentNo: po.poNumber,
                    vendor: vendorFromPo(po),
                    meta: [
                      {
                        label: "Vendor / OEM",
                        value: vendorFromPo(po).legalName || vendorFromPo(po).name || "VinFast",
                      },
                      { label: "Status", value: po.status },
                      { label: "PO Type", value: po.poType || "Regular" },
                      { label: "Payment Terms", value: po.paymentTerms || "Advance" },
                      { label: "Lines", value: String(po.lines.length) },
                    ],
                    bodyHtml: poPrintBodyHtml(po),
                  })}
                />
                {canEditPo && editablePoStatuses.has(po.status) ? (
                  <Button size="sm" variant="outline" onClick={() => openEditDialog(po)}>
                    <Pencil className="h-4 w-4 mr-1" /> Edit
                  </Button>
                ) : null}
                {canDeletePo && po.status === "DRAFT" ? (
                  <PipelineDeleteButton
                    label="Delete"
                    title={`Delete ${po.poNumber}?`}
                    description="Only draft POs with no dispatches can be deleted."
                    onConfirm={async () => {
                      try {
                        await deletePurchaseOrder(po._id);
                        toast.success(`PO ${po.poNumber} deleted`);
                        void load();
                      } catch (e) {
                        toast.error(formatApiErrors(e));
                        throw e;
                      }
                    }}
                  />
                ) : null}
                {canSubmitPo && po.status === "DRAFT" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await submitPurchaseOrder(po._id);
                        toast.success("Submitted for GM / leadership approval");
                        void load();
                      } catch (e) {
                        toast.error(formatApiErrors(e));
                      }
                    }}
                  >
                    Submit for approval
                  </Button>
                ) : null}
                {canApprovePo && po.status === "SUBMITTED" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await approvePurchaseOrder(po._id);
                          toast.success("PO approved");
                          void load();
                        } catch (e) {
                          toast.error(formatApiErrors(e));
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        try {
                          await rejectPurchaseOrder(po._id);
                          toast.success("PO rejected");
                          void load();
                        } catch (e) {
                          toast.error(formatApiErrors(e));
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
                {canReleasePo && po.status === "APPROVED" ? (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await releasePurchaseOrder(po._id);
                        toast.success("PO released — ready for dispatch");
                        void load();
                      } catch (e) {
                        toast.error(formatApiErrors(e));
                      }
                    }}
                  >
                    Release PO
                  </Button>
                ) : null}
                {canSubmitPo && (po.status === "DRAFT" || po.status === "APPROVED") ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/40"
                    onClick={async () => {
                      try {
                        await cancelPurchaseOrder(po._id);
                        toast.success("PO cancelled");
                        void load();
                      } catch (e) {
                        toast.error(formatApiErrors(e));
                      }
                    }}
                  >
                    Cancel PO
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeFormDialog();
          else setFormOpen(true);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPo ? `Edit ${editingPo.poNumber}` : "New purchase order"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label>Vendor / Company (OEM)</Label>
              <Select
                value={supplierId}
                onValueChange={(id) => {
                  setSupplierId(id);
                  const v = vendors.find((x) => x._id === id);
                  if (v?.paymentTermsDefault) setPaymentTerms(v.paymentTermsDefault);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.name}{v.legalName ? ` — ${v.legalName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select OEM vendor — VinFast is default from Vendor Master
              </p>
              {selectedVendor ? (
                <div className="mt-3">
                  <PoVendorBanner
                    vendor={{
                      name: selectedVendor.name,
                      legalName: selectedVendor.legalName,
                      gstin: selectedVendor.gstin,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>PO Type</Label>
                <Select value={poType} onValueChange={setPoType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Regular", "Additional", "Demo", "Test Drive", "Replacement"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Advance", "Credit", "Inventory Funding", "Other"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">PO lines (model-wise)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" /> Add line
                </Button>
              </div>
              {lines.map((line, index) => (
                <PoLineEditorRow
                  key={line.key}
                  index={index}
                  line={line}
                  catalogModels={catalogModels}
                  trimsFor={trimsFor}
                  onChange={(next) => updateLine(line.key, next)}
                  onRemove={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  removable={lines.length > 1}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeFormDialog}>Cancel</Button>
            {editingPo ? (
              <Button
                disabled={saving || !lines.some((l) => l.model.trim())}
                onClick={() => void onSaveEdit()}
              >
                Save changes ({lines.filter((l) => l.model.trim()).length} lines)
              </Button>
            ) : (
              <Button
                disabled={saving || !lines.some((l) => l.model.trim())}
                onClick={() => void onCreate()}
              >
                Create PO ({lines.filter((l) => l.model.trim()).length} lines)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
