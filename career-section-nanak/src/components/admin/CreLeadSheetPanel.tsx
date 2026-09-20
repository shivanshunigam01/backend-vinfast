import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  type CreSheetFollowUpSlot,
  type PvCrmLead,
  updatePvCrmLeadCreSheet,
} from "@/lib/pvLeadCrmApi";

type YesNo = "" | "YES" | "NO";

function toDateInput(v: unknown): string {
  if (!v) return "";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function toYesNo(v: unknown): YesNo {
  if (v === true) return "YES";
  if (v === false) return "NO";
  return "";
}

function emptySlots(): CreSheetFollowUpSlot[] {
  return [
    { creDate: "", creRemark: "", salesDate: "", salesRemark: "" },
    { creDate: "", creRemark: "", salesDate: "", salesRemark: "" },
    { creDate: "", creRemark: "", salesDate: "", salesRemark: "" },
  ];
}

function mapSlots(slots?: CreSheetFollowUpSlot[]): CreSheetFollowUpSlot[] {
  const base = emptySlots();
  if (!Array.isArray(slots)) return base;
  return base.map((row, i) => {
    const s = slots[i];
    if (!s) return row;
    return {
      creDate: toDateInput(s.creDate),
      creRemark: s.creRemark || "",
      salesDate: toDateInput(s.salesDate),
      salesRemark: s.salesRemark || "",
    };
  });
}

type Props = {
  lead: PvCrmLead;
  followUpSlots?: CreSheetFollowUpSlot[];
  canEdit: boolean;
  onSaved: () => void | Promise<void>;
};

export function CreLeadSheetPanel({ lead, followUpSlots, canEdit, onSaved }: Props) {
  const cs = (lead.creSheet || {}) as Record<string, unknown>;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enquiryDate: toDateInput(cs.enquiryDate || lead.createdAt),
    callDate: toDateInput(cs.callDate),
    existingVariant: String(cs.existingVariant || ""),
    followUp: String(cs.followUp || lead.leadType || ""),
    salesConsultant: String(cs.salesConsultantName || lead.assignedTo?.name || ""),
    salesConsultantDate: toDateInput(cs.salesConsultantDate || cs.salesPersonDate),
    salesPersonRemark: String(cs.salesPersonRemark || ""),
    tdDate: toDateInput(cs.tdDate),
    tdDone: toYesNo(cs.tdDone),
    tdNotDoneWhy: String(cs.tdNotDoneWhy || ""),
    afterTdRemark: String(cs.afterTdRemark || ""),
    initialRemark: String(cs.initialRemark || ""),
    bookingDone: toYesNo(cs.bookingDone),
    bookingDate: toDateInput(cs.bookingDate),
    finalModel: String(cs.finalModel || ""),
    finalVariant: String(cs.finalVariant || ""),
    finalColour: String(cs.finalColour || ""),
    mailSent: toYesNo(cs.mailSent),
    exchange: lead.exchangeNeeded ? "YES" : toYesNo(false),
    retailDone: toYesNo(cs.retailDone),
    retailDate: toDateInput(cs.retailDate),
    deliveryDate: toDateInput(cs.deliveryDate),
    slots: mapSlots(followUpSlots),
  });

  useEffect(() => {
    const next = (lead.creSheet || {}) as Record<string, unknown>;
    setForm({
      enquiryDate: toDateInput(next.enquiryDate || lead.createdAt),
      callDate: toDateInput(next.callDate),
      existingVariant: String(next.existingVariant || ""),
      followUp: String(next.followUp || lead.leadType || ""),
      salesConsultant: String(next.salesConsultantName || lead.assignedTo?.name || ""),
      salesConsultantDate: toDateInput(next.salesConsultantDate || next.salesPersonDate),
      salesPersonRemark: String(next.salesPersonRemark || ""),
      tdDate: toDateInput(next.tdDate),
      tdDone: toYesNo(next.tdDone),
      tdNotDoneWhy: String(next.tdNotDoneWhy || ""),
      afterTdRemark: String(next.afterTdRemark || ""),
      initialRemark: String(next.initialRemark || ""),
      bookingDone: toYesNo(next.bookingDone),
      bookingDate: toDateInput(next.bookingDate),
      finalModel: String(next.finalModel || ""),
      finalVariant: String(next.finalVariant || ""),
      finalColour: String(next.finalColour || ""),
      mailSent: toYesNo(next.mailSent),
      exchange: lead.exchangeNeeded ? "YES" : toYesNo(false),
      retailDone: toYesNo(next.retailDone),
      retailDate: toDateInput(next.retailDate),
      deliveryDate: toDateInput(next.deliveryDate),
      slots: mapSlots(followUpSlots),
    });
  }, [lead._id, lead.creSheet, lead.leadType, lead.exchangeNeeded, lead.assignedTo?.name, lead.createdAt, followUpSlots]);

  const setSlot = (idx: number, patch: Partial<CreSheetFollowUpSlot>) => {
    setForm((f) => ({
      ...f,
      slots: f.slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePvCrmLeadCreSheet(lead._id, {
        followUp: form.followUp,
        salesConsultant: form.salesConsultant,
        exchangeNeeded: form.exchange === "YES",
        followUpSlots: form.slots,
        creSheet: {
          enquiryDate: form.enquiryDate || undefined,
          callDate: form.callDate || undefined,
          existingVariant: form.existingVariant || undefined,
          followUp: form.followUp || undefined,
          salesConsultantName: form.salesConsultant || undefined,
          salesConsultantDate: form.salesConsultantDate || undefined,
          salesPersonDate: form.salesConsultantDate || undefined,
          salesPersonRemark: form.salesPersonRemark || undefined,
          initialRemark: form.initialRemark || undefined,
          tdDate: form.tdDate || undefined,
          tdDone: form.tdDone === "" ? undefined : form.tdDone === "YES",
          tdNotDoneWhy: form.tdNotDoneWhy || undefined,
          afterTdRemark: form.afterTdRemark || undefined,
          bookingDone: form.bookingDone === "" ? undefined : form.bookingDone === "YES",
          bookingDate: form.bookingDate || undefined,
          finalModel: form.finalModel || undefined,
          finalVariant: form.finalVariant || undefined,
          finalColour: form.finalColour || undefined,
          mailSent: form.mailSent === "" ? undefined : form.mailSent === "YES",
          retailDone: form.retailDone === "" ? undefined : form.retailDone === "YES",
          retailDate: form.retailDate || undefined,
          deliveryDate: form.deliveryDate || undefined,
        },
      });
      toast.success("CRE sheet saved");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save CRE sheet");
    } finally {
      setSaving(false);
    }
  };

  const yesNoField = (
    label: string,
    value: YesNo,
    onChange: (v: YesNo) => void,
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value || "unset"} onValueChange={(v) => onChange(v === "unset" ? "" : (v as YesNo))} disabled={!canEdit}>
        <SelectTrigger className="bg-secondary/50 h-9"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="unset">—</SelectItem>
          <SelectItem value="YES">YES</SelectItem>
          <SelectItem value="NO">NO</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        All columns from the bulk-upload sheet. Source: <strong>{lead.source || "—"}</strong> · Model:{" "}
        <strong>
          {lead.model === "Both" && Array.isArray(lead.interestedModels) && lead.interestedModels.length
            ? `Both (${lead.interestedModels.join(", ")})`
            : lead.model}
        </strong>
        {" "}· Dates can be set to any past day.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">ENQUIRY DATE</Label>
          <Input type="date" value={form.enquiryDate} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, enquiryDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">CALL DATE</Label>
          <Input type="date" value={form.callDate} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, callDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">EXISTING VARIANT</Label>
          <Input value={form.existingVariant} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, existingVariant: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">FOLLOW-UP</Label>
          <Input value={form.followUp} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, followUp: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">INITIAL REMARK</Label>
          <Textarea value={form.initialRemark} disabled={!canEdit} rows={2} className="bg-secondary/50" onChange={(e) => setForm({ ...form, initialRemark: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">SALES CONSULTANT</Label>
          <Input value={form.salesConsultant} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, salesConsultant: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Sales Consultant DATE</Label>
          <Input type="date" value={form.salesConsultantDate} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, salesConsultantDate: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">SALES PERSON REMARK</Label>
          <Textarea value={form.salesPersonRemark} disabled={!canEdit} rows={2} className="bg-secondary/50" onChange={(e) => setForm({ ...form, salesPersonRemark: e.target.value })} />
        </div>
      </div>

      <div className="rounded-lg border border-border/50 p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Test drive</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">TD Date</Label>
            <Input type="date" value={form.tdDate} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, tdDate: e.target.value })} />
          </div>
          {yesNoField("TD DONE YES/NO", form.tdDone, (tdDone) => setForm({ ...form, tdDone }))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">TD NOT DONE, WHY?</Label>
            <Input value={form.tdNotDoneWhy} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, tdNotDoneWhy: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">AFTER TD REMARK</Label>
            <Textarea value={form.afterTdRemark} disabled={!canEdit} rows={2} className="bg-secondary/50" onChange={(e) => setForm({ ...form, afterTdRemark: e.target.value })} />
          </div>
        </div>
      </div>

      {[0, 1, 2].map((idx) => (
        <div key={idx} className="rounded-lg border border-border/50 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-up #{idx + 1}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">CRE Follow up call {idx + 1} Date</Label>
              <Input type="date" value={form.slots[idx].creDate || ""} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setSlot(idx, { creDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">CRE Follow up call remark {idx + 1}</Label>
              <Input value={form.slots[idx].creRemark || ""} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setSlot(idx, { creRemark: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sales Person Follow up call {idx + 1} Date</Label>
              <Input type="date" value={form.slots[idx].salesDate || ""} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setSlot(idx, { salesDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sales Person Follow up call remark {idx + 1}</Label>
              <Input value={form.slots[idx].salesRemark || ""} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setSlot(idx, { salesRemark: e.target.value })} />
            </div>
          </div>
        </div>
      ))}

      <div className="rounded-lg border border-border/50 p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking & delivery</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {yesNoField("BOOKING DONE YES/NO", form.bookingDone, (bookingDone) => setForm({ ...form, bookingDone }))}
          <div className="space-y-1.5">
            <Label className="text-xs">BOOKING DATE</Label>
            <Input type="date" value={form.bookingDate} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, bookingDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">FINAL MODEL</Label>
            <Input value={form.finalModel} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, finalModel: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">FINAL VARIANT</Label>
            <Input value={form.finalVariant} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, finalVariant: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">FINAL COLOUR</Label>
            <Input value={form.finalColour} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, finalColour: e.target.value })} />
          </div>
          {yesNoField("MAIL SENT YES/NO", form.mailSent, (mailSent) => setForm({ ...form, mailSent }))}
          {yesNoField("EXCHANGE YES/NO", form.exchange, (exchange) => setForm({ ...form, exchange }))}
          {yesNoField("RETAIL DONE YES/NO", form.retailDone, (retailDone) => setForm({ ...form, retailDone }))}
          <div className="space-y-1.5">
            <Label className="text-xs">RETAIL DATE</Label>
            <Input type="date" value={form.retailDate} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, retailDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">DELIVERY DATE</Label>
            <Input type="date" value={form.deliveryDate} disabled={!canEdit} className="bg-secondary/50 h-9" onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
          </div>
        </div>
      </div>

      {canEdit ? (
        <Button className="w-full" disabled={saving} onClick={() => void handleSave()}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save CRE sheet
        </Button>
      ) : null}
    </div>
  );
}
