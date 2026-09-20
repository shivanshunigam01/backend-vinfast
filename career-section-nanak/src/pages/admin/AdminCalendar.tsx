import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg, DatesSetArg, EventClickArg, EventDropArg } from "@fullcalendar/core";
import {
  CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction, canPerformManagerAction, isFieldStaffUser } from "@/lib/adminAuth";
import { fetchAssignableStaffUsers, type AssignableStaffUser } from "@/lib/pvLeadCrmApi";
import {
  calendarEventToFc,
  fetchCalendarEvents,
  patchCalendarEvent,
  type CalendarEvent,
} from "@/lib/calendarApi";
import {
  CalendarFilters,
  DEFAULT_CALENDAR_TYPES,
  type CalendarFilterState,
} from "@/components/admin/calendar/CalendarFilters";
import { CalendarEventPanel } from "@/components/admin/calendar/CalendarEventPanel";
import { CalendarDayEventsDialog } from "@/components/admin/calendar/CalendarDayEventsDialog";
import { AddPvLeadDialog } from "@/components/admin/AddPvLeadDialog";
import { BookTestDriveDialog } from "@/components/admin/BookTestDriveDialog";
import { cn } from "@/lib/utils";

const MODEL_OPTIONS = ["VF 7", "VF 6", "VF MPV 7", "Limo Green", "Both"];

type CalView = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";

