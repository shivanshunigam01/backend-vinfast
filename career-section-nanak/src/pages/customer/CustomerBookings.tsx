import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar, Clock, Loader2, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiRequestError, formatApiErrors } from "@/lib/api";
import {
  customerRequestReschedule,
  fetchCustomerBookings,
  type CustomerBooking,
  type PreferredSlotOption,
} from "@/lib/customerApi";
import { fetchPublicTdSlots, formatSlotLabel, type PublicTdSlot } from "@/lib/publicTdApi";
import { formatTime12h } from "@/lib/tdSlotSchedule";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  CONFIRMED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-500/15 text-red-700 dark:text-red-300",
  RESCHEDULED: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  MISSED: "bg-red-500/15 text-red-700 dark:text-red-300",
};

function formatBookingDate(booking: CustomerBooking): string {
  if (booking.slotDateLabel) {
    return format(new Date(`${booking.slotDateLabel}T12:00:00`), "dd MMM yyyy");
  }
  if (booking.slotDate) {
    return format(new Date(booking.slotDate), "dd MMM yyyy");
  }
  return "—";
}

type PrefDraft = { date: string; time: string };

const EMPTY_PREFS: PrefDraft[] = [
  { date: "", time: "" },
  { date: "", time: "" },
  { date: "", time: "" },
];

function preferencesAreDistinct(prefs: PrefDraft[]): boolean {
  const completed = prefs.filter((pref) => pref.date && pref.time);
  return completed.length === 3 && new Set(completed.map((pref) => `${pref.date}|${pref.time}`)).size === 3;
}

export default function CustomerBookings() {
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleTarget, setRescheduleTarget] = useState<CustomerBooking | null>(null);
  const [prefs, setPrefs] = useState<PrefDraft[]>(EMPTY_PREFS);
  const [activePrefIndex, setActivePrefIndex] = useState(0);
  const [rescheduleSlots, setRescheduleSlots] = useState<PublicTdSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const minDate = format(new Date(), "yyyy-MM-dd");

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomerBookings();
      setBookings(data);
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? formatApiErrors(e) : "Could not load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const openReschedule = (booking: CustomerBooking) => {
    setRescheduleTarget(booking);
    setPrefs(EMPTY_PREFS.map((pref) => ({ ...pref })));
    setActivePrefIndex(0);
    setReason("");
    setRescheduleSlots([]);
  };

  const activeDate = prefs[activePrefIndex]?.date || "";

  const loadRescheduleSlots = useCallback(async () => {
    if (!rescheduleTarget?.branchId?._id || !activeDate) return;
    setSlotsLoading(true);
    try {
      const model = rescheduleTarget.preferredModel || rescheduleTarget.testDriveId?.model || "";
      const variant =
        rescheduleTarget.testDriveId?.variant ||
        (rescheduleTarget as CustomerBooking & { preferredVariant?: string }).preferredVariant ||
        "";
      const res = await fetchPublicTdSlots({
        branchId: rescheduleTarget.branchId._id,
        date: activeDate,
        model,
        variant: variant || undefined,
      });
      setRescheduleSlots(res.slots);
    } catch {
      toast.error("Could not load available time slots");
    } finally {
      setSlotsLoading(false);
    }
  }, [activeDate, rescheduleTarget]);

  useEffect(() => {
    if (rescheduleTarget && activeDate) {
      void loadRescheduleSlots();
    }
  }, [rescheduleTarget, activeDate, loadRescheduleSlots]);

  const handleReschedule = async () => {
    if (!rescheduleTarget) return;
    const preferredSlots: PreferredSlotOption[] = prefs.map((p) => ({
      slotDate: p.date,
      slotTime: p.time,
    }));
    if (preferredSlots.some((p) => !p.slotDate || !p.slotTime)) {
      toast.error("Select date and time for all 3 preferred options");
      return;
    }
    if (!preferencesAreDistinct(prefs)) {
      toast.error("Choose 3 different preferred date/time options");
      return;
    }
    setSaving(true);
    try {
      await customerRequestReschedule(rescheduleTarget._id, {
        preferredSlots,
        reason: reason.trim() || undefined,
      });
      toast.success("Reschedule request submitted — our team will confirm a slot");
      setRescheduleTarget(null);
      void loadBookings();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? formatApiErrors(e) : "Reschedule request failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-muted-foreground">No test drive bookings found for your mobile number.</p>
        <Button asChild className="mt-4">
          <a href="/test-drive">Book a test drive</a>
        </Button>
      </Card>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={() => void loadBookings()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking._id} className="p-5 border-border/60">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{booking.bookingId}</span>
                  <Badge className={STATUS_COLORS[booking.bookingStatus] || "bg-muted"}>
                    {booking.bookingStatus}
                  </Badge>
                  {booking.hasPendingReschedule ? (
                    <Badge variant="outline" className="text-amber-700 border-amber-500/40">
                      Reschedule pending
                    </Badge>
                  ) : null}
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p className="flex items-center gap-2 text-foreground">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    {formatBookingDate(booking)}
                  </p>
                  <p className="flex items-center gap-2 text-foreground">
                    <Clock className="h-4 w-4 text-primary shrink-0" />
                    {booking.slotTimeLabel || formatTime12h(booking.slotTime)}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {booking.branchId?.name || "Showroom"}
                    {booking.preferredModel || booking.testDriveId?.model
                      ? ` · ${booking.preferredModel || booking.testDriveId?.model}`
                      : ""}
                    {booking.testDriveId?.variant ? ` ${booking.testDriveId.variant}` : ""}
                  </p>
                </div>

                {booking.assignedExecutive?.name ? (
                  <p className="text-xs text-muted-foreground">
                    Executive: {booking.assignedExecutive.name}
                  </p>
                ) : null}
              </div>

              {booking.canReschedule && !booking.hasPendingReschedule ? (
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => openReschedule(booking)}>
                  Request reschedule
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={Boolean(rescheduleTarget)} onOpenChange={(open) => !open && setRescheduleTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request reschedule</DialogTitle>
            <DialogDescription>
              Submit 3 preferred time options for booking {rescheduleTarget?.bookingId}. Our team will assign the best available slot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <Button
                  key={i}
                  type="button"
                  size="sm"
                  variant={activePrefIndex === i ? "default" : "outline"}
                  onClick={() => setActivePrefIndex(i)}
                >
                  Option {i + 1}
                  {prefs[i]?.time ? " ✓" : ""}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reschedule-date">Preferred date (option {activePrefIndex + 1})</Label>
              <Input
                id="reschedule-date"
                type="date"
                min={minDate}
                value={prefs[activePrefIndex]?.date || ""}
                onChange={(e) => {
                  const next = [...prefs];
                  next[activePrefIndex] = { date: e.target.value, time: "" };
                  setPrefs(next);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Preferred time</Label>
              {slotsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : rescheduleSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No slots available for this date.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {rescheduleSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => {
                        const next = [...prefs];
                        next[activePrefIndex] = {
                          date: prefs[activePrefIndex].date,
                          time: slot.time,
                        };
                        setPrefs(next);
                      }}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm transition-colors",
                        !slot.available && "opacity-50 cursor-not-allowed border-border bg-muted/30",
                        slot.available && prefs[activePrefIndex]?.time === slot.time
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : slot.available && "border-border hover:border-primary/50",
                      )}
                    >
                      {formatSlotLabel(slot)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reschedule-reason">Reason (optional)</Label>
              <Textarea
                id="reschedule-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why do you need to reschedule?"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleReschedule()}
              disabled={saving || !preferencesAreDistinct(prefs)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit 3 preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
