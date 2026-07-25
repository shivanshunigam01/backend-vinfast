import { useCallback, useEffect, useState } from "react";
import { adminGet, adminPatchJson, adminPostJson, adminPutJson, adminDeleteJson, formatApiErrors } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Car, Search, RefreshCw, Zap, Gauge, Loader2, Plus, Edit2,
  Battery, MapPin, Wrench, BatteryCharging, AlertTriangle, Clock, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { getAdminUser } from "@/lib/adminAuth";

type Vehicle = {
  _id: string;
  vehicleId: string;
  model: string;
  variant: string;
  registrationNo: string;
  vinNo: string;
  color: string;
  batteryPercent: number;
  currentOdometer: number;
  status: string;
  totalTestDriveKM: number;
  totalTestDrives: number;
  isLocked: boolean;
  branchId: { _id: string; name: string; code: string } | null;
  insuranceValidity: string;
  serviceDueDate: string;
  availableAgainAt?: string | null;
};

type Branch = { _id: string; name: string; code: string };

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatAvailableAgain(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function datetimeLocalToIso(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  AVAILABLE: { color: "bg-green-400/10 text-green-400 border-green-400/20", icon: <Car className="w-3 h-3" /> },
  BOOKED: { color: "bg-blue-400/10 text-blue-400 border-blue-400/20", icon: <Car className="w-3 h-3" /> },
  RUNNING: { color: "bg-purple-400/10 text-purple-400 border-purple-400/20", icon: <Gauge className="w-3 h-3" /> },
  CHARGING: { color: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20", icon: <BatteryCharging className="w-3 h-3" /> },
  REPAIR: { color: "bg-red-400/10 text-red-400 border-red-400/20", icon: <Wrench className="w-3 h-3" /> },
  BATTERY_LOW: { color: "bg-orange-400/10 text-orange-400 border-orange-400/20", icon: <Battery className="w-3 h-3" /> },
  SERVICE_DUE: { color: "bg-rose-400/10 text-rose-400 border-rose-400/20", icon: <AlertTriangle className="w-3 h-3" /> },
};

const emptyVehicle = {
  model: "VF 7",
  variant: "Wind",
  registrationNo: "",
  vinNo: "",
  color: "",
  batteryPercent: 100,
  currentOdometer: 0,
  branchId: "",
  availableAgainAt: "",
};

const WEBSITE_COLORS = ["Infinity Blanc", "Crimson Red", "Jet Black", "Desert Silver", "Zenith Grey", "Urban Mint"];

export default function AdminTDDemoVehicles() {
  const { models: catalogModels, trimsFor } = useVehicleCatalog();
  const adminUser = getAdminUser();
  const canDelete = adminUser?.role === "manager" || adminUser?.role === "superadmin";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterModel, setFilterModel] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<typeof emptyVehicle & { _id?: string }>(emptyVehicle);
  const [statusDialog, setStatusDialog] = useState<Vehicle | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [statusBattery, setStatusBattery] = useState("");
  const [statusAvailableAgain, setStatusAvailableAgain] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Always fetch the FULL fleet (no status/model params) so the summary cards
  // show real counts up-front; status/model/search filtering happens client-side.
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [vRes, bRes] = await Promise.all([
        adminGet<Vehicle[]>("/admin/td/vehicles?limit=200"),
        adminGet<Branch[]>("/admin/td/branches/public")
      ]);
      setVehicles(vRes.data ?? []);
      setBranches(bRes.data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const filtered = vehicles.filter((v) => {
    if (filterStatus !== "all" && v.status !== filterStatus) return false;
    if (filterModel !== "all" && v.model !== filterModel) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return v.vehicleId?.toLowerCase().includes(s) || v.registrationNo?.toLowerCase().includes(s) || v.model?.toLowerCase().includes(s) || v.color?.toLowerCase().includes(s);
  });

  const handleSave = async () => {
    setActionLoading(true);
    try {
      const payload = {
        ...form,
        availableAgainAt: datetimeLocalToIso(form.availableAgainAt),
      };
      delete (payload as { _id?: string })._id;

      if (form._id) {
        await adminPutJson(`/admin/td/vehicles/${form._id}`, payload);
        toast.success("Vehicle updated");
      } else {
        await adminPostJson("/admin/td/vehicles", payload);
        toast.success("Vehicle created");
      }
      setShowForm(false);
      void fetchData();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusDialog || !newStatus) return;
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/vehicles/${statusDialog._id}/status`, {
        status: newStatus,
        reason: statusReason,
        battery: statusBattery ? Number(statusBattery) : undefined,
        availableAgainAt:
          newStatus === "AVAILABLE"
            ? null
            : datetimeLocalToIso(statusAvailableAgain),
      });
      toast.success(`Vehicle status → ${newStatus}`);
      setStatusDialog(null);
      void fetchData();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    if (!canDelete) return;
    if (!window.confirm(`Permanently delete ${vehicle.vehicleId} (${vehicle.model})? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await adminDeleteJson(`/admin/td/vehicles/${vehicle._id}`);
      toast.success("Vehicle deleted");
      void fetchData();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const batteryColor = (pct: number) => pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="w-6 h-6 text-primary" /> Demo Fleet
          </h1>
          <p className="text-muted-foreground text-sm">{filtered.length} vehicle(s) · fleet status controls website slot capacity</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void fetchData()} variant="outline" size="sm"><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={() => { setForm(emptyVehicle); setEditVehicle(null); setShowForm(true); }} size="sm" className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Vehicle
          </Button>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20 p-4 text-sm text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-1">Website test drive availability</p>
        Vehicles marked <span className="text-green-400 font-medium">AVAILABLE</span> count toward live booking slots on the test drive page.
        Slot timings and max bookings per slot are set under <span className="text-primary font-medium">TD → Slot Configuration</span>.
        If all demo cars for a model are charging, booked, or in repair, that model&apos;s slots show as unavailable on the website.
      </Card>

      {/* Fleet summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const count = vehicles.filter((v) => v.status === status).length;
          return (
            <button key={status} onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
              className={`rounded-lg border p-3 text-center transition-all ${filterStatus === status ? cfg.color : "bg-secondary/30 border-border/30 text-muted-foreground hover:bg-secondary/50"}`}>
              <div className="flex items-center justify-center gap-1 mb-1">{cfg.icon}<span className="text-[10px] font-semibold uppercase">{status.replace("_", " ")}</span></div>
              <p className="text-xl font-bold">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search vehicle..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-secondary/50" />
        </div>
        <Select value={filterModel} onValueChange={setFilterModel}>
          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Model" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            {catalogModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.keys(STATUS_CONFIG).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Vehicles grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading fleet...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground"><Car className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No vehicles found</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((v) => {
            const cfg = STATUS_CONFIG[v.status] ?? { color: "bg-secondary text-foreground", icon: null };
            return (
              <Card key={v._id} className="bg-card border-border/50 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">{v.vehicleId}</p>
                    <p className="font-semibold text-foreground">{v.model} <span className="text-muted-foreground font-normal">{v.variant}</span></p>
                    <p className="text-xs text-muted-foreground">{v.color} • {v.registrationNo}</p>
                  </div>
                  <Badge className={`text-[10px] border flex items-center gap-1 ${cfg.color}`}>{cfg.icon}{v.status.replace("_", " ")}</Badge>
                </div>

                {/* Battery */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Battery</span>
                    <span className="font-medium text-foreground">{v.batteryPercent}%</span>
                  </div>
                  <Progress value={v.batteryPercent} className="h-1.5" style={{ "--progress-background": batteryColor(v.batteryPercent) } as React.CSSProperties} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /><span>{v.currentOdometer.toLocaleString()} km</span></div>
                  <div className="flex items-center gap-1"><Car className="w-3.5 h-3.5" /><span>{v.totalTestDrives} TDs ({v.totalTestDriveKM} km)</span></div>
                  <div className="flex items-center gap-1 col-span-2"><MapPin className="w-3.5 h-3.5" /><span>{v.branchId?.name ?? "—"}</span></div>
                </div>

                {v.isLocked && <p className="text-[10px] text-yellow-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Temporarily locked</p>}
                {v.status !== "AVAILABLE" && v.availableAgainAt && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Available again: {formatAvailableAgain(v.availableAgainAt)}
                  </p>
                )}

                <div className="flex gap-1.5 border-t border-border/30 pt-3">
                  <Button size="sm" variant="ghost" className="flex-1 text-xs h-8" onClick={() => {
                    setForm({
                      ...emptyVehicle,
                      ...v,
                      branchId: v.branchId?._id ?? "",
                      _id: v._id,
                      availableAgainAt: toDatetimeLocal(v.availableAgainAt),
                    });
                    setEditVehicle(v);
                    setShowForm(true);
                  }}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 text-xs h-8 text-primary" onClick={() => {
                    setStatusDialog(v);
                    setNewStatus(v.status);
                    setStatusReason("");
                    setStatusBattery(String(v.batteryPercent));
                    setStatusAvailableAgain(toDatetimeLocal(v.availableAgainAt));
                  }}>
                    <Gauge className="w-3.5 h-3.5 mr-1" /> Status
                  </Button>
                  {canDelete ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={actionLoading}
                      onClick={() => void handleDeleteVehicle(v)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form._id ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Model</Label>
                <Select value={form.model} onValueChange={(v) => setForm((p) => ({ ...p, model: v, variant: trimsFor(v)[0] ?? "" }))}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {catalogModels.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Variant</Label>
                {trimsFor(form.model).length === 0 ? (
                  <Input value="No variants" disabled className="bg-secondary/50" />
                ) : (
                  <Select value={form.variant} onValueChange={(v) => setForm((p) => ({ ...p, variant: v }))}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select trim" /></SelectTrigger>
                    <SelectContent>
                      {trimsFor(form.model).map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Registration No</Label><Input value={form.registrationNo} onChange={(e) => setForm((p) => ({ ...p, registrationNo: e.target.value }))} className="bg-secondary/50" placeholder="BR01AB1234" /></div>
              <div className="space-y-1.5"><Label className="text-xs">VIN No</Label><Input value={form.vinNo} onChange={(e) => setForm((p) => ({ ...p, vinNo: e.target.value }))} className="bg-secondary/50" /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <Select value={form.color} onValueChange={(v) => setForm((p) => ({ ...p, color: v }))}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select colour" /></SelectTrigger>
                  <SelectContent>
                    {WEBSITE_COLORS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Branch</Label>
                <Select value={form.branchId} onValueChange={(v) => setForm((p) => ({ ...p, branchId: v }))}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>{branches.map((b) => <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Battery %</Label><Input type="number" min={0} max={100} value={form.batteryPercent} onChange={(e) => setForm((p) => ({ ...p, batteryPercent: Number(e.target.value) }))} className="bg-secondary/50" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Odometer (km)</Label><Input type="number" min={0} value={form.currentOdometer} onChange={(e) => setForm((p) => ({ ...p, currentOdometer: Number(e.target.value) }))} className="bg-secondary/50" /></div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Available again (optional)
                </Label>
                <Input
                  type="datetime-local"
                  value={form.availableAgainAt}
                  onChange={(e) => setForm((p) => ({ ...p, availableAgainAt: e.target.value }))}
                  className="bg-secondary/50"
                />
                <p className="text-[10px] text-muted-foreground">
                  When this vehicle is expected back for test drives (e.g. after repair or charging).
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => void handleSave()} disabled={actionLoading} className="flex-1 bg-primary text-primary-foreground">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={!!statusDialog} onOpenChange={(o) => !o && setStatusDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Update Vehicle Status</DialogTitle></DialogHeader>
          {statusDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground"><span className="text-foreground font-mono">{statusDialog.vehicleId}</span> — {statusDialog.model} {statusDialog.variant}</p>
              <div className="space-y-1.5">
                <Label className="text-xs">New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(STATUS_CONFIG).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Battery % (optional)</Label><Input type="number" min={0} max={100} value={statusBattery} onChange={(e) => setStatusBattery(e.target.value)} className="bg-secondary/50" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Reason</Label><Input value={statusReason} onChange={(e) => setStatusReason(e.target.value)} className="bg-secondary/50" placeholder="e.g. Sent for charging" /></div>
              {newStatus !== "AVAILABLE" && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Available again
                  </Label>
                  <Input
                    type="datetime-local"
                    value={statusAvailableAgain}
                    onChange={(e) => setStatusAvailableAgain(e.target.value)}
                    className="bg-secondary/50"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Expected date and time when this vehicle returns to the fleet.
                  </p>
                </div>
              )}
              <div className="flex gap-3">
                <Button onClick={() => void handleStatusUpdate()} disabled={actionLoading} className="flex-1 bg-primary text-primary-foreground">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Update
                </Button>
                <Button onClick={() => setStatusDialog(null)} variant="outline" className="flex-1">Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
