import { useCallback, useEffect, useState } from "react";
import { adminDeleteJson, adminGet, adminPostJson, adminPutJson, formatApiErrors } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Edit2, Trash2, ShieldCheck, RefreshCw, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  MODULE_GROUPS,
  modulesForGroup,
  actionToken,
  ACTION_LABELS,
  allActionTokensForModules,
  type AdminModuleKey,
  type AdminModuleAction,
} from "@/lib/adminModules";
import { getAdminUser, canPerformManagerAction } from "@/lib/adminAuth";

export type StaffRoleTemplate = {
  _id: string;
  name: string;
  description?: string;
  authRole: "executive" | "manager";
  allowedModules: string[];
  allowedActions: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const emptyForm = {
  name: "",
  description: "",
  authRole: "executive" as "executive" | "manager",
  allowedModules: [] as AdminModuleKey[],
  allowedActions: [] as string[],
  active: true,
};

export default function AdminTDRoles() {
  const adminUser = getAdminUser();
  const canCreate = canPerformManagerAction(adminUser, "td_users", "create");
  const canUpdate = canPerformManagerAction(adminUser, "td_users", "update");
  const canDelete = canPerformManagerAction(adminUser, "td_users", "delete");

  const [roles, setRoles] = useState<StaffRoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof emptyForm & { _id?: string }>(emptyForm);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffRoleTemplate | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await adminGet<StaffRoleTemplate[]>("/admin/td/roles");
      setRoles(data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  const openCreate = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (role: StaffRoleTemplate) => {
    setForm({
      _id: role._id,
      name: role.name,
      description: role.description || "",
      authRole: role.authRole === "manager" ? "manager" : "executive",
      allowedModules: (role.allowedModules ?? []) as AdminModuleKey[],
      allowedActions: role.allowedActions ?? [],
      active: role.active,
    });
    setShowForm(true);
  };

  const toggleModule = (key: AdminModuleKey, checked: boolean) => {
    setForm((f) => {
      if (checked) {
        const modules = [...new Set([...f.allowedModules, key])];
        const moduleTokens = allActionTokensForModules([key]);
        const actions = [...new Set([...f.allowedActions, ...moduleTokens])];
        return { ...f, allowedModules: modules, allowedActions: actions };
      }
      return {
        ...f,
        allowedModules: f.allowedModules.filter((m) => m !== key),
        allowedActions: f.allowedActions.filter((a) => !a.startsWith(`${key}:`)),
      };
    });
  };

  const toggleAction = (key: AdminModuleKey, action: AdminModuleAction, checked: boolean) => {
    const token = actionToken(key, action);
    setForm((f) => {
      if (checked) {
        const modules = f.allowedModules.includes(key) ? f.allowedModules : [...f.allowedModules, key];
        let actions = [...new Set([...f.allowedActions, token])];
        const viewToken = actionToken(key, "view");
        if (!actions.includes(viewToken)) actions = [...actions, viewToken];
        return { ...f, allowedModules: modules, allowedActions: actions };
      }
      if (action === "view") {
        return {
          ...f,
          allowedModules: f.allowedModules.filter((m) => m !== key),
          allowedActions: f.allowedActions.filter((a) => !a.startsWith(`${key}:`)),
        };
      }
      return { ...f, allowedActions: f.allowedActions.filter((a) => a !== token) };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Role name is required");
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        authRole: form.authRole,
        allowedModules: form.allowedModules,
        allowedActions: form.allowedModules.length ? form.allowedActions : [],
        active: form.active,
      };
      if (form._id) {
        await adminPutJson(`/admin/td/roles/${form._id}`, payload);
        toast.success("Role updated");
      } else {
        await adminPostJson("/admin/td/roles", payload);
        toast.success("Role created");
      }
      setShowForm(false);
      void fetchRoles();
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
      await adminDeleteJson(`/admin/td/roles/${deleteTarget._id}`);
      toast.success("Role deleted");
      setDeleteTarget(null);
      void fetchRoles();
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
            <Shield className="w-6 h-6 text-primary" /> Roles
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create permission templates. Assign a role in User Master and those modules/actions are applied
            automatically to the employee. Editing a role here does not change existing users until you re-assign
            the role.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchRoles()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canCreate ? (
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Create role
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : roles.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No roles yet. Create one to get started.</Card>
      ) : (
        <div className="grid gap-3">
          {roles.map((role) => (
            <Card key={role._id} className="p-4 border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{role.name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {role.authRole === "manager" ? "Manager access" : "Executive access"}
                    </Badge>
                    {!role.active ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Inactive
                      </Badge>
                    ) : null}
                  </div>
                  {role.description ? (
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {(role.allowedModules || []).length} module(s) · {(role.allowedActions || []).length} action(s)
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {canUpdate ? (
                    <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(role)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{form._id ? "Edit role" : "Create role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Telecaller, CRE Desk"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="What this role is for"
              />
            </div>
            <div className="space-y-2">
              <Label>Access level</Label>
              <Select
                value={form.authRole}
                onValueChange={(v) => setForm({ ...form, authRole: v as "executive" | "manager" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">Executive (own records)</SelectItem>
                  <SelectItem value="manager">Manager (team / broader access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-lg border border-border/50 p-3">
              <Label className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Module permissions
              </Label>
              <p className="text-xs text-muted-foreground">
                These permissions are copied onto an employee when this role is assigned in User Master.
              </p>
              <div className="max-h-[45vh] space-y-3 overflow-y-auto pt-1 pr-1">
                {MODULE_GROUPS.map((group) => (
                  <div key={group}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </p>
                    <div className="space-y-2">
                      {modulesForGroup(group).map((m) => {
                        const moduleOn = form.allowedModules.includes(m.key);
                        return (
                          <div
                            key={m.key}
                            className="rounded-lg border border-border/40 bg-secondary/20 px-2.5 py-2"
                          >
                            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                              <Checkbox
                                checked={moduleOn}
                                onCheckedChange={(v) => toggleModule(m.key, v === true)}
                              />
                              <span className="truncate">{m.label}</span>
                            </label>
                            {moduleOn && m.actions.length > 0 ? (
                              <div className="mt-2 ml-6 flex flex-wrap gap-x-3 gap-y-1.5">
                                {m.actions.map((action) => {
                                  const token = actionToken(m.key, action);
                                  return (
                                    <label
                                      key={token}
                                      className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
                                    >
                                      <Checkbox
                                        checked={form.allowedActions.includes(token)}
                                        onCheckedChange={(v) => toggleAction(m.key, action, v === true)}
                                      />
                                      <span>{ACTION_LABELS[action]}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
              <Label htmlFor="active-role">Active</Label>
              <Switch
                id="active-role"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
            <Button className="w-full" disabled={actionLoading} onClick={() => void handleSave()}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {form._id ? "Save role" : "Create role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Roles still assigned to employees cannot be deleted. Unassign the role from users in User Master first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
