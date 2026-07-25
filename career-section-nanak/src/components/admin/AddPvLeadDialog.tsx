import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
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
import { DEFAULT_LEAD_SOURCE } from "@/data/leadSources";
import {
  createPvCrmLead,
  PV_CRM_SOURCES,
  type AssignableStaffUser,
  type CreatePvCrmLeadPayload,
  type PvCrmLead,
} from "@/lib/pvLeadCrmApi";
import { lookupCrmCustomerByMobile, type CustomerHistory } from "@/lib/crmCustomerApi";
import { CustomerHistoryDialog } from "@/components/admin/CustomerHistoryDialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (lead: PvCrmLead) => void;
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
  subCustomerName: "",
  subCustomerMobile: "",
  vehicleRegistration: "",
});

export function AddPvLeadDialog({
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

  // Returning-customer popup: full history shown when a known mobile is entered.
  const [existingHistory, setExistingHistory] = useState<CustomerHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const lookedUpMobileRef = useRef("");

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyForm(),
      source: DEFAULT_LEAD_SOURCE,
    });
    setExistingHistory(null);
    setShowHistory(false);
    lookedUpMobileRef.current = "";
  }, [open, isExecutive]);

  useEffect(() => {
    const mobile = form.mobile.trim();
    if (!open || !/^[6-9]\d{9}$/.test(mobile) || lookedUpMobileRef.current === mobile) return;
    lookedUpMobileRef.current = mobile;
    lookupCrmCustomerByMobile(mobile)
      .then((res) => {
        if (res.existingCustomer) {
          setExistingHistory(res);
          setShowHistory(true);
          setForm((f) => ({
            ...f,
            name: f.name.trim() || res.customer.name,
            email: f.email.trim() || res.customer.email || "",
          }));
        } else {
          setExistingHistory(null);
        }
      })
      .catch(() => setExistingHistory(null));
  }, [open, form.mobile]);

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

    const payload: CreatePvCrmLeadPayload = {
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
      subCustomerName: form.subCustomerName.trim() || undefined,
      subCustomerMobile: form.subCustomerMobile.trim() || undefined,
      vehicleRegistration: form.vehicleRegistration.trim() || undefined,
    };

    if (canAssignToExecutive && form.executiveId) {
      payload.executiveId = form.executiveId;
    }

    setSaving(true);
    try {
      const lead = await createPvCrmLead(payload);
      toast.success(`Lead ${lead.leadId ?? ""} created`);
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Parent customer name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mobile</Label>
              <Input
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                className="bg-secondary/50"
                inputMode="numeric"
              />
              {existingHistory ? (
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <History className="w-3 h-3" />
                  Existing customer {existingHistory.customer.customerId ? `(${existingHistory.customer.customerId})` : ""} — view history
                </button>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email (optional)</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="bg-secondary/50" />
            </div>
            <div className="sm:col-span-2">
              <BiharDistrictField
                label="City / district"
                labelClassName="text-xs"
                value={form.city}
                otherValue={form.otherCity}
                onDistrictChange={(city) => setForm((f) => ({ ...f, city }))}
                onOtherChange={(otherCity) => setForm((f) => ({ ...f, otherCity }))}
                selectClassName="h-10 w-full px-3 rounded-lg bg-secondary/50 border border-border text-sm"
                otherInputClassName="h-10 w-full px-3 rounded-lg bg-secondary/50 border border-border text-sm"
                fullWidthOtherRow
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Model &amp; trim</Label>
              <ModelTrimSelect
                model={form.model}
                variant={form.variant}
                onChange={(model, variant) => setForm((f) => ({ ...f, model, variant }))}
                className="h-10 w-full px-3 rounded-lg bg-secondary/50 border border-border text-sm"
                includeMpv7
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source</Label>
              <Select value={form.source} onValueChange={(source) => setForm((f) => ({ ...f, source }))}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PV_CRM_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canAssignToExecutive ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Assign executive</Label>
                <Select value={form.executiveId || "unassigned"} onValueChange={(v) => setForm((f) => ({ ...f, executiveId: v === "unassigned" ? "" : v }))}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {staffUsers.map((e) => (
                      <SelectItem key={e._id} value={e._id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">Sub-customer (optional)</p>
            <p className="text-[11px] text-muted-foreground">Use when registration is for someone else under the same parent customer.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Sub-customer name</Label>
                <Input value={form.subCustomerName} onChange={(e) => setForm((f) => ({ ...f, subCustomerName: e.target.value }))} className="bg-secondary/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sub-customer mobile</Label>
                <Input value={form.subCustomerMobile} onChange={(e) => setForm((f) => ({ ...f, subCustomerMobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} className="bg-secondary/50" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Vehicle registration (sub-customer)</Label>
                <Input value={form.vehicleRegistration} onChange={(e) => setForm((f) => ({ ...f, vehicleRegistration: e.target.value.toUpperCase() }))} className="bg-secondary/50 uppercase" placeholder="e.g. BR01AB1234" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Remarks</Label>
            <Textarea value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} className="bg-secondary/50" rows={2} />
          </div>

          <div className="flex gap-3">
            <Button onClick={() => void handleSave()} disabled={saving} className="flex-1 bg-primary text-primary-foreground">
              {saving ? "Saving…" : "Save Lead"}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1" disabled={saving}>Cancel</Button>
          </div>
        </div>
      </DialogContent>

      <CustomerHistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
        history={existingHistory}
        headline="Existing customer — full history"
      />
    </Dialog>
  );
}
