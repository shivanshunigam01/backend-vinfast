import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AssignableStaffUser } from "@/lib/pvLeadCrmApi";

export type CalendarFilterState = {
  types: string[];
  status: string;
  assignedTo: string;
  model: string;
};

const TYPE_OPTIONS = [
  { key: "lead", label: "Leads" },
  { key: "test_drive", label: "Test Drives" },
  { key: "lead_follow_up", label: "Follow-ups" },
] as const;

type Props = {
  filters: CalendarFilterState;
  onChange: (next: CalendarFilterState) => void;
  executives: AssignableStaffUser[];
  models: string[];
  showAssigneeFilter?: boolean;
};

export function CalendarFilters({
  filters,
  onChange,
  executives,
  models,
  showAssigneeFilter = true,
}: Props) {
  const toggleType = (key: string) => {
    const has = filters.types.includes(key);
    const next = has ? filters.types.filter((t) => t !== key) : [...filters.types, key];
    onChange({ ...filters, types: next.length ? next : ["lead", "test_drive", "lead_follow_up"] });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Show</Label>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_OPTIONS.map((t) => {
            const on = filters.types.includes(t.key);
            return (
              <Button
                key={t.key}
                type="button"
                size="sm"
                variant={on ? "default" : "outline"}
                className="h-8"
                onClick={() => toggleType(t.key)}
              >
                {t.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5 min-w-[140px]">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select value={filters.status} onValueChange={(v) => onChange({ ...filters, status: v })}>
          <SelectTrigger className="h-8 bg-background">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Enquiry">Enquiry</SelectItem>
            <SelectItem value="Interested">Interested</SelectItem>
            <SelectItem value="Follow Up">Follow Up</SelectItem>
            <SelectItem value="PENDING">TD Pending</SelectItem>
            <SelectItem value="CONFIRMED">TD Confirmed</SelectItem>
            <SelectItem value="IN_PROGRESS">TD In progress</SelectItem>
            <SelectItem value="COMPLETED">TD Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showAssigneeFilter ? (
        <div className="space-y-1.5 min-w-[180px]">
          <Label className="text-xs text-muted-foreground">Executive / Manager</Label>
          <Select
            value={filters.assignedTo}
            onValueChange={(v) => onChange({ ...filters, assignedTo: v })}
          >
            <SelectTrigger className="h-8 bg-background">
              <SelectValue placeholder="All (my team)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (my team)</SelectItem>
              <SelectItem value="me">Assigned to me</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {executives.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.name}
                  {e.designationLabel ? ` · ${e.designationLabel}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5 min-w-[140px]">
        <Label className="text-xs text-muted-foreground">Vehicle</Label>
        <Select value={filters.model} onValueChange={(v) => onChange({ ...filters, model: v })}>
          <SelectTrigger className="h-8 bg-background">
            <SelectValue placeholder="All models" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All models</SelectItem>
            {models.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
