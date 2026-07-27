import { useCallback, useEffect, useState } from "react";
import { BatteryCharging, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { adminGet, formatApiErrors } from "@/lib/api";

type FleetRow = {
  _id: string;
  vehicleId?: string;
  model?: string;
  registrationNo?: string;
  status?: string;
  batteryPercent?: number | null;
  chargingStatus?: string;
  nextChargeAt?: string | null;
  maintenanceDue?: string | null;
  openMaintenanceCount?: number;
  serviceHistoryCount?: number;
  testDriveReadiness?: string;
  availability?: string;
  upcomingTestDrives?: { bookingId: string; date: string; time: string; status: string }[];
};

export default function AdminFleetHealth() {
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<FleetRow[]>("/admin/td/fleet/health");
      setRows(res.data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <BatteryCharging className="h-6 w-6 text-primary" />
            Fleet Charging & Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Battery, charging, maintenance due, availability, and test-drive readiness for demo vehicles.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No demo vehicles found.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((v) => (
            <Card key={v._id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{v.model || "Vehicle"}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.registrationNo || v.vehicleId || "—"}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    v.testDriveReadiness === "READY"
                      ? "border-emerald-500/40 text-emerald-700"
                      : "border-amber-500/40 text-amber-700"
                  }
                >
                  {v.testDriveReadiness || "—"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Battery:</span>{" "}
                  {v.batteryPercent != null ? `${v.batteryPercent}%` : "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Charge:</span> {v.chargingStatus || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Status:</span> {v.availability || v.status || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Open maint:</span>{" "}
                  {v.openMaintenanceCount ?? 0}
                </p>
              </div>
              {v.upcomingTestDrives?.length ? (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Upcoming TDs</p>
                  {v.upcomingTestDrives.slice(0, 3).map((b) => (
                    <p key={b.bookingId}>
                      {b.bookingId} · {b.date} {b.time}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No upcoming test drives</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
