import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

const PERIOD_OPTIONS: { value: ReportPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

type Props = {
  value: ReportPeriod;
  onChange: (period: ReportPeriod) => void;
  from?: string;
  to?: string;
  onRangeChange?: (range: { from: string; to: string }) => void;
  className?: string;
};

export default function ReportPeriodPresets({
  value,
  onChange,
  from = "",
  to = "",
  onRangeChange,
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-1.5">
        {PERIOD_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={value === opt.value ? "default" : "outline"}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      {onRangeChange ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="report-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              onChange={(e) => onRangeChange({ from: e.target.value, to })}
              className="w-[160px] bg-background h-9"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="report-to"
              type="date"
              value={to}
              onChange={(e) => onRangeChange({ from, to: e.target.value })}
              className="w-[160px] bg-background h-9"
            />
          </div>
          {(from || to) ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => onRangeChange({ from: "", to: "" })}
            >
              Clear dates
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { PERIOD_OPTIONS };
