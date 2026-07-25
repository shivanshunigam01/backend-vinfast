import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminGet, formatApiErrors } from "@/lib/api";

type CalendarEvent = {
  id: string;
  type: string;
  title: string;
  date: string | null;
  time: string | null;
  status?: string;
  href?: string;
};

const TYPE_LABELS: Record<string, string> = {
  test_drive: "Test Drive",
  lead_follow_up: "Lead Follow-up",
  pending_approval: "Pending Approval",
  customer_appointment: "Reschedule / Appointment",
};

export default function AdminCalendar() {
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<CalendarEvent[]>(
        `/admin/dashboard/calendar?from=${from}&to=${to}`,
      );
      setEvents(res.data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = ev.date || "unscheduled";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendar Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test drives, follow-ups, approvals, and customer appointments — click any event to open it.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : byDate.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No events in this date range.</Card>
      ) : (
        <div className="space-y-6">
          {byDate.map(([date, dayEvents]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                {date === "unscheduled"
                  ? "Unscheduled"
                  : new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
              </h2>
              <div className="grid gap-2">
                {dayEvents.map((ev) => (
                  <Card key={ev.id} className="p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{TYPE_LABELS[ev.type] || ev.type}</Badge>
                        {ev.status ? <Badge variant="secondary">{ev.status}</Badge> : null}
                        {ev.time ? <span className="text-xs text-muted-foreground">{ev.time}</span> : null}
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1">{ev.title}</p>
                    </div>
                    {ev.href ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={ev.href}>Open</Link>
                      </Button>
                    ) : null}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
