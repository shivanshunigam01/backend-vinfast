import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime12h } from "@/lib/tdSlotSchedule";

export type TdSlotGridItem = {
  time: string;
  label?: string;
  available: boolean;
  bookings?: number;
  maxBookings?: number;
  reason?: string | null;
};

type TdSlotGridProps = {
  slots: TdSlotGridItem[];
  selectedTime?: string;
  onSelect?: (time: string) => void;
  /** Admin mode: click toggles availability override (only when not full from bookings) */
  toggleMode?: boolean;
  adminDisabledTimes?: string[];
  onToggleAdmin?: (time: string) => void;
  disabled?: boolean;
};

function slotLabel(slot: TdSlotGridItem) {
  return slot.label ?? formatTime12h(slot.time);
}

export function TdSlotGrid({
  slots,
  selectedTime,
  onSelect,
  toggleMode = false,
  adminDisabledTimes = [],
  onToggleAdmin,
  disabled = false,
}: TdSlotGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {slots.map((slot) => {
        const selected = selectedTime === slot.time;
        const adminOff = adminDisabledTimes.includes(slot.time);
        const fullFromBookings = slot.reason === "full" || (slot.bookings ?? 0) >= (slot.maxBookings ?? 1);
        const showUnavailable = !slot.available;
        const canToggle = toggleMode && onToggleAdmin && !fullFromBookings && !disabled;
        const canSelect = !toggleMode && slot.available && !disabled && onSelect;

        return (
          <button
            key={slot.time}
            type="button"
            disabled={(!canToggle && !canSelect && showUnavailable) || disabled}
            onClick={() => {
              if (canToggle) onToggleAdmin(slot.time);
              else if (canSelect) onSelect(slot.time);
            }}
            className={cn(
              "box-border flex h-[4.25rem] flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-center transition-colors",
              selected && slot.available
                ? "border-primary bg-primary/10 shadow-sm"
                : slot.available
                  ? "border-primary/60 bg-background hover:border-primary hover:bg-primary/[0.04] cursor-pointer"
                  : "border-transparent bg-muted/70 text-muted-foreground cursor-not-allowed",
              canToggle && "cursor-pointer",
              toggleMode && adminOff && "border-transparent bg-muted/70",
            )}
          >
            <span
              className={cn(
                "text-sm font-semibold leading-tight",
                slot.available && !adminOff
                  ? "text-foreground"
                  : "text-muted-foreground line-through decoration-muted-foreground/60",
              )}
            >
              {slotLabel(slot)}
            </span>
            {slot.available && !adminOff ? (
              <span className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-500">
                {toggleMode ? "Open" : "Available"}
              </span>
            ) : (
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Lock className="h-3 w-3 shrink-0" aria-hidden />
                {fullFromBookings ? "Booked" : adminOff ? "Closed" : "Unavailable"}
              </span>
            )}
            {toggleMode && slot.bookings !== undefined && slot.maxBookings !== undefined ? (
              <span className="mt-0.5 text-[9px] text-muted-foreground">
                {slot.bookings}/{slot.maxBookings} booked
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
