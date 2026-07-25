import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { getStoredState, setStoredState } from "@/lib/vfLocalStorage";
import { API_BASE, hasApi, LIVE_API_BASE } from "@/lib/apiConfig";
import { adminGetData, adminPutJson, formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import { toast } from "sonner";

const STORAGE_KEY = "vf_admin_settings";

type DealerForm = {
  dealerName: string;
  brand: string;
  phone: string;
  email: string;
  whatsapp: string;
  address: string;
  gstNo: string;
  showroomHours: string;
  mapEmbedUrl?: string;
};

const defaultSettings: DealerForm = {
  dealerName: "Patliputra VinFast",
  brand: "VinFast",
  phone: "+91 9231445060",
  email: "info@patliputravinfast.com",
  whatsapp: "919231445060",
  address: "Near Deedarganj Check Post, NH-30, Patna, Bihar - 800009",
  gstNo: "10AABCP1234Q1ZX",
  showroomHours: "Mon-Sat: 9:00 AM - 7:00 PM",
  mapEmbedUrl: "",
};

const emptySettings: DealerForm = {
  dealerName: "",
  brand: "",
  phone: "",
  email: "",
  whatsapp: "",
  address: "",
  gstNo: "",
  showroomHours: "",
  mapEmbedUrl: "",
};

const AdminSettings = () => {
  const adminUser = getAdminUser();
  const canUpdate = canPerformAction(adminUser, "settings", "update");
  const useRemote = hasApi();
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<DealerForm>(() => (hasApi() ? emptySettings : defaultSettings));
  const [saving, setSaving] = useState(false);

  const loadFromApi = useCallback(async () => {
    const doc = (await adminGetData<Record<string, unknown>>("/admin/settings/dealer")) ?? {};
    setSettings({
      dealerName: String(doc.dealerName ?? defaultSettings.dealerName),
      brand: String(doc.brand ?? defaultSettings.brand),
      phone: String(doc.phone ?? defaultSettings.phone),
      email: String(doc.email ?? defaultSettings.email),
      whatsapp: String(doc.whatsapp ?? defaultSettings.whatsapp),
      address: String(doc.address ?? defaultSettings.address),
      gstNo: String(doc.gstNo ?? defaultSettings.gstNo),
      showroomHours: String(doc.showroomHours ?? defaultSettings.showroomHours),
      mapEmbedUrl: String(doc.mapEmbedUrl ?? ""),
    });
  }, []);

  useEffect(() => {
    if (useRemote) {
      (async () => {
        try {
          await loadFromApi();
        } catch (e) {
          toast.error(formatApiErrors(e));
        } finally {
          setHydrated(true);
        }
      })();
      return;
    }
    const stored = getStoredState<DealerForm | null>(STORAGE_KEY, null);
    if (stored) setSettings({ ...defaultSettings, ...stored });
    setHydrated(true);
  }, [useRemote, loadFromApi]);

  useEffect(() => {
    if (!hydrated || useRemote) return;
    setStoredState(STORAGE_KEY, settings);
  }, [settings, hydrated, useRemote]);

  const persist = async () => {
    if (useRemote) {
      setSaving(true);
      try {
        await adminPutJson("/admin/settings/dealer", settings);
        toast.success("Settings saved");
      } catch (e) {
        toast.error(formatApiErrors(e));
      } finally {
        setSaving(false);
      }
      return;
    }
    toast.success("Saved locally (set VITE_API_URL to sync with server)");
  };

  const keys = Object.keys(settings) as (keyof DealerForm)[];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm">Dealer information and configuration</p>
      </div>

      <Card className="bg-card border-border/50 p-5 space-y-4">
        <h3 className="font-display font-semibold text-foreground">Dealership Details</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {keys.map((key) => (
            <div key={key} className={`space-y-1.5 ${key === "address" || key === "mapEmbedUrl" ? "sm:col-span-2" : ""}`}>
              <Label className="text-xs capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</Label>
              <Input
                value={settings[key]}
                onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                className="bg-secondary/50"
                disabled={!canUpdate}
                readOnly={!canUpdate}
              />
            </div>
          ))}
        </div>
        {canUpdate ? (
          <Button className="bg-primary text-primary-foreground mt-2" disabled={saving} onClick={() => void persist()}>
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        ) : null}
      </Card>

      <Card className="bg-card border-border/50 p-5 space-y-3">
        <h3 className="font-display font-semibold text-foreground">API Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Production uses <code className="text-xs bg-secondary px-1 rounded">{LIVE_API_BASE}</code> unless{" "}
          <code className="text-xs bg-secondary px-1 rounded">VITE_API_URL</code> is set. Restart Vite after
          changing env. Backend <code className="text-xs bg-secondary px-1 rounded">CLIENT_URL</code> must
          match your website origin for CORS.
        </p>
        <p className="text-xs text-muted-foreground">
          Resolved API base: {useRemote ? API_BASE : "Not set — using local storage only"}
        </p>
      </Card>
    </div>
  );
};

export default AdminSettings;
