import { useState } from "react";
import { Eye, EyeOff, KeyRound, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { hasApi } from "@/lib/apiConfig";
import { adminPostJson, adminPutJson, formatApiErrors } from "@/lib/api";
import {
  getAdminUser,
  type AdminUser,
  updateStoredAdminUser,
} from "@/lib/adminAuth";
import { toast } from "sonner";

type ProfileResponse = Pick<
  AdminUser,
  "_id" | "name" | "email" | "role" | "designation" | "designationLabel" | "userType"
> & {
  allowedModules?: string[];
  allowedActions?: string[];
};

const AdminAccount = () => {
  const sessionUser = getAdminUser();
  const isStaff = sessionUser?.userType === "tdstaff";
  const minPasswordLen = isStaff ? 8 : 6;

  const [name, setName] = useState(sessionUser?.name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const roleLabel =
    sessionUser?.designationLabel ||
    sessionUser?.designation ||
    sessionUser?.role ||
    "—";

  const saveProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    if (!hasApi()) {
      updateStoredAdminUser({ name: trimmed });
      toast.success("Profile updated locally");
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await adminPutJson<ProfileResponse>("/admin/auth/profile", {
        name: trimmed,
      });
      updateStoredAdminUser({
        name: updated.name,
        email: updated.email,
        role: updated.role,
        designation: updated.designation,
        designationLabel: updated.designationLabel,
        userType: updated.userType,
        allowedModules: updated.allowedModules,
        allowedActions: updated.allowedActions,
      });
      setName(updated.name);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Current and new password are required");
      return;
    }
    if (newPassword.length < minPasswordLen) {
      toast.error(`New password must be at least ${minPasswordLen} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different from the current password");
      return;
    }
    if (!hasApi()) {
      toast.error("Connect the API (VITE_API_URL) to change your password");
      return;
    }
    setSavingPassword(true);
    try {
      await adminPostJson("/admin/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">My Account</h1>
        <p className="text-muted-foreground text-sm">
          Update your details and change your password
        </p>
      </div>

      <Card className="bg-card border-border/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display font-semibold text-foreground">Account details</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary/50"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input
              value={sessionUser?.email ?? ""}
              className="bg-secondary/50"
              readOnly
              disabled
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isStaff ? "Designation" : "Role"}</Label>
            <Input value={roleLabel} className="bg-secondary/50" readOnly disabled />
          </div>
        </div>
        <Button
          className="bg-primary text-primary-foreground mt-2"
          disabled={savingProfile}
          onClick={() => void saveProfile()}
        >
          {savingProfile ? "Saving…" : "Save details"}
        </Button>
      </Card>

      <Card className="bg-card border-border/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display font-semibold text-foreground">Change password</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Current password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-secondary/50 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showCurrent ? "Hide password" : "Show password"}
                onClick={() => setShowCurrent((v) => !v)}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">New password</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-secondary/50 pr-10"
                autoComplete="new-password"
                placeholder={`Min ${minPasswordLen} characters`}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showNew ? "Hide password" : "Show password"}
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confirm new password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-secondary/50 pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? "Hide password" : "Show password"}
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <Button
          className="bg-primary text-primary-foreground mt-2"
          disabled={savingPassword}
          onClick={() => void savePassword()}
        >
          {savingPassword ? "Updating…" : "Update password"}
        </Button>
      </Card>
    </div>
  );
};

export default AdminAccount;
