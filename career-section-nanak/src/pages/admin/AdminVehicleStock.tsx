import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Warehouse, Plus, RefreshCw, Search, Loader2, Pencil, Trash2,
  BatteryCharging, MapPin, Car, Gauge, CheckCircle2, CalendarDays,
} from "lucide-react";
import { adminGet, adminPostJson, adminPatchJson, adminRequest, formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformManagerAction } from "@/lib/adminAuth";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import {
  exteriorColoursForModel,
  interiorColoursFor,
  needsDualMotorNumbers,
} from "@/data/stockColourOptions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StockItem = {
  _id: string;
  stockId: string;
  model: string;
  variant: string | null;
  colour: string | null;
  interiorColour: string | null;
  vinNo: string;
  registrationNo: string | null;
  motorNo: string | null;
  motorNo2: string | null;
  grnDate: string | null;
  billingDate: string | null;
  batteryPercent: number | null;
  batteryStatus: string;
  location: string | null;
  status: string;
  isDemo: boolean;
  demoVehicleId: { _id: string; vehicleId: string; status: string } | string | null;
  branchId: { _id: string; name: string; code?: string } | string | null;
  remarks: string | null;
  createdAt?: string;
};

const STOCK_STATUSES = ["FRESH_STOCK", "DEMO", "RESERVED", "SOLD", "IN_TRANSIT"] as const;
const BATTERY_STATUSES = ["OK", "CHARGING", "LOW", "FAULT"] as const;

const STATUS_COLORS: Record<string, string> = {
  FRESH_STOCK: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  DEMO: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  RESERVED: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  SOLD: "bg-muted text-muted-foreground border-border",
  IN_TRANSIT: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30",
};

const emptyForm = () => ({
  model: "",
  variant: "",
  colour: "",
  interiorColour: "",
  vinNo: "",
  registrationNo: "",
  motorNo: "",
  motorNo2: "",
  grnDate: "",
  billingDate: "",
  batteryPercent: "100",
  batteryStatus: "OK",
  location: "",
  status: "FRESH_STOCK",
  remarks: "",
});

function dateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function AdminVehicleStock() {
  const adminUser = getAdminUser();
  const canCreate = canPerformManagerAction(adminUser, "vehicle_stock", "create");
  const canUpdate = canPerformManagerAction(adminUser, "vehicle_stock", "update");
  const canDelete = canPerformManagerAction(adminUser, "vehicle_stock", "delete");
  const canTagDemo = canPerformManagerAction(adminUser, "vehicle_stock", "tag_demo");
  const { models: catalogModels, trimsFor } = useVehicleCatalog();

  const [items, setItems] = useState<StockItem[]>([]);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterModel, setFilterModel] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const [demoBusyId, setDemoBusyId] = useState<string | null>(null);

  const exteriorOptions = useMemo(() => {
    const base = exteriorColoursForModel(form.model);
    if (form.colour && !base.includes(form.colour)) return [form.colour, ...base];
    return base;
  }, [form.model, form.colour]);
  const interiorOptions = useMemo(() => {
    const base = interiorColoursFor(form.model, form.variant);
    if (form.interiorColour && !base.includes(form.interiorColour)) return [form.interiorColour, ...base];
    return base;
  }, [form.model, form.variant, form.interiorColour]);
  const dualMotors = needsDualMotorNumbers(form.model, form.variant);

  const applyModelChange = (model: string) => {
    const nextVariant = trimsFor(model)[0] ?? "";
    const nextInterior = interiorColoursFor(model, nextVariant)[0] ?? "";
    setForm((f) => ({
      ...f,
      model,
      variant: nextVariant,
      colour: "",
      interiorColour: nextInterior,
      motorNo2: needsDualMotorNumbers(model, nextVariant) ? f.motorNo2 : "",
    }));
  };

  const applyVariantChange = (variant: string) => {
    const nextInteriorOptions = interiorColoursFor(form.model, variant);
    setForm((f) => ({
      ...f,
      variant,
      interiorColour: nextInteriorOptions.includes(f.interiorColour)
        ? f.interiorColour
        : (nextInteriorOptions[0] ?? ""),
      motorNo2: needsDualMotorNumbers(f.model, variant) ? f.motorNo2 : "",
    }));
  };

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ limit: "200" });
      if (search.trim()) q.set("search", search.trim());
      if (filterStatus !== "all") q.set("status", filterStatus);
      if (filterModel !== "all") q.set("model", filterModel);
      const res = await adminGet<StockItem[]>(`/admin/stock/vehicles?${q}`);
      setItems(Array.isArray(res.data) ? res.data : []);
      setByStatus(((res.meta as { byStatus?: Record<string, number> } | undefined)?.byStatus) ?? {});
    } catch (e) {
      toast.error(formatApiErrors(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterModel]);

  useEffect(() => {
    const t = setTimeout(() => void fetchStock(), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchStock, search]);

  const openCreate = () => {
    setEditing(null);
    const model = catalogModels[0] ?? "";
    const variant = trimsFor(model)[0] ?? "";
    setForm({
      ...emptyForm(),
      model,
      variant,
      interiorColour: interiorColoursFor(model, variant)[0] ?? "",
    });
    setShowForm(true);
  };

  const openEdit = (item: StockItem) => {
    setEditing(item);
    const interiorOpts = interiorColoursFor(item.model, item.variant ?? "");
    setForm({
      model: item.model,
      variant: item.variant ?? "",
      colour: item.colour ?? "",
      interiorColour: item.interiorColour && interiorOpts.includes(item.interiorColour)
        ? item.interiorColour
        : (interiorOpts[0] ?? ""),
      vinNo: item.vinNo,
      registrationNo: item.registrationNo ?? "",
      motorNo: item.motorNo ?? "",
      motorNo2: item.motorNo2 ?? "",
      grnDate: dateInputValue(item.grnDate),
      billingDate: dateInputValue(item.billingDate),
      batteryPercent: item.batteryPercent != null ? String(item.batteryPercent) : "100",
      batteryStatus: item.batteryStatus || "OK",
      location: item.location ?? "",
      status: item.status,
      remarks: item.remarks ?? "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.model) { toast.error("Select a model"); return; }
    if (!form.vinNo.trim()) { toast.error("VIN/chassis number is required"); return; }
    const dual = needsDualMotorNumbers(form.model, form.variant);
    const payload = {
      model: form.model,
      variant: form.variant || undefined,
      colour: form.colour || undefined,
      interiorColour: form.interiorColour || undefined,
      vinNo: form.vinNo.trim().toUpperCase(),
      registrationNo: form.registrationNo.trim().toUpperCase() || undefined,
      motorNo: form.motorNo.trim().toUpperCase() || undefined,
      motorNo2: dual ? form.motorNo2.trim().toUpperCase() : "",
      grnDate: form.grnDate || "",
      billingDate: form.billingDate || "",
      batteryPercent: Number(form.batteryPercent) || 0,
      batteryStatus: form.batteryStatus,
      location: form.location.trim() || undefined,
      status: form.status,
      remarks: form.remarks.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editing) {
        await adminPatchJson(`/admin/stock/vehicles/${editing._id}`, payload);
        toast.success(`Stock ${editing.stockId} updated`);
      } else {
        await adminPostJson("/admin/stock/vehicles", payload);
        toast.success("Vehicle added to stock");
      }
      setShowForm(false);
      void fetchStock();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTagDemo = async (item: StockItem, demo: boolean) => {
    setDemoBusyId(item._id);
    try {
      await adminPatchJson(`/admin/stock/vehicles/${item._id}/demo`, { demo });
      toast.success(
        demo
          ? `${item.stockId} tagged as demo — now available in the test drive module`
          : `${item.stockId} returned to fresh stock`,
      );
      void fetchStock();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setDemoBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { res, json } = await adminRequest(`/admin/stock/vehicles/${deleteTarget._id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(json.message ?? "Could not delete stock entry"));
      toast.success(`Stock ${deleteTarget.stockId} deleted`);
      setDeleteTarget(null);
      void fetchStock();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-primary" /> Vehicle Stock
          </h1>
          <p className="text-muted-foreground text-sm">
            Stock register — tag a unit as demo to make it available for test drives.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={() => void fetchStock()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          {canCreate ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Add vehicle
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {STOCK_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left transition-colors",
              filterStatus === s ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20 hover:bg-secondary/40",
            )}
          >
            <p className="text-lg font-bold text-foreground leading-tight">{byStatus[s] ?? 0}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.replace("_", " ")}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search stock ID / VIN / motor / registration…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>
        <Select value={filterModel} onValueChange={setFilterModel}>
          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Model" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {catalogModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STOCK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No stock entries found.</p>
          {canCreate ? (
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Add vehicle
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item._id} className="p-4 space-y-3 bg-card border-border/50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-mono">{item.stockId}</p>
                  <p className="font-semibold text-foreground truncate">
                    {item.model}{item.variant ? ` ${item.variant}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[item.colour, item.interiorColour].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge className={`text-[10px] border ${STATUS_COLORS[item.status] ?? "bg-secondary"}`}>
                    {item.status.replace("_", " ")}
                  </Badge>
                  {item.isDemo ? (
                    <Badge className="text-[10px] border bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">
                      <Gauge className="w-3 h-3 mr-1" /> DEMO
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/30 pt-3">
                <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                  <Car className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-mono truncate" title={item.vinNo}>{item.vinNo}</span>
                </div>
                {(item.motorNo || item.motorNo2) ? (
                  <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                    <Gauge className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono truncate" title={[item.motorNo, item.motorNo2].filter(Boolean).join(" / ")}>
                      Motor {[item.motorNo, item.motorNo2].filter(Boolean).join(" / ")}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.registrationNo || "Unregistered"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <BatteryCharging className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.batteryPercent ?? "—"}% · {item.batteryStatus}</span>
                </div>
                {(item.grnDate || item.billingDate) ? (
                  <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                    <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {[
                        item.grnDate ? `GRN ${item.grnDate}` : null,
                        item.billingDate ? `Bill ${item.billingDate}` : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.location || "—"}</span>
                </div>
              </div>

              {canTagDemo || canUpdate || canDelete ? (
                <div className="flex gap-2 border-t border-border/30 pt-3">
                  {canTagDemo ? (
                    item.isDemo ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-8"
                        disabled={demoBusyId === item._id}
                        onClick={() => void handleTagDemo(item, false)}
                      >
                        {demoBusyId === item._id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Gauge className="w-3.5 h-3.5 mr-1" />}
                        Untag demo
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-8"
                        disabled={demoBusyId === item._id || item.status === "SOLD"}
                        onClick={() => void handleTagDemo(item, true)}
                      >
                        {demoBusyId === item._id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Gauge className="w-3.5 h-3.5 mr-1" />}
                        Tag as demo
                      </Button>
                    )
                  ) : null}
                  {canUpdate ? (
                    <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => openEdit(item)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  ) : null}
                  {canDelete && !item.isDemo ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? `Edit stock — ${editing.stockId}` : "Add vehicle to stock"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Model *</Label>
                <Select
                  value={form.model || undefined}
                  onValueChange={applyModelChange}
                >
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>
                    {catalogModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Variant</Label>
                {trimsFor(form.model).length === 0 ? (
                  <Input value="Single lineup" disabled className="bg-secondary/50" />
                ) : (
                  <Select value={form.variant || undefined} onValueChange={applyVariantChange}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select variant" /></SelectTrigger>
                    <SelectContent>
                      {trimsFor(form.model).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Exterior Colour</Label>
                <Select
                  value={form.colour || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, colour: v }))}
                  disabled={exteriorOptions.length === 0}
                >
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select colour" /></SelectTrigger>
                  <SelectContent>
                    {exteriorOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Interior Colour</Label>
                <Select
                  value={form.interiorColour || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, interiorColour: v }))}
                  disabled={interiorOptions.length === 0}
                >
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select interior" /></SelectTrigger>
                  <SelectContent>
                    {interiorOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">VIN / chassis no. *</Label>
                <Input
                  value={form.vinNo}
                  onChange={(e) => setForm((f) => ({ ...f, vinNo: e.target.value.toUpperCase() }))}
                  className="bg-secondary/50 uppercase font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{dualMotors ? "Motor No. 1" : "Motor No."}</Label>
                <Input
                  value={form.motorNo}
                  onChange={(e) => setForm((f) => ({ ...f, motorNo: e.target.value.toUpperCase() }))}
                  className="bg-secondary/50 uppercase font-mono"
                  placeholder="Motor number"
                />
              </div>
              {dualMotors ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Motor No. 2</Label>
                  <Input
                    value={form.motorNo2}
                    onChange={(e) => setForm((f) => ({ ...f, motorNo2: e.target.value.toUpperCase() }))}
                    className="bg-secondary/50 uppercase font-mono"
                    placeholder="Second motor (Sky Infinity)"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label className="text-xs">Registration no. (if available)</Label>
                <Input
                  value={form.registrationNo}
                  onChange={(e) => setForm((f) => ({ ...f, registrationNo: e.target.value.toUpperCase() }))}
                  className="bg-secondary/50 uppercase"
                  placeholder="e.g. BR01AB1234"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GRN Date</Label>
                <Input
                  type="date"
                  value={form.grnDate}
                  onChange={(e) => setForm((f) => ({ ...f, grnDate: e.target.value }))}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Billing Date</Label>
                <Input
                  type="date"
                  value={form.billingDate}
                  onChange={(e) => setForm((f) => ({ ...f, billingDate: e.target.value }))}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="bg-secondary/50"
                  placeholder="e.g. Patna Showroom / Yard"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Battery %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.batteryPercent}
                  onChange={(e) => setForm((f) => ({ ...f, batteryPercent: e.target.value }))}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Battery status</Label>
                <Select value={form.batteryStatus} onValueChange={(v) => setForm((f) => ({ ...f, batteryStatus: v }))}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BATTERY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Stock status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  disabled={Boolean(editing?.isDemo)}
                >
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STOCK_STATUSES.filter((s) => s !== "DEMO" || editing?.isDemo).map((s) => (
                      <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editing?.isDemo ? (
                  <p className="text-[10px] text-muted-foreground">Untag the demo vehicle to change the stock status.</p>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Remarks</Label>
              <Textarea value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} rows={2} className="bg-secondary/50" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {editing ? "Save changes" : "Add to stock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Delete stock entry?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget ? `${deleteTarget.stockId} · ${deleteTarget.model} · VIN ${deleteTarget.vinNo}` : ""}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