function localDateKey(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AdminCalendar() {
  const adminUser = getAdminUser();
  const isExecutive = isFieldStaffUser(adminUser);
  const canCreateLead = canPerformAction(adminUser, "crm_leads", "create");
  const canCreateTd = canPerformAction(adminUser, "td_bookings", "create") || canPerformAction(adminUser, "td_my_bookings", "update");
  const canAssign = canPerformManagerAction(adminUser, "crm_leads", "assign");
  const canEdit =
    canPerformAction(adminUser, "calendar", "update") ||
    canPerformAction(adminUser, "crm_leads", "update") ||
    canPerformAction(adminUser, "td_bookings", "update") ||
    canPerformAction(adminUser, "td_my_bookings", "reschedule") ||
    canPerformManagerAction(adminUser, "crm_leads", "update");

  const calendarRef = useRef<FullCalendar | null>(null);
  const didAutoOpenToday = useRef(false);
  const [view, setView] = useState<CalView>("dayGridMonth");
  const [title, setTitle] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [dayDialogDate, setDayDialogDate] = useState<string | null>(null);
  const [range, setRange] = useState(() => {
    const from = new Date();
    from.setDate(1);
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    return { from: localDateKey(from), to: localDateKey(to) };
  });
  const [filters, setFilters] = useState<CalendarFilterState>({
    types: [...DEFAULT_CALENDAR_TYPES],
    status: "all",
    assignedTo: "all",
    model: "all",
  });
  const [events, setEvents] = useState<CalendarEvent[] | null>([]);
  const [loading, setLoading] = useState(true);
  const [executives, setExecutives] = useState<AssignableStaffUser[]>([]);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showBookTd, setShowBookTd] = useState(false);

  const loadExecutives = useCallback(async () => {
    try {
      const list = await fetchAssignableStaffUsers();
      setExecutives(list);
    } catch {
      setExecutives([]);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    if (filters.types.length === 0) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchCalendarEvents({
        from: range.from,
        to: range.to,
        types: filters.types,
        status: filters.status,
        assignedTo: filters.assignedTo,
        model: filters.model,
      });
      setEvents(data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [range, filters]);

  useEffect(() => {
    void loadExecutives();
  }, [loadExecutives]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const fcEvents = useMemo(() => (events ?? []).map(calendarEventToFc), [events]);

  const api = () => calendarRef.current?.getApi();

  const openDayDialog = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
    setDayDialogDate(dateKey);
    setDayDialogOpen(true);
  }, []);

  const onDatesSet = (arg: DatesSetArg) => {
    setTitle(arg.view.title);
    const from = localDateKey(arg.start);
    const end = new Date(arg.end);
    end.setDate(end.getDate() - 1);
    const to = localDateKey(end);
    setRange((prev) => (prev.from === from && prev.to === to ? prev : { from, to }));
  };

  const changeView = (v: CalView) => {
    setView(v);
    api()?.changeView(v);
  };

  const goToday = () => {
    api()?.today();
    openDayDialog(localDateKey(new Date()));
  };
  const goPrev = () => api()?.prev();
  const goNext = () => api()?.next();

  useEffect(() => {
    if (didAutoOpenToday.current || loading) return;
    const t = window.setTimeout(() => {
      if (didAutoOpenToday.current) return;
      didAutoOpenToday.current = true;
      const today = localDateKey(new Date());
      calendarRef.current?.getApi()?.today();
      setSelectedDate(today);
      setDayDialogDate(today);
      setDayDialogOpen(true);
    }, 150);
    return () => window.clearTimeout(t);
  }, [loading]);

  const onDateClick = (arg: DateClickArg) => {
    openDayDialog(localDateKey(arg.date));
  };

  const onMoreLinkClick = (arg: { date: Date; jsEvent: UIEvent }) => {
    arg.jsEvent.preventDefault();
    openDayDialog(localDateKey(arg.date));
  };

  const openEventDetail = (ev: CalendarEvent) => {
    setSelected(ev);
    setPanelOpen(true);
  };

  const onEventClick = (arg: EventClickArg) => {
    const ev = arg.event.extendedProps as CalendarEvent;
    const full: CalendarEvent = {
      ...ev,
      id: arg.event.id,
      title: arg.event.title,
      href: ev.href,
    };
    openEventDetail(full);
  };

  const onEventDrop = async (arg: EventDropArg) => {
    if (!canEdit) {
      arg.revert();
      toast.error("You do not have permission to reschedule");
      return;
    }
    try {
      const start = arg.event.start;
      if (!start) {
        arg.revert();
        return;
      }
      await patchCalendarEvent(arg.event.id, {
        start: start.toISOString(),
        end: arg.event.end?.toISOString(),
        allDay: arg.event.allDay,
      });
      toast.success("Event moved");
      void loadEvents();
    } catch (e) {
      arg.revert();
      toast.error(formatApiErrors(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Today is highlighted — click any date (or +N more) to see all events; click an event for full details.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreateLead ? (
            <Button size="sm" variant="outline" onClick={() => setShowAddLead(true)}>
              <Plus className="w-4 h-4 mr-1" /> Lead
            </Button>
          ) : null}
          {canCreateTd ? (
            <Button size="sm" variant="outline" onClick={() => setShowBookTd(true)}>
              <Plus className="w-4 h-4 mr-1" /> Test Drive
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => void loadEvents()} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <CalendarFilters
        filters={filters}
        onChange={setFilters}
        executives={executives}
        models={MODEL_OPTIONS}
        showAssigneeFilter={!isExecutive || canAssign}
      />

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between bg-muted/20">
          <div className="flex items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={goToday}>
              Today
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={goPrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={goNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <p className="ml-2 text-sm font-semibold text-foreground min-w-[10rem]">{title || "—"}</p>
            {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <Select value={view} onValueChange={(v) => changeView(v as CalView)}>
            <SelectTrigger className="h-8 w-[130px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dayGridMonth">Month</SelectItem>
              <SelectItem value="timeGridWeek">Week</SelectItem>
              <SelectItem value="timeGridDay">Day</SelectItem>
              <SelectItem value="listWeek">Agenda</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="p-2 sm:p-3 calendar-fc h-[min(72vh,720px)] min-h-[520px]">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={false}
            height="100%"
            stickyHeaderDates
            nowIndicator
            editable={canEdit}
            eventStartEditable={canEdit}
            eventDurationEditable={false}
            selectable={false}
            weekends
            dayMaxEvents={3}
            dayMaxEventRows={3}
            eventMaxStack={4}
            moreLinkClick={onMoreLinkClick}
            moreLinkContent={(arg) => `+${arg.num} more`}
            events={fcEvents}
            datesSet={onDatesSet}
            dateClick={onDateClick}
            dayCellClassNames={(arg) => {
              const key = localDateKey(arg.date);
              const today = localDateKey(new Date());
              const classes: string[] = [];
              if (key === today) classes.push("fc-day-focus-today");
              if (key === selectedDate) classes.push("fc-day-selected");
              return classes;
            }}
            eventClick={onEventClick}
            eventDrop={(arg) => void onEventDrop(arg)}
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
            slotMinTime="08:00:00"
            slotMaxTime="21:00:00"
            allDaySlot
            expandRows={false}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#0ea5e9]" /> New leads
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#3b82f6]" /> Test drives
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#10b981]" /> Follow-ups
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#6366f1]" /> Stage
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#d97706]" /> Bookings
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#059669]" /> Deliveries
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#ec4899]" /> Meetings
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#8b5cf6]" /> Approvals
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#f97316]" /> Awaiting vehicle
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#14b8a6]" /> Sales
        </span>
      </div>

      <CalendarDayEventsDialog
        open={dayDialogOpen}
        dateKey={dayDialogDate}
        events={events ?? []}
        onOpenChange={setDayDialogOpen}
        onSelectEvent={openEventDetail}
      />

      <CalendarEventPanel
        open={panelOpen}
        event={selected}
        executives={executives}
        canEdit={canEdit}
        onOpenChange={setPanelOpen}
        onSaved={() => void loadEvents()}
      />

      {canCreateLead ? (
        <AddPvLeadDialog
          open={showAddLead}
          onOpenChange={setShowAddLead}
          isExecutive={isExecutive}
          canAssignToExecutive={canAssign}
          executives={executives}
          onCreated={() => void loadEvents()}
        />
      ) : null}

      {canCreateTd ? (
        <BookTestDriveDialog
          open={showBookTd}
          onOpenChange={setShowBookTd}
          customer={{ name: "", mobile: "" }}
          allowCustomerEdit
          onBooked={() => void loadEvents()}
        />
      ) : null}

      <style>{`
        .calendar-fc .fc {
          --fc-border-color: hsl(var(--border) / 0.6);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: hsl(var(--muted) / 0.35);
          --fc-today-bg-color: hsl(var(--primary) / 0.08);
          --fc-event-border-color: transparent;
          font-family: inherit;
          height: 100%;
        }
        .calendar-fc .fc .fc-col-header-cell-cushion,
        .calendar-fc .fc .fc-daygrid-day-number {
          color: hsl(var(--foreground));
          text-decoration: none;
          font-size: 0.8rem;
          padding: 6px 8px;
        }
        .calendar-fc .fc .fc-daygrid-day.fc-day-today .fc-daygrid-day-number {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-radius: 999px;
          width: 1.75rem;
          height: 1.75rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }
        .calendar-fc .fc-daygrid-day .fc-daygrid-day-frame {
          cursor: pointer;
          transition: background 0.15s ease, outline-color 0.15s ease;
        }
        .calendar-fc .fc-daygrid-day.fc-day-selected .fc-daygrid-day-frame {
          outline: 2px solid hsl(var(--primary));
          outline-offset: -2px;
          background: hsl(var(--primary) / 0.08);
          border-radius: 0.35rem;
        }
        .calendar-fc .fc-daygrid-day.fc-day-focus-today:not(.fc-day-selected) .fc-daygrid-day-frame {
          box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.35);
        }
        .calendar-fc .fc-daygrid-day.fc-day-focus-today.fc-day-selected .fc-daygrid-day-frame {
          background: hsl(var(--primary) / 0.14);
        }
        .calendar-fc .fc-event {
          border-radius: 4px;
          padding: 1px 4px;
          font-size: 0.72rem;
          cursor: pointer;
          overflow: hidden;
        }
        .calendar-fc .fc-timegrid-slot {
          height: 2.5rem;
        }
        /* Keep all-day row compact so dense lead lists never spill into timed slots */
        .calendar-fc .fc-timegrid .fc-daygrid-body {
          max-height: 6.75rem !important;
          overflow: hidden !important;
        }
        .calendar-fc .fc-timegrid .fc-daygrid-day-events {
          max-height: 6.25rem;
          overflow: hidden;
        }
        .calendar-fc .fc-daygrid-day-frame {
          min-height: 0 !important;
          overflow: hidden;
        }
        .calendar-fc .fc-dayGridMonth-view .fc-daygrid-day-frame {
          max-height: 7.5rem;
        }
        .calendar-fc .fc-daygrid-event-harness {
          max-width: 100%;
        }
        .calendar-fc .fc-more-link {
          font-size: 0.7rem;
          font-weight: 700;
          color: hsl(var(--primary));
          padding: 2px 6px;
          border-radius: 0.25rem;
          background: hsl(var(--primary) / 0.1);
        }
        .calendar-fc .fc-more-link:hover {
          background: hsl(var(--primary) / 0.18);
          text-decoration: none;
        }
        .calendar-fc .fc-list-event:hover td {
          background: hsl(var(--muted) / 0.4);
        }
      `}</style>
    </div>
  );
}
