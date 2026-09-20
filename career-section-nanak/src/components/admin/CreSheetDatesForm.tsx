import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CreSheetFollowUpSlot } from "@/lib/pvLeadCrmApi";

/** All CRE sheet date columns — past dates allowed (no min/max). */
export type CreSheetDatesValue = {
  enquiryDate: string;
  callDate: string;
  salesConsultantDate: string;
  tdDate: string;
  bookingDate: string;
  retailDate: string;
  deliveryDate: string;
  slots: CreSheetFollowUpSlot[];
};

export function emptyCreSheetDates(): CreSheetDatesValue {
  return {
    enquiryDate: "",
    callDate: "",
    salesConsultantDate: "",
    tdDate: "",
    bookingDate: "",
    retailDate: "",
    deliveryDate: "",
    slots: [
      { creDate: "", creRemark: "", salesDate: "", salesRemark: "" },
      { creDate: "", creRemark: "", salesDate: "", salesRemark: "" },
      { creDate: "", creRemark: "", salesDate: "", salesRemark: "" },
    ],
  };
}

export function creSheetDatesToPayload(value: CreSheetDatesValue) {
  const creSheet: Record<string, string | undefined> = {};
  if (value.enquiryDate) creSheet.enquiryDate = value.enquiryDate;
  if (value.callDate) creSheet.callDate = value.callDate;
  if (value.salesConsultantDate) {
    creSheet.salesConsultantDate = value.salesConsultantDate;
    creSheet.salesPersonDate = value.salesConsultantDate;
  }
  if (value.tdDate) creSheet.tdDate = value.tdDate;
  if (value.bookingDate) creSheet.bookingDate = value.bookingDate;
  if (value.retailDate) creSheet.retailDate = value.retailDate;
  if (value.deliveryDate) creSheet.deliveryDate = value.deliveryDate;

  const followUpSlots = value.slots.map((s) => ({
    creDate: s.creDate || undefined,
    creRemark: s.creRemark || undefined,
    salesDate: s.salesDate || undefined,
    salesRemark: s.salesRemark || undefined,
  }));

  return {
    creSheet: Object.keys(creSheet).length ? creSheet : undefined,
    followUpSlots: followUpSlots.some(
      (s) => s.creDate || s.creRemark || s.salesDate || s.salesRemark,
    )
      ? followUpSlots
      : undefined,
  };
}

type Props = {
  value: CreSheetDatesValue;
  onChange: (next: CreSheetDatesValue) => void;
  disabled?: boolean;
  compact?: boolean;
};

function DateField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="date"
        value={value}
        disabled={disabled}
        className="bg-secondary/50 h-9"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function CreSheetDatesForm({ value, onChange, disabled, compact }: Props) {
  const set = (patch: Partial<CreSheetDatesValue>) => onChange({ ...value, ...patch });
  const setSlot = (idx: number, patch: Partial<CreSheetFollowUpSlot>) => {
    set({
      slots: value.slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });
  };

  return (
    <div className="space-y-4">
      {!compact ? (
        <p className="text-[11px] text-muted-foreground">
          All sheet dates can be set to past days (enquiry, call, TD, booking, etc.).
        </p>
      ) : null}
      <div className="grid sm:grid-cols-2 gap-3">
        <DateField label="ENQUIRY DATE" value={value.enquiryDate} disabled={disabled} onChange={(enquiryDate) => set({ enquiryDate })} />
        <DateField label="CALL DATE" value={value.callDate} disabled={disabled} onChange={(callDate) => set({ callDate })} />
        <DateField label="Sales Consultant DATE" value={value.salesConsultantDate} disabled={disabled} onChange={(salesConsultantDate) => set({ salesConsultantDate })} />
        <DateField label="TD Date" value={value.tdDate} disabled={disabled} onChange={(tdDate) => set({ tdDate })} />
        <DateField label="BOOKING DATE" value={value.bookingDate} disabled={disabled} onChange={(bookingDate) => set({ bookingDate })} />
        <DateField label="RETAIL DATE" value={value.retailDate} disabled={disabled} onChange={(retailDate) => set({ retailDate })} />
        <DateField label="DELIVERY DATE" value={value.deliveryDate} disabled={disabled} onChange={(deliveryDate) => set({ deliveryDate })} />
      </div>
      {[0, 1, 2].map((idx) => (
        <div key={idx} className="rounded-lg border border-border/50 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Follow-up #{idx + 1} dates
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <DateField
              label={`CRE Follow up call ${idx + 1} Date`}
              value={value.slots[idx]?.creDate || ""}
              disabled={disabled}
              onChange={(creDate) => setSlot(idx, { creDate })}
            />
            <DateField
              label={`Sales Person Follow up call ${idx + 1} Date`}
              value={value.slots[idx]?.salesDate || ""}
              disabled={disabled}
              onChange={(salesDate) => setSlot(idx, { salesDate })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
