import { useCallback, useEffect, useMemo, useState } from "react";
import { adminGet, adminPostJson, formatApiErrors } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Clock, RefreshCw, Loader2, Save, Calendar,
  Ban, CheckCircle2, Search, Zap, Car, Plus, Trash2, Wand2
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_SLOT_SCHEDULE,
  formatTime12h,
  generateSlotTimesFromRules,
  normalizeSlotTimesList,
} from "@/lib/tdSlotSchedule";
import { TdSlotGrid, type TdSlotGridItem } from "@/components/TdSlotGrid";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";

type Branch = { _id: string; name: string; code: string };
type SlotConfig = {
  _id: string;
  branchId: { _id: string; name: string; code: string } | null;
  slotDuration: number;
  bufferTime: number;
  workingStartTime: string;
  workingEndTime: string;
  maxConcurrentBookings: number;
  autoExpiry: boolean;
  blockedDates: string[];
  slotTimes?: string[];
  disabledSlotsByDate?: Record<string, string[]>;
};

type SlotAvailability = {
  time: string;
  label?: string;
  available: boolean;
  bookings: number;
  maxBookings: number;
  reason?: string | null;
};
type FleetSummary = { model: string; variant?: string; label: string; available: number; total: number; capacity: number };

export default function AdminTDSlotConfig() {
  const { models: catalogModels } = useVehicleCatalog();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [configs, setConfigs] = useState<SlotConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [form, setForm] = useState({
    branchId: "",
    ...DEFAULT_SLOT_SCHEDULE,
    slotTimes: generateSlotTimesFromRules(DEFAULT_SLOT_SCHEDULE),
  });
  const [newSlotTime, setNewSlotTime] = useState("10:00");

  // Slot preview
  const [previewDate, setPreviewDate] = useState("");
  const [previewModel, setPreviewModel] = useState("VF 7");
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Block date
  const [blockDate, setBlockDate] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);
  const [fleetSummary, setFleetSummary] = useState<FleetSummary[]>([]);

  // Daily slot overrides (admin open/close per date)
  const [dailyDate, setDailyDate] = useState("");
  const [dailyModel, setDailyModel] = useState("VF 7");
  const [dailySlots, setDailySlots] = useState<TdSlotGridItem[]>([]);
  const [dailyDisabled, setDailyDisabled] = useState<string[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailySaving, setDailySaving] = useState(false);

  const fetchFleetSummary = useCallback(async (branchId: string) => {
    if (!branchId) {
      setFleetSummary([]);
      return;
    }
    try {
      const { data } = await adminGet<{ model: string; variant?: string; status: string }[]>(
        `/admin/td/vehicles?branchId=${branchId}&limit=100`,
      );
      const rows = data ?? [];
      const byTrim = new Map<string, { model: string; variant?: string; label: string; available: number; total: number; capacity: number }>();
      for (const v of rows) {
        const key = `${v.model}::${v.variant || ""}`;
        const cur = byTrim.get(key) ?? {
          model: v.model,
          variant: v.variant,
          label: v.variant ? `${v.model} · ${v.variant}` : v.model,
          available: 0,
          total: 0,
          capacity: 0,
        };
        cur.total += 1;
        cur.capacity += 1;
        if (v.status === "AVAILABLE") cur.available += 1;
        byTrim.set(key, cur);
      }
      setFleetSummary([...byTrim.values()]);
    } catch {
      setFleetSummary([]);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [bRes, cRes] = await Promise.all([
        adminGet<Branch[]>("/admin/td/branches/public"),
        adminGet<SlotConfig[]>("/admin/td/slots")
      ]);
      setBranches(bRes.data ?? []);
      setConfigs(cRes.data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Load config when branch changes
  useEffect(() => {
    if (!selectedBranch) return;
    void fetchFleetSummary(selectedBranch);
    const existing = configs.find((c) => c.branchId?._id === selectedBranch);
    if (existing) {
      setForm({
        branchId: selectedBranch,
        slotDuration: existing.slotDuration,
        bufferTime: existing.bufferTime,
        workingStartTime: existing.workingStartTime,
        workingEndTime: existing.workingEndTime,
        maxConcurrentBookings: existing.maxConcurrentBookings,
        autoExpiry: existing.autoExpiry,
        slotTimes: existing.slotTimes?.length
          ? [...existing.slotTimes]
          : generateSlotTimesFromRules({
              workingStartTime: existing.workingStartTime,
              workingEndTime: existing.workingEndTime,
              slotDuration: existing.slotDuration,
              bufferTime: existing.bufferTime,
            }),
      });
    } else {
      setForm({
        branchId: selectedBranch,
        ...DEFAULT_SLOT_SCHEDULE,
        slotTimes: generateSlotTimesFromRules(DEFAULT_SLOT_SCHEDULE),
      });
    }
  }, [selectedBranch, configs, fetchFleetSummary]);

  const previewGeneratedSlots = useMemo(
    () => generateSlotTimesFromRules(form),
    [form.workingStartTime, form.workingEndTime, form.slotDuration, form.bufferTime],
  );

  const scheduleStepMinutes = form.slotDuration + form.bufferTime;

  const handleSave = async () => {
    if (!form.branchId) { toast.error("Please select a branch"); return; }
    if (form.slotTimes.length === 0) {
      toast.error("Add at least one test drive time slot.");
      return;
    }
    setSaving(true);
    try {
      await adminPostJson("/admin/td/slots/config", {
        ...form,
        slotTimes: normalizeSlotTimesList(form.slotTimes),
      });
      toast.success("Slot configuration saved! Website test drive page will use these timings.");
      void fetchData();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateTimings = () => {
    const generated = previewGeneratedSlots;
    setForm((p) => ({ ...p, slotTimes: generated }));
    toast.success(`Generated ${generated.length} time slot(s) for all dates.`);
  };

  const handleSaveScheduleToWebsite = async () => {
    if (!form.branchId) {
      toast.error("Please select a branch");
      return;
    }
    const generated = previewGeneratedSlots;
    if (generated.length === 0) {
      toast.error("No slots fit within your start/end times. Adjust the schedule rules.");
      return;
    }
    setSaving(true);
    try {
      await adminPostJson("/admin/td/slots/config", {
        ...form,
        slotTimes: normalizeSlotTimesList(generated),
      });
      setForm((p) => ({ ...p, slotTimes: generated }));
      toast.success(
        `Saved ${generated.length} slot(s) for all dates (${formatTime12h(form.workingStartTime)} – ${formatTime12h(form.workingEndTime)}).`,
      );
      void fetchData();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlotTime = () => {
    if (!newSlotTime) return;
    setForm((p) => ({
      ...p,
      slotTimes: normalizeSlotTimesList([...p.slotTimes, newSlotTime]),
    }));
  };

  const handleRemoveSlotTime = (time: string) => {
    setForm((p) => ({ ...p, slotTimes: p.slotTimes.filter((t) => t !== time) }));
  };

  const fetchSlotPreview = async () => {
    if (!selectedBranch || !previewDate) { toast.error("Select a branch and date first"); return; }
    setSlotsLoading(true);
    try {
      const q = new URLSearchParams({
        branchId: selectedBranch,
        date: previewDate,
        model: previewModel,
      });
      const { data } = await adminGet<SlotAvailability[]>(`/admin/td/slots/available?${q}`);
      setSlots(data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSlotsLoading(false);
    }
  };

  const loadDailySlots = async () => {
    if (!selectedBranch || !dailyDate) {
      toast.error("Select a branch and date first");
      return;
    }
    setDailyLoading(true);
    try {
      const q = new URLSearchParams({
        branchId: selectedBranch,
        date: dailyDate,
        model: dailyModel,
      });
      const { data } = await adminGet<SlotAvailability[]>(`/admin/td/slots/available?${q}`);
      setDailySlots(data ?? []);
      const cfg = configs.find((c) => c.branchId?._id === selectedBranch);
      const map = cfg?.disabledSlotsByDate ?? {};
      setDailyDisabled(map[dailyDate] ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setDailyLoading(false);
    }
  };

  const toggleDailySlot = (time: string) => {
    const slot = dailySlots.find((s) => s.time === time);
    const fullFromBookings = slot?.reason === "full" || (slot?.bookings ?? 0) >= (slot?.maxBookings ?? 1);
    if (fullFromBookings) {
      toast.info("This slot is already booked — it stays unavailable for new customers.");
      return;
    }
    setDailyDisabled((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : normalizeSlotTimesList([...prev, time]),
    );
  };

  const saveDailyOverrides = async () => {
    if (!selectedBranch || !dailyDate) return;
    setDailySaving(true);
    try {
      await adminPostJson("/admin/td/slots/date-overrides", {
        branchId: selectedBranch,
        date: dailyDate,
        disabledTimes: dailyDisabled,
      });
      toast.success("Daily slot availability saved — website will reflect this immediately.");
      void fetchData();
      void loadDailySlots();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setDailySaving(false);
    }
  };

  const handleBlockDate = async (action: "block" | "unblock") => {
    if (!selectedBranch || !blockDate) { toast.error("Select a branch and date"); return; }
    setBlockLoading(true);
    try {
      const endpoint = action === "block" ? "/admin/td/slots/block-date" : "/admin/td/slots/unblock-date";
      await adminPostJson(endpoint, { branchId: selectedBranch, date: blockDate });
      toast.success(`Date ${action === "block" ? "blocked" : "unblocked"} successfully`);
      setBlockDate("");
      void fetchData();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setBlockLoading(false);
    }
  };

  const currentConfig = configs.find((c) => c.branchId?._id === selectedBranch);
  const blockedDates = currentConfig?.blockedDates ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Slot Configuration
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage test drive timings here — the website test drive page loads these exact slots via API.
          </p>
        </div>
        <Button onClick={() => void fetchData()} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...</div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {/* Config Form */}
          <div className="space-y-6">
            {/* Branch selector */}
            <Card className="bg-card border-border/50 p-4 space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /> Select Branch</h3>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Choose a branch to configure" /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b._id} value={b._id}>{b.name} ({b.code})</SelectItem>)}</SelectContent>
              </Select>
              {!selectedBranch && <p className="text-xs text-muted-foreground">Select a branch to view or edit its slot configuration.</p>}
            </Card>

            {selectedBranch && fleetSummary.length > 0 && (
              <Card className="bg-card border-border/50 p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Car className="w-4 h-4 text-primary" /> Demo fleet capacity (website slots)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each time slot allows up to{" "}
                  <span className="text-foreground font-medium">{form.maxConcurrentBookings}</span> booking(s) per{" "}
                  <span className="text-foreground font-medium">model</span>, capped by demo cars for that model.
                  Example: Customer A books VF 7 on 16 Jun at 10:15 — that slot closes for VF 7 only; VF 6 can still
                  use 10:15 if a VF 6 demo car is free. Manage fleet under{" "}
                  <span className="text-primary">TD → Demo Fleet</span>.
                </p>
                <div className="flex flex-wrap gap-2">
                  {fleetSummary.map((f) => (
                    <Badge key={f.label} className="bg-secondary/80 text-foreground border-border/40">
                      {f.label}: {f.capacity} demo car(s) · {f.available} free now
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {selectedBranch && (
              <Tabs defaultValue="timings">
                <TabsList className="bg-secondary/50">
                  <TabsTrigger value="timings">Manage Timings</TabsTrigger>
                  <TabsTrigger value="daily">Daily availability</TabsTrigger>
                  <TabsTrigger value="config">Rules & Capacity</TabsTrigger>
                  <TabsTrigger value="preview">Live Preview</TabsTrigger>
                  <TabsTrigger value="blocked">Blocked Dates</TabsTrigger>
                </TabsList>

                {/* Manage Timings — shown on website */}
                <TabsContent value="timings" className="mt-4">
                  <Card className="bg-card border-border/50 p-5 space-y-5">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" /> Test drive schedule (all dates)
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Set how slots are built for every bookable date. Each test drive lasts{" "}
                        <span className="text-foreground">{form.slotDuration} minutes</span>, with a{" "}
                        <span className="text-foreground">{form.bufferTime}-minute gap</span> before the next slot
                        starts. Customers see the same times on the website until you change this setup.
                      </p>
                    </div>

                    <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 space-y-4">
                      <p className="text-xs font-medium text-foreground">Schedule rules</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">First slot starts</Label>
                          <Input
                            type="time"
                            value={form.workingStartTime}
                            onChange={(e) => setForm((p) => ({ ...p, workingStartTime: e.target.value }))}
                            className="bg-background/80"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Last slot ends by</Label>
                          <Input
                            type="time"
                            value={form.workingEndTime}
                            onChange={(e) => setForm((p) => ({ ...p, workingEndTime: e.target.value }))}
                            className="bg-background/80"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Test drive length</Label>
                          <Select
                            value={String(form.slotDuration)}
                            onValueChange={(v) => setForm((p) => ({ ...p, slotDuration: Number(v) }))}
                          >
                            <SelectTrigger className="bg-background/80">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="45">45 min</SelectItem>
                              <SelectItem value="60">60 min</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Gap between slots</Label>
                          <Input
                            type="number"
                            min={0}
                            max={60}
                            value={form.bufferTime}
                            onChange={(e) => setForm((p) => ({ ...p, bufferTime: Number(e.target.value) }))}
                            className="bg-background/80"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground space-y-1">
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          <Zap className="w-3.5 h-3.5 text-primary" /> Preview for all dates
                        </p>
                        <p>
                          {previewGeneratedSlots.length} slot(s) · every {scheduleStepMinutes} min (
                          {form.slotDuration} min drive + {form.bufferTime} min gap) ·{" "}
                          {formatTime12h(form.workingStartTime)} – {formatTime12h(form.workingEndTime)}
                        </p>
                        <p className="text-[11px]">
                          Example times:{" "}
                          {previewGeneratedSlots.slice(0, 4).map(formatTime12h).join(", ")}
                          {previewGeneratedSlots.length > 4 ? " …" : ""}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleGenerateTimings}>
                          <Wand2 className="w-4 h-4 mr-2" /> Apply preview to slot list
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleSaveScheduleToWebsite()}
                          disabled={saving}
                          className="bg-primary text-primary-foreground"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save schedule to website (all dates)
                        </Button>
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h4 className="text-sm font-medium">Website time slots</h4>
                        <Badge variant="outline" className="text-xs">
                          {form.slotTimes.length} slot(s) configured
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        These exact times appear on the test drive booking page. Remove or add individual times if
                        needed; otherwise use the schedule rules above.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {form.slotTimes.map((t) => (
                        <div
                          key={t}
                          className="box-border flex h-[4.25rem] flex-col items-center justify-center rounded-xl border-2 border-primary/60 bg-background px-2 py-2 text-center relative group"
                        >
                          <p className="text-sm font-semibold">{formatTime12h(t)}</p>
                          <p className="text-[10px] text-emerald-500 font-medium mt-1">On website</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-7 w-7 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-400/10"
                            onClick={() => handleRemoveSlotTime(t)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {form.slotTimes.length === 0 ? (
                      <p className="text-sm text-amber-500 text-center py-4">
                        No timings yet. Set the schedule rules above and click Save schedule to website.
                      </p>
                    ) : null}

                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/40">
                      <Input
                        type="time"
                        value={newSlotTime}
                        onChange={(e) => setNewSlotTime(e.target.value)}
                        className="bg-secondary/50 sm:max-w-[10rem]"
                      />
                      <Button type="button" variant="outline" onClick={handleAddSlotTime}>
                        <Plus className="w-4 h-4 mr-2" /> Add time slot
                      </Button>
                    </div>

                    <Button onClick={() => void handleSave()} disabled={saving} variant="outline" className="w-full">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Save manual slot list only
                    </Button>
                  </Card>
                </TabsContent>

                {/* Daily availability — toggle open/closed per date (same UX as website) */}
                <TabsContent value="daily" className="mt-4">
                  <Card className="bg-card border-border/50 p-5 space-y-4">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" /> Daily slot availability
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Pick a date and model, then tap slots to open or close them — same grid customers see.
                        Booked slots stay locked for that model only.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        type="date"
                        value={dailyDate}
                        onChange={(e) => setDailyDate(e.target.value)}
                        className="bg-secondary/50 flex-1"
                      />
                      <Select value={dailyModel} onValueChange={setDailyModel}>
                        <SelectTrigger className="bg-secondary/50 w-full sm:w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogModels.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => void loadDailySlots()}
                        disabled={dailyLoading}
                        className="bg-primary text-primary-foreground shrink-0"
                      >
                        {dailyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                        Load slots
                      </Button>
                    </div>
                    {dailySlots.length > 0 ? (
                      <>
                        <TdSlotGrid
                          slots={dailySlots.map((s) => {
                            const full = (s.bookings ?? 0) >= (s.maxBookings ?? 1);
                            const adminOff = dailyDisabled.includes(s.time);
                            return {
                              ...s,
                              available: !full && !adminOff,
                              reason: full ? "full" : adminOff ? "blocked" : s.reason,
                            };
                          })}
                          toggleMode
                          adminDisabledTimes={dailyDisabled}
                          onToggleAdmin={toggleDailySlot}
                        />
                        <Button
                          onClick={() => void saveDailyOverrides()}
                          disabled={dailySaving}
                          className="w-full bg-primary text-primary-foreground"
                        >
                          {dailySaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                          Save availability for {dailyDate}
                        </Button>
                      </>
                    ) : dailyDate && !dailyLoading ? (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Click Load slots to manage availability for this date.
                      </p>
                    ) : null}
                  </Card>
                </TabsContent>

                {/* Config Tab */}
                <TabsContent value="config" className="mt-4">
                  <Card className="bg-card border-border/50 p-5 space-y-5">
                    <h3 className="font-semibold flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Booking rules</h3>
                    <p className="text-xs text-muted-foreground">
                      Use these to auto-generate timings, or set capacity limits. Customer-facing times are managed in the Timings tab.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Slot Duration (minutes)</Label>
                        <Select value={String(form.slotDuration)} onValueChange={(v) => setForm((p) => ({ ...p, slotDuration: Number(v) }))}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="30">30 min</SelectItem><SelectItem value="45">45 min</SelectItem><SelectItem value="60">60 min</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Buffer Time (minutes)</Label>
                        <Input type="number" min={0} max={30} value={form.bufferTime} onChange={(e) => setForm((p) => ({ ...p, bufferTime: Number(e.target.value) }))} className="bg-secondary/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Working Start Time</Label>
                        <Input type="time" value={form.workingStartTime} onChange={(e) => setForm((p) => ({ ...p, workingStartTime: e.target.value }))} className="bg-secondary/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Working End Time</Label>
                        <Input type="time" value={form.workingEndTime} onChange={(e) => setForm((p) => ({ ...p, workingEndTime: e.target.value }))} className="bg-secondary/50" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Legacy max bookings (optional)</Label>
                        <Input type="number" min={1} max={10} value={form.maxConcurrentBookings} onChange={(e) => setForm((p) => ({ ...p, maxConcurrentBookings: Number(e.target.value) }))} className="bg-secondary/50" />
                        <p className="text-[10px] text-muted-foreground">
                          Website slot capacity is set automatically from demo fleet count per model + trim (e.g. 2 VF 7 Sky Infinity cars = 2 bookings at the same time).
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Auto-Expiry of Stale Bookings</Label>
                        <Select value={String(form.autoExpiry)} onValueChange={(v) => setForm((p) => ({ ...p, autoExpiry: v === "true" }))}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="true">Enabled</SelectItem><SelectItem value="false">Disabled</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Preview summary */}
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                      <p className="flex items-center gap-1.5 font-medium text-foreground mb-1"><Zap className="w-3.5 h-3.5 text-primary" /> Configuration Preview</p>
                      <p>Slots run from <span className="text-foreground">{form.workingStartTime}</span> to <span className="text-foreground">{form.workingEndTime}</span></p>
                      <p>Each slot: <span className="text-foreground">{form.slotDuration} min</span> + <span className="text-foreground">{form.bufferTime} min buffer</span></p>
                      <p>Max concurrent bookings per slot follow demo fleet per trim (shown above).</p>
                      <p>Same date + time + model: second customer sees slot as <span className="text-red-400">Full</span>.</p>
                    </div>

                    <Button onClick={() => void handleSave()} disabled={saving} className="bg-primary text-primary-foreground w-full">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save Configuration
                    </Button>
                  </Card>
                </TabsContent>

                {/* Preview Tab — same API as website */}
                <TabsContent value="preview" className="mt-4">
                  <Card className="bg-card border-border/50 p-5 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2"><Search className="w-4 h-4 text-primary" /> Website preview (live API)</h3>
                    <p className="text-xs text-muted-foreground">
                      Same API as the public test drive page — pick a model to preview its availability.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input type="date" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} className="bg-secondary/50 flex-1" />
                      <Select value={previewModel} onValueChange={setPreviewModel}>
                        <SelectTrigger className="bg-secondary/50 w-full sm:w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogModels.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={() => void fetchSlotPreview()} disabled={slotsLoading} className="bg-primary text-primary-foreground shrink-0">
                        {slotsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                    {slots.length > 0 && (
                      <TdSlotGrid slots={slots} disabled />
                    )}
                    {slots.length === 0 && previewDate && !slotsLoading && (
                      <p className="text-muted-foreground text-sm text-center py-6">No slots available for this date (may be blocked)</p>
                    )}
                  </Card>
                </TabsContent>

                {/* Blocked Dates Tab */}
                <TabsContent value="blocked" className="mt-4">
                  <Card className="bg-card border-border/50 p-5 space-y-4">
                    <h3 className="font-semibold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Blocked Dates</h3>
                    <div className="flex gap-3">
                      <Input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="bg-secondary/50 flex-1" />
                      <Button onClick={() => void handleBlockDate("block")} disabled={blockLoading} variant="destructive" className="shrink-0">
                        <Ban className="w-4 h-4 mr-1" /> Block
                      </Button>
                      <Button onClick={() => void handleBlockDate("unblock")} disabled={blockLoading} variant="outline" className="shrink-0 text-green-400 border-green-400/20 hover:bg-green-400/10">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Unblock
                      </Button>
                    </div>
                    {blockedDates.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{blockedDates.length} date(s) blocked</p>
                        <div className="flex flex-wrap gap-2">
                          {[...blockedDates].sort().map((d) => (
                            <Badge key={d} className="bg-red-400/10 text-red-400 border-red-400/20 font-mono">
                              {d}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-6">No dates blocked for this branch</p>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
