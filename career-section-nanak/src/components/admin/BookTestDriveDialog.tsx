import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminGet, formatApiErrors } from "@/lib/api";
import { getAdminUser } from "@/lib/adminAuth";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import {
  checkTdBookingEligibility,
  createStaffTdBooking,
  type TdBookingEligibility,
} from "@/lib/tdBookingApi";

type SlotOption = { time: string; label?: string; available: boolean };
type Branch = { _id: string; name: string };

export type BookTestDriveCustomer = {
  /** CRM lead to link the booking to (moves it to "Test Drive Booked"). */
  leadId?: string;
  name: string;
  mobile: string;
  email?: string;
  city?: string;
  /** Base model preference, e.g. "VF 7". */
  model?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: BookTestDriveCustomer | null;
  /** Render editable customer fields (walk-in / new booking from the TD module). */
  allowCustomerEdit?: boolean;
  onBooked?: () => void;
};

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Staff-side "Book Test Drive" dialog. Enforces the repeat rules:
 * multiple drives per customer are fine across models; a repeat of an
 * already-completed model needs manager/superadmin approval.
 */
export function BookTestDriveDialog({ open, onOpenChange, customer, allowCustomerEdit = false, onBooked }: Props) {
  const adminUser = getAdminUser();
  const isAdmin = adminUser?.role === "manager" || adminUser?.role === "superadmin";
  const { models: catalogModels } = useVehicleCatalog();

  const [custName, setCustName] = useState("");
  const [custMobile, setCustMobile] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custCity, setCustCity] = useState("");
  const [model, setModel] = useState("");
  const [slotDate, setSlotDate] = useState(todayIso());
  const [slotTime, setSlotTime] = useState("");
  const [remarks, setRemarks] = useState("");
  const [branch, setBranch] = useState<Branch | null>(null);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [eligibility, setEligibility] = useState<TdBookingEligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize once per open — the customer prop may be an inline object recreated on every parent render.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current || !customer) return;
    initializedRef.current = true;
    setCustName(customer.name ?? "");
    setCustMobile(customer.mobile ?? "");
    setCustEmail(customer.email ?? "");
    setCustCity(customer.city ?? "");
    const preferred = customer.model && catalogModels.includes(customer.model) ? customer.model : catalogModels[0] ?? "";
    setModel(preferred);
    setSlotDate(todayIso());
    setSlotTime("");
    setRemarks("");
    setSlots([]);
    setEligibility(null);
  }, [open, customer, catalogModels]);

  // Catalog can load after the dialog opens — backfill the default model.
  useEffect(() => {
    if (open && !model && catalogModels.length) setModel(catalogModels[0]);
  }, [open, model, catalogModels]);

  useEffect(() => {
    if (!open) return;
    adminGet<Branch[]>("/admin/td/branches/public")
      .then(({ data }) => setBranch(data?.[0] ?? null))
      .catch(() => setBranch(null));
  }, [open]);

  const mobileValid = /^[6-9]\d{9}$/.test(custMobile);

  useEffect(() => {
    if (!open || !mobileValid || !model) {
      setEligibility(null);
      return;
    }
    setEligibilityLoading(true);
    checkTdBookingEligibility(custMobile, model)
      .then(setEligibility)
      .catch((e) => {
        setEligibility(null);
        toast.error(formatApiErrors(e));
      })
      .finally(() => setEligibilityLoading(false));
  }, [open, custMobile, mobileValid, model]);

  const loadSlots = useCallback(async () => {
    if (!branch?._id || !slotDate || !model) return;
    setSlotsLoading(true);
    try {
      const q = new URLSearchParams({ branchId: branch._id, date: slotDate, model });
      const { data } = await adminGet<SlotOption[]>(`/admin/td/slots/available?${q}`);
      setSlots(data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [branch?._id, slotDate, model]);

  useEffect(() => {
    setSlotTime("");
    void loadSlots();
  }, [loadSlots]);

  if (!customer) return null;

  const activeDuplicate = eligibility?.activeSameModel ?? null;
  const isRepeat = Boolean(eligibility?.requiresApproval);
  const repeatBlocked = isRepeat && !isAdmin;
  const blocked = Boolean(activeDuplicate) || repeatBlocked;

  const handleSubmit = async () => {
    if (!custName.trim()) { toast.error("Customer name is required"); return; }
    if (!mobileValid) { toast.error("Enter a valid 10-digit mobile number"); return; }
    if (!model) { toast.error("Select a model"); return; }
    if (!slotDate || !slotTime) { toast.error("Select a date and time slot"); return; }
    setSaving(true);
    try {
      const created = await createStaffTdBooking({
        customerName: custName.trim(),
        customerMobile: custMobile,
        customerEmail: custEmail.trim() || undefined,
        customerCity: custCity.trim() || undefined,
        preferredModel: model,
        slotDate,
        slotTime,
        remarks: remarks.trim() || undefined,
        leadId: customer.leadId,
      });
      toast.success(
        isRepeat
          ? `Repeat test drive booked with your approval (${created.bookingId})`
          : `Test drive booked (${created.bookingId})`,
      );
      onOpenChange(false);
      onBooked?.();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Book Test Drive
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {allowCustomerEdit ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Customer name *</Label>
                <Input value={custName} onChange={(e) => setCustName(e.target.value)} className="bg-secondary/50" placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Mobile *</Label>
                <Input
                  value={custMobile}
                  onChange={(e) => setCustMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  inputMode="numeric"
                  maxLength={10}
                  className="bg-secondary/50"
                  placeholder="10-digit mobile"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={custEmail} onChange={(e) => setCustEmail(e.target.value)} className="bg-secondary/50" placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input value={custCity} onChange={(e) => setCustCity(e.target.value)} className="bg-secondary/50" placeholder="Optional" />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
              <p className="font-medium text-foreground">{custName}</p>
              <p className="text-muted-foreground text-xs">{custMobile}{custCity ? ` · ${custCity}` : ""}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select model" /></SelectTrigger>
              <SelectContent>
                {catalogModels.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {eligibilityLoading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking previous test drives…
            </p>
          ) : activeDuplicate ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <p className="font-medium flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Already booked
              </p>
              <p className="mt-1">
                This customer already has an active {model} test drive ({activeDuplicate.bookingId},{" "}
                {activeDuplicate.bookingStatus}). Reschedule that booking instead of creating a duplicate.
              </p>
            </div>
          ) : isRepeat ? (
            isAdmin ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                <p className="font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Repeat test drive — booking with your approval
                </p>
                <p className="mt-1">
                  {model} was already completed ({eligibility?.completedSameModel?.bookingId}). As{" "}
                  {adminUser?.role === "superadmin" ? "an admin" : "a manager"}, saving this will approve the repeat drive.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <p className="font-medium flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Admin approval required
                </p>
                <p className="mt-1">
                  This customer already completed a {model} test drive ({eligibility?.completedSameModel?.bookingId}).
                  Ask a manager or admin to book the repeat drive.
                </p>
              </div>
            )
          ) : eligibility ? (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> No previous {model} test drive — good to book.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={slotDate} min={todayIso()} onChange={(e) => setSlotDate(e.target.value)} className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Time slot</Label>
              <Select value={slotTime} onValueChange={setSlotTime} disabled={slotsLoading || slots.length === 0}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder={slotsLoading ? "Loading…" : slots.length ? "Select slot" : "No slots"} />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((s) => (
                    <SelectItem key={s.time} value={s.time} disabled={!s.available}>
                      {s.label || s.time}{!s.available ? " (full)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Remarks (optional)</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="bg-secondary/50" placeholder="Anything the delivery team should know…" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || blocked || !slotTime}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {isRepeat && isAdmin ? "Approve & book repeat" : "Book test drive"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
