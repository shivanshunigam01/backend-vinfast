import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Car, Plus, Loader2, RefreshCw, Pencil, Trash2, GripVertical, X } from "lucide-react";
import { toast } from "sonner";
import { formatApiErrors } from "@/lib/api";
import {
  createVehicleModel,
  deleteVehicleModel,
  fetchAdminVehicleModels,
  updateVehicleModel,
  type AdminVehicleModel,
} from "@/lib/vehicleCatalogApi";
import { invalidateVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { getAdminUser, canPerformAction, canPerformManagerAction } from "@/lib/adminAuth";

type VariantDraft = { name: string; active: boolean };

type FormState = {
  _id?: string;
  name: string;
  active: boolean;
  displayOrder: number;
  variants: VariantDraft[];
};

const emptyForm: FormState = { name: "", active: true, displayOrder: 0, variants: [] };

export default function AdminVehicleModels() {
  const adminUser = getAdminUser();
  const canCreate = canPerformAction(adminUser, "td_models", "create");
  const canUpdate = canPerformAction(adminUser, "td_models", "update");
  const canDelete = canPerformManagerAction(adminUser, "td_models", "delete");
  const [models, setModels] = useState<AdminVehicleModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newVariant, setNewVariant] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminVehicleModel | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setModels(await fetchAdminVehicleModels());
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const openCreate = () => {
    setForm({ ...emptyForm, displayOrder: models.length + 1 });
    setNewVariant("");
    setShowForm(true);
  };

  const openEdit = (m: AdminVehicleModel) => {
    setForm({
      _id: m._id,
      name: m.name,
      active: m.active,
      displayOrder: m.displayOrder,
      variants: m.variants.map((v) => ({ name: v.name, active: v.active })),
    });
    setNewVariant("");
    setShowForm(true);
  };

  const addVariant = () => {
    const name = newVariant.trim();
    if (!name) return;
    if (form.variants.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`Variant "${name}" is already in the list`);
      return;
    }
    setForm((p) => ({ ...p, variants: [...p.variants, { name, active: true }] }));
    setNewVariant("");
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Enter the model name");
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        name,
        active: form.active,
        displayOrder: form.displayOrder,
        variants: form.variants.map((v, i) => ({ name: v.name, active: v.active, displayOrder: i + 1 })),
      };
      if (form._id) {
        await updateVehicleModel(form._id, payload);
        toast.success("Model updated");
      } else {
        await createVehicleModel(payload);
        toast.success("Model created");
      }
      invalidateVehicleCatalog();
      setShowForm(false);
      void fetchData();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteVehicleModel(deleteTarget._id);
      toast.success(`Model "${deleteTarget.name}" deleted`);
      invalidateVehicleCatalog();
      setDeleteTarget(null);
      void fetchData();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="w-6 h-6 text-primary" /> Model Master
          </h1>
          <p className="text-muted-foreground text-sm">
            {models.length} model(s) · drives test drive dropdowns, demo fleet tagging, and form validation
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void fetchData()} variant="outline" size="sm"><RefreshCw className="w-4 h-4" /></Button>
          {canCreate ? (
            <Button onClick={openCreate} size="sm" className="bg-primary text-primary-foreground">
              <Plus className="w-4 h-4 mr-2" /> Add Model
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20 p-4 text-sm text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-1">How the master works</p>
        Models and variants added here appear in the website test drive form (model first, then its variants),
        the demo fleet vehicle tagging, and booking edit dialogs. Mark a model or variant inactive to hide it
        from dropdowns without losing history.
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading models...
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Car className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>No models yet — add the first one.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {models.map((m) => (
            <Card key={m._id} className={`bg-card border-border/50 p-4 space-y-3 ${m.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground text-lg">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Display order {m.displayOrder} · {m.variants.length ? `${m.variants.length} variant(s)` : "single lineup"}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={m.active
                    ? "bg-green-400/10 text-green-400 border-green-400/20"
                    : "bg-gray-400/10 text-gray-400 border-gray-400/20"}
                >
                  {m.active ? "Active" : "Inactive"}
                </Badge>
              </div>

              {m.variants.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {m.variants.map((v) => (
                    <Badge
                      key={v.name}
                      variant="outline"
                      className={v.active
                        ? "bg-secondary/50 text-foreground border-border/50"
                        : "bg-secondary/20 text-muted-foreground border-border/30 line-through"}
                    >
                      {v.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No variants — shown as a single lineup.</p>
              )}

              <div className="flex gap-1.5 border-t border-border/30 pt-3">
                {canUpdate ? (
                  <Button size="sm" variant="ghost" className="flex-1 text-xs h-8" onClick={() => openEdit(m)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-xs h-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(m)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form._id ? `Edit ${form.name || "model"}` : "Add Model"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Model name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="bg-secondary/50"
                  placeholder="e.g. VF 9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Display order</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.displayOrder}
                  onChange={(e) => setForm((p) => ({ ...p, displayOrder: Number(e.target.value) }))}
                  className="bg-secondary/50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-[11px] text-muted-foreground">Inactive models are hidden from all dropdowns.</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm((p) => ({ ...p, active: v }))} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Variants (trims)</Label>
              {form.variants.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No variants — the model is offered as a single lineup.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {form.variants.map((v, i) => (
                    <div key={`${v.name}-${i}`} className="flex items-center gap-2 rounded-md border border-border/50 bg-secondary/20 px-2 py-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className={`flex-1 text-sm ${v.active ? "" : "text-muted-foreground line-through"}`}>{v.name}</span>
                      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Switch
                          checked={v.active}
                          onCheckedChange={(checked) =>
                            setForm((p) => ({
                              ...p,
                              variants: p.variants.map((row, j) => (j === i ? { ...row, active: checked } : row)),
                            }))
                          }
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive p-1"
                        onClick={() =>
                          setForm((p) => ({ ...p, variants: p.variants.filter((_, j) => j !== i) }))
                        }
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newVariant}
                  onChange={(e) => setNewVariant(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addVariant();
                    }
                  }}
                  className="bg-secondary/50"
                  placeholder="e.g. Sky Infinity"
                />
                <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" onClick={addVariant}>
                  <Plus className="w-4 h-4 mr-1" /> Add variant
                </Button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => void handleSave()} disabled={actionLoading} className="flex-1 bg-primary text-primary-foreground">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Delete model</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{deleteTarget?.name}</span> from the master?
            This is blocked if demo vehicles are tagged with it — mark it inactive instead to hide it while
            keeping history.
          </p>
          <div className="flex gap-3">
            <Button variant="destructive" className="flex-1" disabled={actionLoading} onClick={() => void handleDelete()}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Delete
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
