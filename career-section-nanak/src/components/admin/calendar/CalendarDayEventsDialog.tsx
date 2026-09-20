import { CalendarClock, Car, Phone, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { calendarEventDateKey, type CalendarEvent } from "@/lib/calendarApi";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  lead: "Lead",
  test_drive: "Test Drive",
  lead_follow_up: "Follow-up",
  stage_activity: "Stage",
  booking_update: "Booking",
  delivery: "Delivery",
  sales_activity: "Sales",
  awaiting_vehicle: "Awaiting Vehicle",
  pending_approval: "Approval",
  customer_appointment: "Meeting",
};

function formatDayTitle(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatEventTime(ev: CalendarEvent) {
  if (ev.allDay) return "All day";
  if (ev.time) return ev.time;
  if (!ev.start) return "—";
  const d = new Date(ev.start);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function sortEvents(a: CalendarEvent, b: CalendarEvent) {
  if (a.allDay && !b.allDay) return -1;
  if (!a.allDay && b.allDay) return 1;
  return String(a.start || "").localeCompare(String(b.start || ""));
}

export function filterEventsForDate(events: CalendarEvent[], dateKey: string) {
  return events.filter((ev) => calendarEventDateKey(ev) === dateKey).sort(sortEvents);
}

type Props = {
  open: boolean;
  dateKey: string | null;
  events: CalendarEvent[];
  onOpenChange: (open: boolean) => void;
  onSelectEvent: (event: CalendarEvent) => void;
};

export function CalendarDayEventsDialog({
  open,
  dateKey,
  events,
  onOpenChange,
  onSelectEvent,
}: Props) {
  const dayEvents = dateKey ? filterEventsForDate(events, dateKey) : [];
  const todayKey = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();
  const isToday = dateKey === todayKey;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/50 shrink-0">
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            {dateKey ? formatDayTitle(dateKey) : "Day schedule"}
            {isToday ? (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                Today
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            {dayEvents.length
              ? `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"} — tap one for full details`
              : "No events on this date"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[min(60vh,520px)]">
          <div className="p-3 space-y-2">
            {dayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 px-4">
                Nothing scheduled for this day. Use filters or add a lead / test drive from the calendar header.
              </p>
            ) : (
              dayEvents.map((ev) => {
                const typeLabel = TYPE_LABELS[ev.type] || ev.type;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => {
                      onSelectEvent(ev);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "w-full text-left rounded-lg border border-border/60 bg-card p-3",
                      "hover:border-primary/40 hover:bg-primary/5 transition-colors",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{ev.customerName || ev.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{ev.title}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 text-[10px]"
                        style={{ borderColor: ev.color, color: ev.color }}
                      >
                        {typeLabel}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" />
                        {formatEventTime(ev)}
                      </span>
                      {ev.mobile ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Phone className="w-3 h-3 shrink-0" />
                          {ev.mobile}
                        </span>
                      ) : null}
                      {ev.vehicle ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Car className="w-3 h-3 shrink-0" />
                          {ev.vehicle}
                        </span>
                      ) : null}
                      {ev.assignedExecutive?.name ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <User className="w-3 h-3 shrink-0" />
                          {ev.assignedExecutive.name}
                        </span>
                      ) : null}
                    </div>
                    {(ev.status || ev.remarks) && (
                      <div className="mt-2 pt-2 border-t border-border/40 text-xs space-y-0.5">
                        {ev.status ? (
                          <p>
                            <span className="text-muted-foreground">Status: </span>
                            <span className="font-medium text-foreground">{ev.status}</span>
                          </p>
                        ) : null}
                        {ev.remarks ? (
                          <p className="text-muted-foreground line-clamp-2">{ev.remarks}</p>
                        ) : null}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="px-5 py-3 border-t border-border/50 shrink-0">
          <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
