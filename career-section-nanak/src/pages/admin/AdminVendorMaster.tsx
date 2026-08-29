import { useCallback, useEffect, useState } from "react";
import { Building2, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import {
  createVendor,
  deleteVendor,
  fetchVendors,
  updateVendor,
  type Vendor,
} from "@/lib/stockVendorsApi";

const emptyForm = () => ({
  name: "",
  legalName: "",
  type: "OEM",
  gstin: "",
  pan: "",
  contactPerson: "",
  phone: "",
  email: "",
  paymentTermsDefault: "Advance",
  active: true,
});

export default function AdminVendorMaster() {
  const admin = getAdminUser();
  const canCreate = canPerformAction(admin, "stock_vendors", "create") || canPerformAction(admin, "stock_config", "update");
  const canUpdate = canPerformAction(admin, "stock_vendors", "update") || canPerformAction(admin, "stock_config", "update");
  const canDelete = canPerformAction(admin, "stock_vendors", "delete") || canPerformAction(admin, "stock_config", "update");

  const [rows, setRows] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchVendors(true));
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (row: Vendor) => {
    setEditing(row);
    setForm({
      name: row.name,
      legalName: row.legalName ?? "",
      type: row.type ?? "OEM",
      gstin: row.gstin ?? "",
      pan: row.pan ?? "",
      contactPerson: row.contactPerson ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
      paymentTermsDefault: row.paymentTermsDefault ?? "Advance",
      active: row.active !== false,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Vendor name is required");
    try {
      const body = { ...form, name: form.name.trim(), legalName: form.legalName.trim() || undefined };
      if (editing) {
        await updateVendor(editing._id, body);
        toast.success("Vendor updated");
      } else {
        await createVendor(body);
        toast.success("Vendor created");
      }
      setOpen(false);
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const remove = async (row: Vendor) => {
    if (row.systemProtected) return toast.error("Protected vendor cannot be deleted");
    if (!window.confirm(`Delete vendor “${row.name}”?`)) return;
    try {
      await deleteVendor(row._id);
      toast.success("Vendor deleted");
      void load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Vendor Master
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            OEM and supplier companies used on purchase orders across the stock pipeline
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
          {canCreate ? (
            <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add vendor</Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground border-dashed">No vendors yet.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <Card key={row._id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  {row.legalName ? <p className="text-xs text-muted-foreground">{row.legalName}</p> : null}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary">{row.type || "OEM"}</Badge>
                    {!row.active ? <Badge variant="outline">Inactive</Badge> : null}
                    {row.systemProtected ? <Badge variant="outline">Protected</Badge> : null}
                  </div>
                </div>
                <div className="flex gap-1">
                  {canUpdate ? (
                    <Button size="icon" variant="ghost" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                  ) : null}
                  {canDelete && !row.systemProtected ? (
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void remove(row)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
              {row.gstin ? <p className="text-xs text-muted-foreground">GSTIN: {row.gstin}</p> : null}
              {row.contactPerson ? <p className="text-xs text-muted-foreground">Contact: {row.contactPerson}</p> : null}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit vendor" : "New vendor"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Legal name</Label><Input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["OEM", "TRANSPORTER", "ACCESSORY", "OTHER"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
              <div><Label>PAN</Label><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} /></div>
            </div>
            <div><Label>Contact person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Default payment terms</Label><Input value={form.paymentTermsDefault} onChange={(e) => setForm({ ...form, paymentTermsDefault: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Active</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
