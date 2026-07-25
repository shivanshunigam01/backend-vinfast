import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  fetchPublicTdBranches,
  fetchPublicTdSlots,
  formatSlotLabel,
  slotStatusLabel,
  type PublicTdSlot,
} from "@/lib/publicTdApi";

type TestDriveSlotPickerProps = {
  model: string;
  variant?: string;
  date: string;
  time: string;
  onDateChange: (isoDate: string) => void;
  onTimeChange: (time24: string) => void;
  disabled?: boolean;
  minBookableDay?: number;
  isDateBookable: (d: Date) => boolean;
  toISODateString: (d: Date) => string;
};

function SlotLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
        Available
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/35" />
        Unavailable
      </span>
    </div>
  );
}

export function TestDriveSlotPicker({
  model,
  variant = "",
  date,
  time,
  onDateChange,
  onTimeChange,
  disabled = false,
  minBookableDay = 10,
  isDateBookable,
  toISODateString,
}: TestDriveSlotPickerProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [slots, setSlots] = useState<PublicTdSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsMessage, setSlotsMessage] = useState<string | null>(null);
  const [workingHours, setWorkingHours] = useState<string | null>(null);
  const [slotDuration, setSlotDuration] = useState<number | null>(null);
  const [bufferTime, setBufferTime] = useState<number | null>(null);
  const [fleetCapacity, setFleetCapacity] = useState<number | null>(null);

  const selectedCalendarDate = date ? new Date(`${date}T12:00:00`) : undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchPublicTdBranches();
      if (cancelled) return;
      const patna = list.find((b) => b.code === "PATNA" || b.code === "PAT") ?? list[0];
      if (patna) setBranchId(patna._id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSlots = useCallback(async () => {
    if (!branchId || !date) {
      setSlots([]);
      setSlotsMessage(null);
      return;
    }
    setSlotsLoading(true);
    setSlotsMessage(null);
    const res = await fetchPublicTdSlots({ branchId, date, model, variant: variant || undefined });
    setSlots(res.slots);
    setSlotsMessage(res.message ?? null);
    setFleetCapacity(res.fleetCapacity ?? res.fleetAvailable ?? null);
    if (res.workingStartTime && res.workingEndTime) {
      setWorkingHours(`${res.workingStartTime} – ${res.workingEndTime}`);
    }
    setSlotDuration(res.slotDuration ?? null);
    setBufferTime(res.bufferTime ?? null);
    if (res.slots.length === 0 && !res.message) {
      setSlotsMessage("No test drive times are configured yet. Please call the showroom to book.");
    }
    setSlotsLoading(false);
  }, [branchId, date, model, variant]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    if (!time) return;
    if (slots.length > 0 && !slots.some((s) => s.time === time && s.available)) {
      onTimeChange("");
    }
  }, [slots, time, onTimeChange]);

  const availableCount = slots.filter((s) => s.available).length;
  const selectedSlot = time ? slots.find((s) => s.time === time) : undefined;

  const exampleSlotLabel = slots[0] ? formatSlotLabel(slots[0]) : "that time";
  const scheduleHint =
    slotDuration != null && bufferTime != null
      ? ` Each slot is ${slotDuration} minutes with a ${bufferTime}-minute gap before the next.`
      : "";

  return (
    <div className="space-y-4 rounded-xl border border-primary/15 bg-primary/[0.04] p-4 sm:p-5">
      {/* <p className="text-xs text-muted-foreground leading-relaxed">
        Slots are per vehicle model — if someone already booked {model || "this model"} at {exampleSlotLabel}, that
        time stays unavailable for the same model, but other models may still have the slot open.
        {workingHours ? ` Showroom hours: ${workingHours}.` : ""}
        {scheduleHint}
        {" "}
        Bookings open from the {minBookableDay}th of each month. */}
      {/* </p> */}
      {date && fleetCapacity != null && fleetCapacity === 0 ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          No demo {model}{variant ? ` ${variant}` : ""} is scheduled at the showroom for this date. Try another trim or date.
        </p>
      ) : null}

      <div className={cn("flex flex-col gap-2 min-w-0", disabled && "opacity-60 pointer-events-none")}>
        <span id="td-date-label" className="text-xs font-medium text-muted-foreground">
          Preferred date *
        </span>
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-labelledby="td-date-label"
              className={cn(
                "h-12 w-full min-w-0 justify-start text-left font-normal rounded-xl border-border bg-background px-4 text-sm",
                !date && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
              <span className="truncate">
                {date ? format(new Date(`${date}T12:00:00`), "dd MMM yyyy") : "Pick date"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedCalendarDate}
              onSelect={(d) => {
                if (!d || !isDateBookable(d)) return;
                onDateChange(toISODateString(d));
                onTimeChange("");
                setDatePickerOpen(false);
              }}
              disabled={(d) => !isDateBookable(d)}
              defaultMonth={selectedCalendarDate ?? new Date()}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Preferred time slot *</span>
          {date && !slotsLoading && slots.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {availableCount} of {slots.length} available
            </span>
          ) : null}
        </div>

        {!date ? (
          <p className="text-xs text-muted-foreground py-1">Select a date first to load showroom time slots.</p>
        ) : slotsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading time slots…
          </div>
        ) : slots.length === 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400 py-2">
            {slotsMessage ?? "No time slots configured for this branch."}
          </p>
        ) : (
          <>
            <SlotLegend />
            {slotsMessage ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">{slotsMessage}</p>
            ) : null}
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
              role="listbox"
              aria-label="Test drive time slots"
            >
              {slots.map((slot) => {
                const selected = time === slot.time;
                const slotDisabled = disabled || !slot.available;

                return (
                  <button
                    key={slot.time}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={slotDisabled}
                    disabled={slotDisabled}
                    onClick={() => {
                      if (!slotDisabled) onTimeChange(slot.time);
                    }}
                    className={cn(
                      "box-border flex h-[4.25rem] flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-center transition-colors",
                      selected && slot.available
                        ? "border-primary bg-primary/10 shadow-sm cursor-pointer"
                        : slot.available
                          ? "border-primary/60 bg-background hover:border-primary hover:bg-primary/[0.04] cursor-pointer"
                          : "border-transparent bg-muted/70 text-muted-foreground cursor-not-allowed",
                    )}
                  >
                    <span
                      className={cn(
                        "text-sm font-semibold leading-tight",
                        slot.available
                          ? "text-foreground"
                          : "text-muted-foreground line-through decoration-muted-foreground/60",
                      )}
                    >
                      {formatSlotLabel(slot)}
                    </span>
                    {slot.available ? (
                      <span className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-500">
                        Available
                      </span>
                    ) : (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Lock className="h-3 w-3 shrink-0" aria-hidden />
                        {slotStatusLabel(slot) ?? "Unavailable"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="min-h-[1.125rem] text-[11px] text-muted-foreground">
              {selectedSlot
                ? `${formatSlotLabel(selectedSlot)} selected — continue filling the form below.`
                : availableCount > 0
                  ? "Select an available slot to continue."
                  : "\u00a0"}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
