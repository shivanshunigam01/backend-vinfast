import { format } from "date-fns";
import {
  CalendarClock, Car, CheckCircle2, History, MessageSquare, Pencil,
  Phone, Star, User, UserCheck, UserPlus, Trophy, ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CustomerHistory, CustomerTimelineEvent } from "@/lib/crmCustomerApi";

function fmt(iso?: string) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy · h:mm a");
  } catch {
    return "—";
  }
}

const EVENT_ICONS: Record<CustomerTimelineEvent["type"], typeof History> = {
  lead_created: UserPlus,
  status_change: ArrowRight,
  assignment: UserCheck,
  edit: Pencil,
  follow_up: Phone,
  test_drive_booked: CalendarClock,
  test_drive_completed: Car,
  feedback: Star,
  post_delivery_feedback: MessageSquare,
  referral: User,
  sale_conversion: Trophy,
};

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 text-center">
      <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: CustomerHistory | null;
  /** Optional heading context, e.g. "Existing customer found". */
  headline?: string;
};

/** Full customer lifecycle popup — first enquiry to referrals and sale conversion. */
export function CustomerHistoryDialog({ open, onOpenChange, history, headline }: Props) {
  if (!history) return null;
  const { customer, summary, timeline } = history;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> {headline || "Customer history"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">{customer.name}</p>
              {customer.customerId ? (
                <Badge variant="outline" className="font-mono text-[10px]">{customer.customerId}</Badge>
              ) : null}
              {summary.hasCompletedTestDrive ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Test drive done
                </Badge>
              ) : null}
              {summary.hasActiveBooking ? (
                <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[10px]">
                  Active booking
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {customer.mobile}
              {customer.city ? ` · ${customer.city}` : ""}
              {customer.since ? ` · customer since ${fmt(customer.since)}` : ""}
            </p>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <SummaryStat label="Leads" value={summary.totalLeads} />
            <SummaryStat label="Open" value={summary.openLeads} />
            <SummaryStat label="TD booked" value={summary.testDrivesBooked} />
            <SummaryStat label="TD done" value={summary.testDrivesCompleted} />
            <SummaryStat label="Referrals" value={summary.referralsMade} />
            <SummaryStat label="Purchases" value={summary.purchases} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Timeline ({timeline.length})
            </p>
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground">No recorded activity yet.</p>
            ) : (
              <div className="space-y-0">
                {timeline.map((ev, i) => {
                  const Icon = EVENT_ICONS[ev.type] ?? History;
                  return (
                    <div key={`${ev.type}-${ev.at}-${i}`} className="flex gap-3 relative pb-4 last:pb-0">
                      {i < timeline.length - 1 ? (
                        <span className="absolute left-[13px] top-7 bottom-0 w-px bg-border/60" aria-hidden />
                      ) : null}
                      <span className="w-7 h-7 rounded-full bg-secondary/60 border border-border/60 flex items-center justify-center shrink-0 z-10">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-xs font-medium text-foreground">{ev.title}</p>
                        {ev.detail ? <p className="text-[11px] text-muted-foreground break-words">{ev.detail}</p> : null}
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {fmt(ev.at)}
                          {ev.by ? ` · by ${ev.by}` : ev.executive ? ` · ${ev.executive}` : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
