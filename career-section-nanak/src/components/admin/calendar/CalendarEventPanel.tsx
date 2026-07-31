import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatApiErrors, adminPatchJson } from "@/lib/api";
import {
  assignPvCrmLeadExecutive,
  updatePvCrmLeadStage,
  updatePvCrmLeadRemarks,
  type AssignableStaffUser,
} from "@/lib/pvLeadCrmApi";
import { CRM_LEAD_STAGES } from "@/lib/leadStages";
import { patchCalendarEvent, type CalendarEvent } from "@/lib/calendarApi";

type Props = {
  open: boolean;
  event: CalendarEvent | null;
  executives: AssignableStaffUser[];
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const TD_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "MISSED", "RESCHEDULED"];

function toLocalInputValue(iso?: string, allDay?: boolean) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (allDay) return d.toISOString().slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CalendarEventPanel({
  open,
  event,
  executives,
  canEdit,
  onOpenChange,
  onSaved,
}: Props) {
  const [status, setStatus] = useState("");
  const [remarks, setRemarks] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!event) return;
    setStatus(event.status || "");
    setRemarks(event.remarks || "");
    setAssigneeId(event.assignedExecutive?._id || "");
    setWhen(toLocalInputValue(event.start, event.allDay));
  }, [event]);

  if (!event) return null;

  const typeLabel =
    event.type === "test_drive"
      ? "Test Drive"
      : event.type === "lead"
        ? "Lead"
        : event.type === "lead_follow_up"
          ? "Follow-up"
          : event.type;

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      // Reschedule
      if (when) {
        if (event.allDay || when.length === 10) {
          await patchCalendarEvent(event.id, { date: when.slice(0, 10), time: "10:00", allDay: true });
        } else {
          await patchCalendarEvent(event.id, { start: new Date(when).toISOString() });
        }
      }

      if (event.type === "lead" && event.leadId) {
        if (status && status !== event.status) {
          await updatePvCrmLeadStage(event.leadId, status, "Updated from Calendar");
        }
        if (remarks !== (event.remarks || "")) {
          await updatePvCrmLeadRemarks(event.leadId, remarks);
        }
        const prev = event.assignedExecutive?._id || "";
        if (assigneeId !== prev) {
          await assignPvCrmLeadExecutive(event.leadId, assigneeId || null);
        }
      }

      if (event.type === "test_drive" && event.bookingId) {
        if (status && status !== event.status) {
          await adminPatchJson(`/admin/td/bookings/${event.bookingId}`, { bookingStatus: status });
        }
        if (remarks !== (event.remarks || "")) {
          await adminPatchJson(`/admin/td/bookings/${event.bookingId}/details`, { remarks });
        }
        const prev = event.assignedExecutive?._id || "";
        if (assigneeId && assigneeId !== prev) {
          await adminPatchJson(`/admin/td/bookings/${event.bookingId}/assign-executive`, {
            executiveId: assigneeId,
          });
        }
      }

      if (event.type === "lead_follow_up") {
        // Date already patched; notes live on follow-up — skip if no dedicated API from panel
      }

      toast.success("Calendar event updated");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            {event.customerName || event.title}
            <Badge variant="outline" style={{ borderColor: event.color, color: event.color }}>
              {typeLabel}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            {event.mobile || "—"} · {event.vehicle || "No vehicle"} · {event.status || "—"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs space-y-1.5">
            <p>
              <span className="text-muted-foreground">Assigned executive: </span>
              {event.assignedExecutive?.name || "Unassigned"}
            </p>
            {event.assignedManager?.name ? (
              <p>
                <span className="text-muted-foreground">Reports to: </span>
                {event.assignedManager.name}
              </p>
            ) : null}
            {event.bookingCode ? (
              <p>
                <span className="text-muted-foreground">Booking: </span>
                {event.bookingCode}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Date & time</Label>
            <Input
              type={event.allDay ? "date" : "datetime-local"}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              disabled={!canEdit || saving}
              className="bg-secondary/40"
            />
          </div>

          {(event.type === "lead" || event.type === "test_drive") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus} disabled={!canEdit || saving}>
                <SelectTrigger className="bg-secondary/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(event.type === "lead" ? CRM_LEAD_STAGES : TD_STATUSES).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(event.type === "lead" || event.type === "test_drive") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Reassign</Label>
              <Select
                value={assigneeId || "__none__"}
                onValueChange={(v) => setAssigneeId(v === "__none__" ? "" : v)}
                disabled={!canEdit || saving}
              >
                <SelectTrigger className="bg-secondary/40">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {executives.map((e) => (
                    <SelectItem key={e._id} value={e._id}>
                      {e.name}
                      {e.designationLabel ? ` · ${e.designationLabel}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(event.type === "lead" || event.type === "test_drive") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={4}
                disabled={!canEdit || saving}
                className="bg-secondary/40"
                placeholder="Add notes…"
              />
            </div>
          )}

          {canEdit ? (
            <Button className="w-full" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save changes
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground text-center">View only — you cannot edit this event.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
