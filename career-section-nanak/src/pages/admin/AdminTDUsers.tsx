import { useCallback, useEffect, useState } from "react";
import { adminDeleteJson, adminGet, adminPatchJson, adminPostJson, adminPutJson, formatApiErrors } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Users, Search, RefreshCw, Loader2, Plus, Edit2, UserCircle2, Trash2, ShieldCheck, Eye, EyeOff
} from "lucide-react";
import { toast } from "sonner";
import {
  DESIGNATION_LABELS,
  STAFF_DESIGNATIONS,
  designationLabel,
} from "@/lib/staffRoles";
import { MODULE_GROUPS, modulesForGroup, actionToken, ACTION_LABELS, allActionTokensForModules, type AdminModuleKey, type AdminModuleAction } from "@/lib/adminModules";

type StaffUser = {
  _id: string;
  name: string;
  email: string;
  role: string;
  designation: string;
  designationLabel?: string;
  isCustomDesignation?: boolean;
  reportsTo?: string | { _id: string; name?: string } | null;
  active: boolean;
  allowedModules?: string[];
  allowedActions?: string[];
  createdAt?: string;
};

/** Sentinel value in the designation dropdown for admin-typed custom positions. */
const OTHER_DESIGNATION = "__other__";
const NO_MANAGER = "__none__";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  designation: "sales_executive" as string,
  customDesignation: "",
  accessLevel: "executive" as "executive" | "manager",
  reportsTo: NO_MANAGER as string,
  allowedModules: [] as AdminModuleKey[],
  allowedActions: [] as string[],
  active: true,
};

const DESIGNATION_COLORS: Record<string, string> = {
  sales_executive: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  sales_manager: "bg-indigo-400/10 text-indigo-400 border-indigo-400/20",
  sales_head: "bg-violet-400/10 text-violet-400 border-violet-400/20",
  branch_manager: "bg-purple-400/10 text-purple-400 border-purple-400/20",
  gm: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  ceo: "bg-rose-400/10 text-rose-400 border-rose-400/20",
  md: "bg-amber-400/10 text-amber-400 border-amber-400/20",
};

const CUSTOM_DESIGNATION_COLOR = "bg-teal-400/10 text-teal-400 border-teal-400/20";

