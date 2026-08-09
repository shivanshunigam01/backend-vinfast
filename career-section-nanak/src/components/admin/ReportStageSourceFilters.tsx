import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCrmLeadStages } from "@/hooks/useCrmLeadStages";
import { LEAD_SOURCE_OPTIONS } from "@/data/leadSources";

const SYSTEM_SOURCES = ["Test Drive", "Enquiry"] as const;

type Props = {
  status: string;
  source: string;
  onStatusChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  /** When false, hide stage picker (e.g. Delivery Reports). Default true. */
  showStage?: boolean;
  className?: string;
};

/**
 * Shared Stage + Source filters for Lead-based report pages.
 */
export default function ReportStageSourceFilters({
  status,
  source,
  onStatusChange,
  onSourceChange,
  showStage = true,
  className,
}: Props) {
  const { stages } = useCrmLeadStages();
  const sources = [...LEAD_SOURCE_OPTIONS, ...SYSTEM_SOURCES];

  return (
    <div className={className ?? "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
      {showStage ? (
        <div className="space-y-1.5 min-w-0">
          <Label className="text-xs">Stage</Label>
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="w-full bg-secondary/50">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="space-y-1.5 min-w-0">
        <Label className="text-xs">Source</Label>
        <Select value={source} onValueChange={onSourceChange}>
          <SelectTrigger className="w-full bg-secondary/50">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
