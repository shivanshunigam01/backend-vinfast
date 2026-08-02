import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Layers } from "lucide-react";
import { hasApi } from "@/lib/apiConfig";
import { adminDeleteJson, adminGetData, adminPostJson, adminPutJson, formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction, canPerformManagerAction } from "@/lib/adminAuth";
import { setCachedStages, type LeadStageDoc } from "@/lib/leadStages";
import { toast } from "sonner";

const emptyForm = {
  label: "",
  color: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  active: true,
  isTerminal: false,
  isLost: false,
};

const AdminLeadStages = () => {
  const adminUser = getAdminUser();
  const canCreate = canPerformAction(adminUser, "crm_lead_stages", "create");
  const canUpdate = canPerformAction(adminUser, "crm_lead_stages", "update");
  const canDelete = canPerformManagerAction(adminUser, "crm_lead_stages", "delete");

  const [stages, setStages] = useState<LeadStageDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LeadStageDoc | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!hasApi()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await adminGetData<LeadStageDoc[]>("/admin/crm/lead-stages?includeInactive=1");
      const list = Array.isArray(data) ? data : [];
      setStages(list);
      setCachedStages(
        list.filter((s) => s.active).map((s) => s.label),
        list,
      );
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
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (s: LeadStageDoc) => {
    setEditing(s);
    setForm({
      label: s.label,
      color: s.color || emptyForm.color,
      active: s.active,
      isTerminal: Boolean(s.isTerminal),
      isLost: Boolean(s.isLost),
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.label.trim()) {
      toast.error("Label is required");
      return;
    }
    try {
      if (editing) {
        await adminPutJson(`/admin/crm/lead-stages/${editing._id}`, form);
        toast.success("Stage updated");
      } else {
        await adminPostJson("/admin/crm/lead-stages", form);
        toast.success("Stage created");
      }
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const remove = async (s: LeadStageDoc) => {
    if (s.systemProtected) {
      toast.error("Protected stages cannot be deleted");
      return;
    }
    if (!window.confirm(`Delete stage “${s.label}”?`)) return;
    try {
      await adminDeleteJson(`/admin/crm/lead-stages/${s._id}`);
      toast.success("Stage deleted");
      await load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= stages.length) return;
    const ordered = [...stages];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item);
    setStages(ordered);
    try {
      await adminPutJson("/admin/crm/lead-stages/reorder", {
        orderedIds: ordered.map((s) => s._id),
      });
      await load();
    } catch (e) {
      toast.error(formatApiErrors(e));
      await load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6" /> Lead Stages
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage pipeline stages. Active stages appear when creating or updating leads.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add stage
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y">
          {loading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
          {!loading && stages.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No stages found.</p>
          )}
          {stages.map((s, i) => (
            <div key={s._id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className={`text-xs px-2 py-1 rounded-md font-medium ${s.color || ""}`}>{s.label}</span>
              <span className="text-xs text-muted-foreground">key: {s.key}</span>
              {!s.active && <span className="text-xs text-amber-600">Inactive</span>}
              {s.systemProtected && <span className="text-xs text-muted-foreground">Protected</span>}
              <div className="ml-auto flex items-center gap-1">
                {canUpdate && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => void move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void move(i, 1)}
                      disabled={i === stages.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {canDelete && !s.systemProtected && (
                  <Button variant="ghost" size="icon" onClick={() => void remove(s)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit stage" : "New stage"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Hot Prospect"
              />
            </div>
            <div>
              <Label>Color classes (Tailwind)</Label>
              <Input
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.active}
                disabled={Boolean(editing?.systemProtected) && form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
            {!editing?.systemProtected && (
              <>
                <div className="flex items-center justify-between">
                  <Label>Terminal (won/closed)</Label>
                  <Switch
                    checked={form.isTerminal}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isTerminal: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Lost-style</Label>
                  <Switch
                    checked={form.isLost}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, isLost: v }))}
                  />
                </div>
              </>
            )}
            <Button className="w-full" onClick={() => void save()}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeadStages;
