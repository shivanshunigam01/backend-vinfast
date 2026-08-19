import type { ReactNode } from "react";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LeadFollowUpItem } from "@/lib/pvLeadCrmApi";
import { cn } from "@/lib/utils";

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    return format(new Date(iso), "h:mm a");
  } catch {
    return "";
  }
}

function formatDay(iso?: string) {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd MMM");
  } catch {
    return "";
  }
}

function entryWhen(fu: LeadFollowUpItem) {
  return fu.completedAt || fu.scheduledAt || fu.createdAt;
}

type Group = { day: string; items: LeadFollowUpItem[] };

function groupByDay(items: LeadFollowUpItem[]): Group[] {
  const map = new Map<string, LeadFollowUpItem[]>();
  const sorted = [...items].sort(
    (a, b) => new Date(entryWhen(a)).getTime() - new Date(entryWhen(b)).getTime(),
  );
  for (const fu of sorted) {
    const day = formatDay(entryWhen(fu)) || "—";
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(fu);
  }
  return [...map.entries()].map(([day, rows]) => ({ day, items: rows }));
}

type Props = {
  followUps: LeadFollowUpItem[];
  canUpdate: boolean;
  saving: boolean;
  completingId: string | null;
  onStartComplete: (id: string) => void;
  completeForm: ReactNode;
};

export function LeadFollowUpTimeline({
  followUps,
  canUpdate,
  saving,
  completingId,
  onStartComplete,
  completeForm,
}: Props) {
  if (followUps.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No follow-ups yet.</p>;
  }

  const groups = groupByDay(followUps);

  return (
    <div className="space-y-5 max-h-[28rem] overflow-y-auto pr-1">
      {groups.map((g) => (
        <div key={g.day}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{g.day}</p>
          <div className="space-y-0 border-l-2 border-primary/25 ml-2">
            {g.items.map((fu) => {
              const when = entryWhen(fu);
              const bits = [fu.note, fu.outcome, fu.nextAction].filter(Boolean);
              return (
                <div key={fu._id} className="relative pl-4 py-2.5">
                  <span
                    className={cn(
                      "absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full border-2 border-background",
                      fu.status === "completed"
                        ? "bg-emerald-500"
                        : fu.status === "pending"
                          ? "bg-amber-500"
                          : "bg-muted-foreground",
                    )}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">
                      {formatTime(when)}
                      {fu.createdBy?.name ? (
                        <span className="font-normal text-muted-foreground"> · {fu.createdBy.name}</span>
                      ) : null}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        fu.status === "pending" ? "text-amber-600" : "text-emerald-600",
                      )}
                    >
                      {fu.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed mt-0.5">{bits.join(" · ")}</p>
                  {fu.interestLevel ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Interest: {fu.interestLevel}</p>
                  ) : null}
                  {fu.status === "pending" && canUpdate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-[10px]"
                      disabled={saving}
                      onClick={() => onStartComplete(fu._id)}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Mark done
                    </Button>
                  ) : null}
                  {completingId === fu._id ? completeForm : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
