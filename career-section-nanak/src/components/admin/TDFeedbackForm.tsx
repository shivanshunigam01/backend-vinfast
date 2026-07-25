import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Star } from "lucide-react";
import { submitTDFeedback, type TDFeedbackRecord } from "@/lib/tdFeedbackApi";
import { toast } from "sonner";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";

export const RATING_FIELDS = [
  { key: "drivingExperience", label: "Driving experience" },
  { key: "vehicleComfort", label: "Vehicle comfort" },
  { key: "batteryConfidence", label: "Battery confidence" },
  { key: "executiveBehaviour", label: "Executive behaviour" },
  { key: "purchaseIntention", label: "Purchase intention" },
] as const;

export type RatingKey = (typeof RATING_FIELDS)[number]["key"];

type Props = {
  bookingId: string;
  customerId?: string;
  preferredModel?: string;
  existing?: TDFeedbackRecord | null;
  onSubmitted?: () => void;
};

/** Fallback trim list when the booking's model isn't in the catalog. */
export const FEEDBACK_VARIANTS = ["Earth", "Wind", "Wind Infinity", "Sky", "Sky Infinity"];

/** Trims for the booking's model from the master catalog (falls back to the static list). */
export function useFeedbackVariantChoices(preferredModel?: string): string[] {
  const { catalog } = useVehicleCatalog();
  const entry = preferredModel ? catalog.find((m) => m.name === preferredModel) : undefined;
  return entry ? entry.variants : [...FEEDBACK_VARIANTS];
}

export function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`p-1.5 rounded border transition-colors ${
              value >= n
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:border-primary/40"
            }`}
            title={`${n}/5`}
          >
            <Star className={`w-3.5 h-3.5 ${value >= n ? "fill-current" : ""}`} />
          </button>
        ))}
        <span className="text-xs text-muted-foreground self-center ml-1">{value}/5</span>
      </div>
    </div>
  );
}

export function TDFeedbackForm({ bookingId, customerId, preferredModel, existing, onSubmitted }: Props) {
  const variantChoices = useFeedbackVariantChoices(preferredModel);
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    drivingExperience: existing?.drivingExperience ?? 4,
    vehicleComfort: existing?.vehicleComfort ?? 4,
    batteryConfidence: existing?.batteryConfidence ?? 4,
    executiveBehaviour: existing?.executiveBehaviour ?? 5,
    purchaseIntention: existing?.purchaseIntention ?? 4,
  });
  const [preferredVariant, setPreferredVariant] = useState(existing?.preferredVariant ?? "");
  const [remarks, setRemarks] = useState(existing?.remarks ?? "");
  const [saving, setSaving] = useState(false);

  if (existing) {
    return (
      <div className="rounded-lg border border-green-400/30 bg-green-400/5 p-4 space-y-2 text-sm">
        <p className="font-medium text-green-400">Customer feedback recorded</p>
        <p className="text-xs text-muted-foreground">
          Overall rating: {existing.overallRating ?? "—"}/5 · Purchase intent: {existing.purchaseIntention ?? "—"}/5
        </p>
        {existing.remarks && <p className="text-xs text-muted-foreground">{existing.remarks}</p>}
        <p className="text-xs text-muted-foreground">This customer is synced to the Leads module.</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const result = await submitTDFeedback({
        bookingId,
        customerId,
        ...ratings,
        preferredVariant: preferredVariant || undefined,
        remarks: remarks.trim() || undefined,
      });
      toast.success(result.message ?? "Feedback saved — customer added to Leads");
      onSubmitted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save feedback");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Customer feedback</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          After completing the test drive, capture feedback. The customer will automatically appear in Leads.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {RATING_FIELDS.map(({ key, label }) => (
          <RatingRow
            key={key}
            label={label}
            value={ratings[key]}
            onChange={(v) => setRatings((prev) => ({ ...prev, [key]: v }))}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Preferred variant</Label>
        <Select value={preferredVariant || "none"} onValueChange={(v) => setPreferredVariant(v === "none" ? "" : v)}>
          <SelectTrigger className="bg-secondary/50 h-9">
            <SelectValue placeholder={preferredModel ? `Trim for ${preferredModel}` : "Select trim"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Not specified —</SelectItem>
            {variantChoices.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Remarks</Label>
        <Textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="bg-secondary/50"
          rows={2}
          placeholder="Customer comments, follow-up notes..."
        />
      </div>

      <Button className="w-full" disabled={saving} onClick={() => void handleSubmit()}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        Save feedback &amp; create lead
      </Button>
    </div>
  );
}
