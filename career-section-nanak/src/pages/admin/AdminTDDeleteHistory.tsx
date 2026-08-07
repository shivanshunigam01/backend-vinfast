import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminGet, formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformManagerAction } from "@/lib/adminAuth";

type DeletedBooking = {
  bookingObjectId?: string;
  bookingCode?: string;
  bookingStatus?: string;
  customerName?: string;
  customerMobile?: string;
  slotDate?: string;
  slotTime?: string;
  preferredModel?: string;
};

type DeleteAuditRow = {
  _id: string;
  mode: "single" | "bulk" | "script";
  deletedCount: number;
  requestedCount?: number;
  skippedInProgress?: string[];
  bookings?: DeletedBooking[];
  deletedByName?: string;
  deletedByEmail?: string;
  deletedByRole?: string;
  deletedByDesignation?: string;
  deletedByUserType?: string;
  note?: string;
  createdAt?: string;
};

function formatWhen(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modeLabel(mode: string) {
  if (mode === "single") return "Single";
  if (mode === "bulk") return "Bulk";
  if (mode === "script") return "Script";
  return mode;
}

export default function AdminTDDeleteHistory() {
  const adminUser = getAdminUser();
  const canView = canPerformManagerAction(adminUser, "td_bookings", "view")
    || adminUser?.userType === "admin"
    || ["manager", "superadmin"].includes(String(adminUser?.role || ""));

  const [rows, setRows] = useState<DeleteAuditRow[]>([]);
  const [mode, setMode] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (mode !== "all") params.set("mode", mode);
      const res = await adminGet<DeleteAuditRow[]>(`/admin/td/bookings/delete-audit?${params}`);
      setRows(res.data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }
    void load();
  }, [canView, load]);

  if (!canView) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Only managers and admins can view booking delete history.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-primary" />
            Booking Delete History
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Who permanently deleted test-drive bookings, when, and which booking codes.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="bulk">Bulk</SelectItem>
                <SelectItem value="script">Script</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>No delete events recorded yet.</p>
          <p className="text-xs mt-1">New single/bulk deletes will appear here automatically.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const open = expanded === row._id;
            const who = row.deletedByName || "Unknown";
            const email = row.deletedByEmail ? ` (${row.deletedByEmail})` : "";
            return (
              <div key={row._id} className="rounded-lg border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/40 transition-colors"
                  onClick={() => setExpanded(open ? null : row._id)}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{modeLabel(row.mode)}</Badge>
                      <span className="font-medium text-sm">
                        {row.deletedCount} booking{row.deletedCount === 1 ? "" : "s"} deleted
                      </span>
                      {row.skippedInProgress?.length ? (
                        <span className="text-xs text-amber-700">
                          skipped {row.skippedInProgress.length} in-progress
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      By <span className="text-foreground">{who}</span>
                      {email}
                      {row.deletedByRole ? ` · ${row.deletedByRole}` : ""}
                      {row.deletedByDesignation ? ` · ${row.deletedByDesignation}` : ""}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">
                    {formatWhen(row.createdAt)}
                  </div>
                </button>
                {open ? (
                  <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-2">
                    {row.note ? (
                      <p className="text-xs text-muted-foreground">Note: {row.note}</p>
                    ) : null}
                    {(row.bookings || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No booking snapshots stored.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {(row.bookings || []).map((b, i) => (
                          <li
                            key={`${b.bookingObjectId || b.bookingCode || i}`}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                          >
                            <div>
                              <span className="font-mono text-xs mr-2">{b.bookingCode || "—"}</span>
                              <span>{b.customerName || "—"}</span>
                              {b.customerMobile ? (
                                <span className="text-muted-foreground"> · {b.customerMobile}</span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {[b.bookingStatus, b.preferredModel, b.slotDate
                                ? `${new Date(b.slotDate).toLocaleDateString("en-IN")} ${b.slotTime || ""}`.trim()
                                : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
