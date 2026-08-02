import { adminGet, adminPatchJson } from "@/lib/api";

export type CalendarAssignee = {
  _id: string;
  name?: string;
  email?: string;
  designation?: string;
};

export type CalendarEventType =
  | "new_lead"
  | "lead"
  | "test_drive"
  | "lead_follow_up"
  | "stage_activity"
  | "booking_update"
  | "delivery"
  | "sales_activity"
  | "awaiting_vehicle"
  | "pending_approval"
  | "customer_appointment"
  | string;

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  date?: string | null;
  time?: string | null;
  status?: string;
  customerName?: string;
  mobile?: string;
  vehicle?: string;
  assignedExecutive?: CalendarAssignee | null;
  assignedManager?: CalendarAssignee | null;
  leadId?: string | null;
  bookingId?: string | null;
  bookingCode?: string;
  followUpId?: string;
  remarks?: string;
  assignmentStatus?: string;
  href?: string;
  color?: string;
};

export type CalendarFiltersParams = {
  from: string;
  to: string;
  types?: string[];
  status?: string;
  assignedTo?: string;
  model?: string;
};

export async function fetchCalendarEvents(params: CalendarFiltersParams): Promise<CalendarEvent[]> {
  const q = new URLSearchParams({
    from: params.from,
    to: params.to,
  });
  if (params.types?.length) q.set("types", params.types.join(","));
  if (params.status && params.status !== "all") q.set("status", params.status);
  if (params.assignedTo && params.assignedTo !== "all") q.set("assignedTo", params.assignedTo);
  if (params.model && params.model !== "all") q.set("model", params.model);
  const { data } = await adminGet<CalendarEvent[]>(`/admin/dashboard/calendar?${q}`);
  return data ?? [];
}

export async function patchCalendarEvent(
  id: string,
  payload: { start?: string; end?: string; date?: string; time?: string; allDay?: boolean },
): Promise<CalendarEvent> {
  return adminPatchJson<CalendarEvent>(`/admin/dashboard/calendar/events/${id}`, payload);
}

export function calendarEventToFc(ev: CalendarEvent) {
  const allDay = Boolean(ev.allDay);
  // Date-only strings avoid timezone drift that can make all-day events
  // span / stack incorrectly in week view.
  const dateOnly = ev.date || (ev.start ? String(ev.start).slice(0, 10) : undefined);
  return {
    id: ev.id,
    title: ev.title,
    start: allDay && dateOnly ? dateOnly : ev.start,
    end: allDay ? undefined : ev.end,
    allDay,
    backgroundColor: ev.color || "#3b82f6",
    borderColor: ev.color || "#3b82f6",
    extendedProps: ev,
  };
}
