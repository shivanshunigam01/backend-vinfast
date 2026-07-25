import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BiharDistrictField } from "@/components/BiharDistrictField";
import { ModelTrimSelect } from "@/components/ModelTrimSelect";
import { BIHAR_DEFAULT_DISTRICT } from "@/data/biharDistricts";
import { DEFAULT_VF7_TRIM, leadModelLabel } from "@/data/vinfastModels";
import { formatApiErrors } from "@/lib/api";
import { LEAD_SOURCE_OPTIONS, DEFAULT_LEAD_SOURCE } from "@/data/leadSources";
import {
  createCrmLead,
  type AssignableStaffUser,
  type CrmLead,
  type CreateCrmLeadPayload,
} from "@/lib/leadCrmApi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (lead: CrmLead) => void;
  isExecutive?: boolean;
  canAssignToExecutive?: boolean;
  executives?: AssignableStaffUser[];
};

const emptyForm = () => ({
  name: "",
  mobile: "",
  email: "",
  city: BIHAR_DEFAULT_DISTRICT,
  otherCity: "",
  model: "VF 7",
  variant: DEFAULT_VF7_TRIM,
  source: DEFAULT_LEAD_SOURCE as string,
  remarks: "",
  financeNeeded: false,
  exchangeNeeded: false,
  executiveId: "",
});

export function AddCrmLeadDialog({
  open,
  onOpenChange,
  onCreated,
  isExecutive = false,
  canAssignToExecutive = false,
  executives = [],
}: Props) {
  const [form, setForm] = useState(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const staffUsers = Array.isArray(executives) ? executives : [];

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm(),
      source: DEFAULT_LEAD_SOURCE,
    });
  }, [open, isExecutive]);

  const handleSave = async () => {
    if (!form.name.trim() || form.name.trim().length < 2) {
      toast.error("Enter customer name");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    if (!form.city.trim()) {
      toast.error("Select a city");
      return;
    }
    if (form.city === "Other" && !form.otherCity.trim()) {
      toast.error("Enter city name for Other");
      return;
    }

    const payload: CreateCrmLeadPayload = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim() || undefined,
      city: form.city,
      otherCity: form.city === "Other" ? form.otherCity.trim() : undefined,
      model: leadModelLabel(form.model, form.variant),
      source: form.source,
      remarks: form.remarks.trim() || undefined,
      financeNeeded: form.financeNeeded,
      exchangeNeeded: form.exchangeNeeded,
    };

    if (canAssignToExecutive && form.executiveId) {
      payload.executiveId = form.executiveId;
    }

    setSaving(true);
    try {
      const lead = await createCrmLead(payload);
      toast.success("Lead saved — visible in admin and your lead list");
      onCreated?.(lead);
      onOpenChange(false);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Add New Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Customer name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="bg-secondary/50"
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mobile</Label>
              <Input
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                className="bg-secondary/50"
                placeholder="10-digit number"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Email (optional)</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="bg-secondary/50"
              />
            </div>
            <div className="sm:col-span-2">
              <BiharDistrictField
                label="City / district"
                labelClassName="text-xs"
                value={form.city}
                otherValue={form.otherCity}
                onDistrictChange={(city) => setForm((f) => ({ ...f, city }))}
                onOtherChange={(otherCity) => setForm((f) => ({ ...f, otherCity }))}
                selectClassName="h-10 w-full px-3 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                otherInputClassName="h-10 w-full px-3 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                fullWidthOtherRow
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Model &amp; trim</Label>
              <ModelTrimSelect
                model={form.model}
                variant={form.variant}
                onChange={(model, variant) => setForm((f) => ({ ...f, model, variant }))}
                className="h-10 w-full px-3 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source</Label>
              <Select value={form.source} onValueChange={(source) => setForm((f) => ({ ...f, source }))}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canAssignToExecutive ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Assign to executive (optional)</Label>
                <Select
                  value={form.executiveId || "unassigned"}
                  onValueChange={(v) => setForm((f) => ({ ...f, executiveId: v === "unassigned" ? "" : v }))}
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staffUsers.map((e) => (
                      <SelectItem key={e._id} value={e._id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Remarks (optional)</Label>
            <Textarea
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              className="bg-secondary/50"
              rows={2}
              placeholder="Notes about the customer or conversation"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.financeNeeded}
                onChange={(e) => setForm((f) => ({ ...f, financeNeeded: e.target.checked }))}
                className="rounded"
              />
              Finance needed
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.exchangeNeeded}
                onChange={(e) => setForm((f) => ({ ...f, exchangeNeeded: e.target.checked }))}
                className="rounded"
              />
              Exchange needed
            </label>
          </div>
          {isExecutive ? (
            <p className="text-xs text-muted-foreground">
              This lead will be saved and assigned to you. Admins can see it in the main Leads section.
            </p>
          ) : null}
          <div className="flex gap-3 pt-1">
            <Button onClick={() => void handleSave()} disabled={saving} className="bg-primary text-primary-foreground flex-1">
              {saving ? "Saving…" : "Save Lead"}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1" disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