export default function AdminTDUsers() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<typeof emptyForm & { _id?: string }>(emptyForm);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffUser | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealLoadingId, setRevealLoadingId] = useState<string | null>(null);
  const [showFormPassword, setShowFormPassword] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "100" });
      if (filterDesignation !== "all") params.set("designation", filterDesignation);
      const { data } = await adminGet<StaffUser[]>(`/admin/td/users?${params}`);
      setUsers(data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [filterDesignation]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const openCreate = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (user: StaffUser) => {
    const isKnown = (STAFF_DESIGNATIONS as readonly string[]).includes(user.designation);
    const reportsToId =
      typeof user.reportsTo === "object" && user.reportsTo
        ? user.reportsTo._id
        : typeof user.reportsTo === "string"
          ? user.reportsTo
          : NO_MANAGER;
    setForm({
      _id: user._id,
      name: user.name,
      email: user.email,
      password: "",
      designation: isKnown ? user.designation : OTHER_DESIGNATION,
      customDesignation: isKnown ? "" : user.designation,
      accessLevel: user.role === "manager" ? "manager" : "executive",
      reportsTo: reportsToId || NO_MANAGER,
      allowedModules: (user.allowedModules ?? []) as AdminModuleKey[],
      allowedActions: user.allowedActions ?? [],
      active: user.active,
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
      // Enabling any action also enables the module (and ensures view is present).
      if (checked) {
        const modules = f.allowedModules.includes(key) ? f.allowedModules : [...f.allowedModules, key];
        let actions = [...new Set([...f.allowedActions, token])];
        const viewToken = actionToken(key, "view");
        if (!actions.includes(viewToken)) actions = [...actions, viewToken];
        return { ...f, allowedModules: modules, allowedActions: actions };
      }
      // Disabling view removes the whole module.
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

  const clearModuleAccess = () => setForm((f) => ({ ...f, allowedModules: [], allowedActions: [] }));

  const isOtherDesignation = form.designation === OTHER_DESIGNATION;

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!form._id && (!form.password || form.password.length < 8)) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (isOtherDesignation && !form.customDesignation.trim()) {
      toast.error("Please type the custom position name");
      return;
    }

    setActionLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        designation: isOtherDesignation ? form.customDesignation.trim() : form.designation,
        active: form.active,
        allowedModules: form.allowedModules,
        allowedActions: form.allowedModules.length ? form.allowedActions : [],
        reportsTo: form.reportsTo === NO_MANAGER ? null : form.reportsTo,
      };
      // Custom positions carry an explicit access level; standard ones derive it from the designation.
      if (isOtherDesignation) payload.role = form.accessLevel;
      if (form.password) payload.password = form.password;

      if (form._id) {
        await adminPutJson(`/admin/td/users/${form._id}`, payload);
        toast.success("User updated");
      } else {
        await adminPostJson("/admin/td/users", payload);
        toast.success("User created");
      }
      setShowForm(false);
      void fetchUsers();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const toggleActive = async (user: StaffUser) => {
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/users/${user._id}`, { active: !user.active });
      toast.success(user.active ? "User deactivated" : "User activated");
      void fetchUsers();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const toggleRevealPassword = async (user: StaffUser) => {
    if (revealedPasswords[user._id] !== undefined) {
      setRevealedPasswords((prev) => {
        const next = { ...prev };
        delete next[user._id];
        return next;
      });
      return;
    }
    setRevealLoadingId(user._id);
    try {
      const { data } = await adminGet<{ password: string | null; available: boolean }>(
        `/admin/td/users/${user._id}/password`,
      );
      if (!data?.available || !data.password) {
        toast.info("No saved password for this user yet — set a new password via Edit, then the eye will show it.");
        return;
      }
      setRevealedPasswords((prev) => ({ ...prev, [user._id]: data.password as string }));
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setRevealLoadingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const result = await adminDeleteJson<{ unassignedLeads?: number; unassignedBookings?: number }>(
        `/admin/td/users/${deleteTarget._id}`,
      );
      const leads = result?.unassignedLeads ?? 0;
      const bookings = result?.unassignedBookings ?? 0;
      toast.success(
        leads > 0 || bookings > 0
          ? `${deleteTarget.name} deleted — ${leads} lead(s) and ${bookings} test drive(s) moved to Unassigned`
          : `${deleteTarget.name} deleted`,
      );
      setDeleteTarget(null);
      void fetchUsers();
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
            <Users className="w-6 h-6 text-primary" /> User Master
          </h1>
          <p className="text-muted-foreground text-sm">
            Sales hierarchy — SE → SM → Sales Head → GM → CEO → MD
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void fetchUsers()} variant="outline" size="sm"><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={openCreate} size="sm" className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add User
          </Button>
        </div>
      </div>

      <Card className="p-4 border-primary/20 bg-primary/5 text-sm">
        <p className="font-medium text-foreground mb-1">Staff login</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Every staff user signs in at <span className="font-mono text-foreground">/staff/login</span> with their email and password.
          Admins use <span className="font-mono text-foreground">/admin/login</span>.
          Assigned test drives appear under <strong className="text-foreground">My Test Drives</strong>.
          Sales Executives land on that page automatically; managers and above also see full TD Management.
          Pick <strong className="text-foreground">Other (custom position)</strong> to add any designation, and use{" "}
          <strong className="text-foreground">Module access</strong> to control exactly which sections a user sees after login.
        </p>
      </Card>

      <Card className="p-4 border-border/50 bg-card/50">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/30"
            />
          </div>
          <Select value={filterDesignation} onValueChange={setFilterDesignation}>
            <SelectTrigger className="w-full sm:w-52 bg-secondary/30"><SelectValue placeholder="All roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {STAFF_DESIGNATIONS.map((d) => (
                <SelectItem key={d} value={d}>{DESIGNATION_LABELS[d]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <UserCircle2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No users found. Add staff or run the TD seed script.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((user) => (
            <Card key={user._id} className="p-4 border-border/50 bg-card/50">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{user.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    {revealedPasswords[user._id] !== undefined && (
                      <button
                        type="button"
                        className="text-xs font-mono text-primary truncate hover:underline"
                        title="Click to copy"
                        onClick={() => {
                          void navigator.clipboard?.writeText(revealedPasswords[user._id]);
                          toast.success("Password copied");
                        }}
                      >
                        Password: {revealedPasswords[user._id]}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant="outline" className={DESIGNATION_COLORS[user.designation] || CUSTOM_DESIGNATION_COLOR}>
                    {user.designationLabel || designationLabel(user.designation)}
                  </Badge>
                  {(user.allowedModules?.length ?? 0) > 0 && (
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      {user.allowedModules!.length} module{user.allowedModules!.length === 1 ? "" : "s"}
                      {(user.allowedActions?.length ?? 0) > 0
                        ? ` · ${user.allowedActions!.length} action${user.allowedActions!.length === 1 ? "" : "s"}`
                        : ""}
                    </Badge>
                  )}
                  <Badge variant="outline" className={user.active ? "border-green-400/30 text-green-400" : "border-red-400/30 text-red-400"}>
                    {user.active ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revealLoadingId === user._id}
                    title={revealedPasswords[user._id] !== undefined ? "Hide password" : "View password"}
                    onClick={() => void toggleRevealPassword(user)}
                  >
                    {revealLoadingId === user._id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : revealedPasswords[user._id] !== undefined ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                    <Edit2 className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionLoading}
                    onClick={() => void toggleActive(user)}
                  >
                    {user.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionLoading}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(user)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form._id ? "Edit user" : "Add user"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{form._id ? "New password (optional)" : "Password"}</Label>
              <div className="relative">
                <Input
                  type={showFormPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={form._id ? "Leave blank to keep current" : "Min 8 characters"}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showFormPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowFormPassword((v) => !v)}
                >
                  {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role / designation</Label>
              <Select value={form.designation} onValueChange={(v) => setForm({ ...form, designation: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAFF_DESIGNATIONS.map((d) => (
                    <SelectItem key={d} value={d}>{DESIGNATION_LABELS[d]}</SelectItem>
                  ))}
                  <SelectItem value={OTHER_DESIGNATION}>Other (custom position)…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reports to</Label>
              <Select
                value={form.reportsTo}
                onValueChange={(v) => setForm({ ...form, reportsTo: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER}>— Top of chain / none —</SelectItem>
                  {users
                    .filter((u) => u._id !== form._id && u.active)
                    .map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name} ({u.designationLabel || designationLabel(u.designation)})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Managers see leads and test drives assigned to themselves and their reports.
              </p>
            </div>
            {isOtherDesignation && (
              <>
                <div className="space-y-2">
                  <Label>Custom position name</Label>
                  <Input
                    autoFocus
                    value={form.customDesignation}
                    onChange={(e) => setForm({ ...form, customDesignation: e.target.value })}
                    placeholder="e.g. Telecaller, Receptionist, Accountant…"
                    maxLength={60}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Access level</Label>
                  <Select
                    value={form.accessLevel}
                    onValueChange={(v) => setForm({ ...form, accessLevel: v as "executive" | "manager" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive">Executive (own leads &amp; test drives only)</SelectItem>
                      <SelectItem value="manager">Manager (full team data)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="space-y-2 rounded-lg border border-border/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Module access
                </Label>
                {form.allowedModules.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={clearModuleAccess}
                  >
                    Clear (use role default)
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Tick a module to grant access, then choose which actions they can perform (View, Edit, Delete, …).
                Leave everything unticked for the default access of their role.
              </p>
              <div className="max-h-[50vh] space-y-3 overflow-y-auto pt-1 pr-1">
                {MODULE_GROUPS.map((group) => (
                  <div key={group}>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
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
              <Label htmlFor="active-user">Active</Label>
              <Switch id="active-user" checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
            <Button className="w-full" disabled={actionLoading} onClick={() => void handleSave()}>
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {form._id ? "Save changes" : "Create user"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-medium text-foreground">{deleteTarget?.email}</span> from
              the User Master and they will no longer be able to log in. Any leads or test drive bookings assigned to
              them will automatically move to <span className="font-medium text-foreground">Unassigned</span> so you
              can reassign them. This action cannot be undone.
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
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
