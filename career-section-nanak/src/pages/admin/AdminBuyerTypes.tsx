import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Briefcase } from "lucide-react";
import { hasApi } from "@/lib/apiConfig";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction, canPerformManagerAction } from "@/lib/adminAuth";
import {
  createBuyerType,
  deleteBuyerType,
  fetchBuyerTypes,
  reorderBuyerTypes,
  updateBuyerType,
  type BuyerTypeDoc,
} from "@/lib/buyerTypesApi";
import { toast } from "sonner";

const emptyForm = { label: "", active: true };

const AdminBuyerTypes = () => {
  const adminUser = getAdminUser();
  const canCreate = canPerformAction(adminUser, "crm_buyer_types", "create") || canPerformAction(adminUser, "crm_lead_stages", "create");
  const canUpdate = canPerformAction(adminUser, "crm_buyer_types", "update") || canPerformAction(adminUser, "crm_lead_stages", "update");
  const canDelete = canPerformManagerAction(adminUser, "crm_buyer_types", "delete") || canPerformManagerAction(adminUser, "crm_lead_stages", "delete");

  const [rows, setRows] = useState<BuyerTypeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BuyerTypeDoc | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!hasApi()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await fetchBuyerTypes(true));
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form.label.trim()) {
      toast.error("Label is required");
      return;
    }
    try {
      if (editing) {
        await updateBuyerType(editing._id, form);
        toast.success("Buyer type updated");
      } else {
        await createBuyerType({ label: form.label.trim(), active: form.active });
        toast.success("Buyer type created");
      }
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const remove = async (s: BuyerTypeDoc) => {
    if (s.systemProtected) {
      toast.error("Protected types cannot be deleted");
      return;
    }
    if (!window.confirm(`Delete buyer type “${s.label}”?`)) return;
    try {
      await deleteBuyerType(s._id);
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= rows.length) return;
    const ordered = [...rows];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item);
    setRows(ordered);
    try {
      await reorderBuyerTypes(ordered.map((r) => r._id));
    } catch (e) {
      toast.error(formatApiErrors(e));
      await load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary" /> Buyer Type Master
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Used on Lead CRM listing and Action Centre.</p>
        </div>
        {canCreate ? (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setShowForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add type
          </Button>
        ) : null}
      </div>

      <Card className="p-4 space-y-2">
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {rows.map((s, i) => (
          <div key={s._id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-[11px] text-muted-foreground">{s.key}{s.active ? "" : " · inactive"}</p>
            </div>
            {canUpdate ? (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void move(i, -1)}><ArrowUp className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void move(i, 1)}><ArrowDown className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(s); setForm({ label: s.label, active: s.active }); setShowForm(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            ) : null}
            {canDelete && !s.systemProtected ? (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => void remove(s)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            ) : null}
          </div>
        ))}
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit buyer type" : "New buyer type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              Active
            </label>
            <Button onClick={() => void save()}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBuyerTypes;
