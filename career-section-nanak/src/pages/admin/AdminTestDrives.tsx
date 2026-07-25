import { useCallback, useEffect, useState } from "react";
import { mockTestDrives, type TestDriveBooking } from "@/data/mockData";
import {
  getTestDriveBookings,
  setTestDriveBookings as setTestDrivesToStorage,
  getTestDrivesAdminInitial,
  subscribeVfStorage,
  VF_STORAGE_KEYS,
} from "@/lib/vfLocalStorage";
import { hasApi } from "@/lib/apiConfig";
import { adminDeleteJson, adminGet, adminPutJson, formatApiErrors, publicPost } from "@/lib/api";
import { fetchAllAdminRows } from "@/lib/adminFetchAll";
import { normalizeTestDriveModel, testDriveFromApi, testDriveToApiPayload } from "@/lib/apiMappers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { leadModelLabel, parseStoredModelLine } from "@/data/vinfastModels";
import { ModelTrimSelect } from "@/components/ModelTrimSelect";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Edit2, Trash2, CheckCircle, XCircle, Clock, Download, FileText, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  OWNS_CAR_OPTIONS,
  PURCHASE_TIMELINE_OPTIONS,
  TEST_DRIVE_LOCATION_OPTIONS,
} from "@/data/testDriveFormOptions";

const SELECT_NONE = "__none__";

const statusColors: Record<string, string> = {
  Pending: "bg-amber-400/10 text-amber-400",
  Scheduled: "bg-green-400/10 text-green-400",
  Completed: "bg-primary/10 text-primary",
  Cancelled: "bg-destructive/10 text-destructive",
  "No Show": "bg-muted text-muted-foreground",
};

const getLocalISODate = () => {
  // Returns YYYY-MM-DD in the user's local timezone (safe for <input type="date">).
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const AdminTestDrives = () => {
  const useRemote = hasApi();
  const [hydrated, setHydrated] = useState(false);
  const [bookings, setBookings] = useState<TestDriveBooking[]>(() => (hasApi() ? [] : mockTestDrives));
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editBooking, setEditBooking] = useState<TestDriveBooking | null>(null);
  const [showForm, setShowForm] = useState(false);
  const todayStr = getLocalISODate();

  const emptyBooking: TestDriveBooking = {
    id: "",
    leadId: "",
    customerName: "",
    mobile: "",
    model: "VF 7",
    preferredDate: "",
    preferredTime: "",
    branch: "Patna Showroom",
    preferredTestDriveLocation: "",
    ownsCar: "",
    currentCarDetails: "",
    purchaseTimeline: "",
    status: "Pending",
    assignedExecutive: "",
    feedback: "",
    createdAt: new Date().toISOString().split("T")[0],
  };

  const refreshFromApi = useCallback(async () => {
    const { data } = await adminGet<unknown[]>("/admin/test-drives?limit=500&page=1");
    setBookings((data as Record<string, unknown>[]).map((d) => testDriveFromApi(d)));
  }, []);

  useEffect(() => {
    if (useRemote) {
      (async () => {
        try {
          await refreshFromApi();
        } catch (e) {
          toast.error(formatApiErrors(e));
        } finally {
          setHydrated(true);
        }
      })();
      return;
    }
    const { seedMock, bookings: initial } = getTestDrivesAdminInitial();
    setBookings(seedMock ? mockTestDrives : initial);
    setHydrated(true);
    return subscribeVfStorage(VF_STORAGE_KEYS.testDrives, () => setBookings(getTestDriveBookings()));
  }, [useRemote, refreshFromApi]);

  useEffect(() => {
    if (!hydrated || useRemote) return;
    setTestDrivesToStorage(bookings);
  }, [bookings, hydrated, useRemote]);

  const filtered = bookings.filter(b => {
    const matchSearch = b.customerName.toLowerCase().includes(search.toLowerCase()) || b.mobile.includes(search);
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const escapeCsv = (value: unknown) => {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const loadAllBookingsForExport = async (): Promise<TestDriveBooking[]> => {
    if (useRemote) {
      return fetchAllAdminRows("/admin/test-drives", (d) => testDriveFromApi(d));
    }
    return bookings;
  };

  const exportCsv = async () => {
    const t = toast.loading("Preparing CSV…");
    try {
      const rowsToExport = await loadAllBookingsForExport();
      toast.dismiss(t);
      if (rowsToExport.length === 0) {
        toast.message("No bookings to export.");
        return;
      }
      const headers: (keyof TestDriveBooking)[] = [
        "id",
        "leadId",
        "customerName",
        "mobile",
        "model",
        "preferredDate",
        "preferredTime",
        "branch",
        "preferredTestDriveLocation",
        "ownsCar",
        "currentCarDetails",
        "purchaseTimeline",
        "status",
        "feedback",
        "createdAt",
      ];
      const rows = rowsToExport.map((b) => headers.map((h) => escapeCsv(b[h])).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patliputra-group-test-drives-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rowsToExport.length} booking(s).`);
    } catch (e) {
      toast.dismiss(t);
      toast.error(formatApiErrors(e));
    }
  };

  const exportPdf = async () => {
    const t = toast.loading("Preparing PDF…");
    try {
      const rowsToExport = await loadAllBookingsForExport();
      toast.dismiss(t);
      if (rowsToExport.length === 0) {
        toast.message("No bookings to export.");
        return;
      }
      const htmlRows = rowsToExport
        .map(
          (b) => `<tr>
          <td>${b.customerName}</td>
          <td>${b.mobile}</td>
          <td>${b.model}</td>
          <td>${b.preferredDate}</td>
          <td>${b.preferredTime}</td>
          <td>${b.branch}</td>
          <td>${b.preferredTestDriveLocation ?? ""}</td>
          <td>${b.ownsCar ?? ""}</td>
          <td>${b.currentCarDetails ?? ""}</td>
          <td>${b.purchaseTimeline ?? ""}</td>
          <td>${b.status}</td>
        </tr>`,
        )
        .join("");

      const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Test Drives Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h2>Patliputra Group Test Drives Export (${rowsToExport.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Customer</th><th>Mobile</th><th>Model</th><th>Preferred Date</th><th>Preferred Time</th><th>Branch</th><th>TD Location</th><th>Owns car</th><th>Current car</th><th>Purchase plan</th><th>Status</th>
              </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
          </table>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>`;

      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Pop-up blocked — allow pop-ups to print.");
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      toast.success(`Opened print view (${rowsToExport.length} booking(s)).`);
    } catch (e) {
      toast.dismiss(t);
      toast.error(formatApiErrors(e));
    }
  };

  const shareWhatsApp = async () => {
    const t = toast.loading("Loading bookings…");
    try {
      const rowsToExport = await loadAllBookingsForExport();
      toast.dismiss(t);
      const preview = rowsToExport.slice(0, 10).map((b) => `• ${b.customerName} (${b.mobile}) - ${b.model} - ${b.preferredDate} ${b.preferredTime}`).join("\n");
      const suffix = rowsToExport.length > 10 ? `\n...and ${rowsToExport.length - 10} more` : "";
      const msg = `Patliputra Group Test Drives (${rowsToExport.length})\n${preview}${suffix}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    } catch (e) {
      toast.dismiss(t);
      toast.error(formatApiErrors(e));
    }
  };

  const handleSave = async (booking: TestDriveBooking) => {
    if (useRemote) {
      try {
        if (booking.id) {
          const payload = testDriveToApiPayload(booking);
          const updated = await adminPutJson<Record<string, unknown>>(`/admin/test-drives/${booking.id}`, payload);
          const mapped = testDriveFromApi(updated);
          setBookings((prev) => prev.map((b) => (b.id === booking.id ? mapped : b)));
        } else {
          await publicPost("/test-drives", {
            customerName: booking.customerName.trim(),
            mobile: booking.mobile.trim(),
            model: normalizeTestDriveModel(booking.model),
            preferredDate: booking.preferredDate,
            preferredTime: booking.preferredTime?.trim() || undefined,
            branch: booking.branch?.trim() || undefined,
            preferredTestDriveLocation: booking.preferredTestDriveLocation?.trim() || undefined,
            ownsCar: booking.ownsCar?.trim() || undefined,
            currentCarDetails:
              booking.ownsCar === "Yes" ? booking.currentCarDetails?.trim() || undefined : undefined,
            purchaseTimeline: booking.purchaseTimeline?.trim() || undefined,
            remarks: booking.feedback?.trim() || undefined,
          });
          await refreshFromApi();
        }
        toast.success(booking.id ? "Booking updated" : "Booking created");
        setShowForm(false);
        setEditBooking(null);
      } catch (e) {
        toast.error(formatApiErrors(e));
      }
      return;
    }
    if (booking.id) {
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? booking : b)));
    } else {
      setBookings((prev) => [...prev, { ...booking, id: `TD${String(prev.length + 1).padStart(3, "0")}` }]);
    }
    setShowForm(false);
    setEditBooking(null);
  };

  const handleDelete = async (id: string) => {
    if (useRemote) {
      try {
        await adminDeleteJson(`/admin/test-drives/${id}`);
        setBookings((prev) => prev.filter((b) => b.id !== id));
        toast.success("Booking removed");
      } catch (e) {
        toast.error(formatApiErrors(e));
      }
      return;
    }
    setBookings((prev) => prev.filter((b) => b.id !== id));
  };

  const quickStatus = async (id: string, status: TestDriveBooking["status"]) => {
    if (useRemote) {
      const b = bookings.find((x) => x.id === id);
      if (!b) return;
      try {
        const payload = testDriveToApiPayload({ ...b, status });
        const updated = await adminPutJson<Record<string, unknown>>(`/admin/test-drives/${id}`, payload);
        const mapped = testDriveFromApi(updated);
        setBookings((prev) => prev.map((x) => (x.id === id ? mapped : x)));
      } catch (e) {
        toast.error(formatApiErrors(e));
      }
      return;
    }
    setBookings((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Test Drives</h1>
          <p className="text-muted-foreground text-sm">{bookings.length} total bookings</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => { setEditBooking(emptyBooking); setShowForm(true); }} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Booking
          </Button>
          <Button onClick={() => void exportCsv()} variant="outline" className="bg-secondary/50">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={() => void exportPdf()} variant="outline" className="bg-secondary/50">
            <FileText className="w-4 h-4 mr-2" /> Export PDF
          </Button>
          <Button onClick={() => void shareWhatsApp()} variant="outline" className="bg-secondary/50">
            <MessageCircle className="w-4 h-4 mr-2" /> Share WhatsApp
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-secondary/50" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48 bg-secondary/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {["Pending", "Scheduled", "Completed", "Cancelled", "No Show"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Cards View */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((td) => (
          <Card key={td.id} className="bg-card border-border/50 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-foreground">{td.customerName}</p>
                <p className="text-xs text-muted-foreground">{td.mobile}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${statusColors[td.status] ?? "bg-secondary text-muted-foreground"}`}>{td.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-muted-foreground">Model:</span> <span className="text-foreground">{td.model}</span></div>
              <div><span className="text-muted-foreground">Date:</span> <span className="text-foreground">{td.preferredDate}</span></div>
              <div><span className="text-muted-foreground">Time:</span> <span className="text-foreground">{td.preferredTime}</span></div>
              <div><span className="text-muted-foreground">Branch:</span> <span className="text-foreground">{td.branch}</span></div>
              {td.preferredTestDriveLocation ? (
                <div className="col-span-2">
                  <span className="text-muted-foreground">TD location:</span>{" "}
                  <span className="text-foreground">{td.preferredTestDriveLocation}</span>
                </div>
              ) : null}
              {td.purchaseTimeline ? (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Purchase plan:</span>{" "}
                  <span className="text-foreground">{td.purchaseTimeline}</span>
                </div>
              ) : null}
              {td.ownsCar ? (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Owns car:</span>{" "}
                  <span className="text-foreground">
                    {td.ownsCar}
                    {td.ownsCar === "Yes" && td.currentCarDetails ? ` — ${td.currentCarDetails}` : ""}
                  </span>
                </div>
              ) : null}
            </div>
            {td.feedback && <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-2">"{td.feedback}"</p>}
            <div className="flex items-center gap-1 pt-1 border-t border-border/30">
              <button onClick={() => quickStatus(td.id, "Scheduled")} title="Mark scheduled" className="p-1.5 rounded hover:bg-green-400/10 text-muted-foreground hover:text-green-400"><CheckCircle className="w-3.5 h-3.5" /></button>
              <button onClick={() => quickStatus(td.id, "Completed")} title="Complete" className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"><Clock className="w-3.5 h-3.5" /></button>
              <button onClick={() => quickStatus(td.id, "Cancelled")} title="Cancel" className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><XCircle className="w-3.5 h-3.5" /></button>
              <div className="flex-1" />
              <button onClick={() => { setEditBooking(td); setShowForm(true); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(td.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No test drive bookings found</p>}

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditBooking(null); }}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">{editBooking?.id ? "Edit Booking" : "New Booking"}</DialogTitle></DialogHeader>
          {editBooking && <TestDriveForm booking={editBooking} onSave={(b) => void handleSave(b)} onCancel={() => { setShowForm(false); setEditBooking(null); }} todayStr={todayStr} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TestDriveForm = ({
  booking,
  onSave,
  onCancel,
  todayStr,
}: {
  booking: TestDriveBooking;
  onSave: (b: TestDriveBooking) => void | Promise<void>;
  onCancel: () => void;
  todayStr: string;
}) => {
  const [form, setForm] = useState(booking);
  const update = (key: keyof TestDriveBooking, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Customer Name</Label><Input value={form.customerName} onChange={e => update("customerName", e.target.value)} className="bg-secondary/50" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Mobile</Label><Input value={form.mobile} onChange={e => update("mobile", e.target.value)} className="bg-secondary/50" /></div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Model &amp; trim</Label>
          {(() => {
            const { model: tm, variant: tv } = parseStoredModelLine(form.model);
            return (
              <ModelTrimSelect
                model={tm}
                variant={tv}
                onChange={(m, v) => update("model", leadModelLabel(m, v))}
                includeNotSureBoth
                className="h-10 w-full px-3 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            );
          })()}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => update("status", v)}><SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger><SelectContent>{["Pending", "Scheduled", "Completed", "Cancelled", "No Show"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            min={todayStr}
            value={form.preferredDate}
            onChange={e => update("preferredDate", e.target.value)}
            className="bg-secondary/50"
          />
        </div>
        <div className="space-y-1.5"><Label className="text-xs">Time</Label><Input value={form.preferredTime} onChange={e => update("preferredTime", e.target.value)} className="bg-secondary/50" placeholder="e.g. 10:00 AM" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Branch</Label><Input value={form.branch} onChange={e => update("branch", e.target.value)} className="bg-secondary/50" /></div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Preferred test drive location</Label>
          <Select
            value={form.preferredTestDriveLocation || SELECT_NONE}
            onValueChange={(v) => update("preferredTestDriveLocation", v === SELECT_NONE ? "" : v)}
          >
            <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_NONE}>— Not set —</SelectItem>
              {TEST_DRIVE_LOCATION_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Currently own a car?</Label>
          <Select
            value={form.ownsCar || SELECT_NONE}
            onValueChange={(v) => {
              const next = v === SELECT_NONE ? "" : v;
              setForm((prev) => ({
                ...prev,
                ownsCar: next,
                ...(next !== "Yes" ? { currentCarDetails: "" } : {}),
              }));
            }}
          >
            <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_NONE}>— Not set —</SelectItem>
              {OWNS_CAR_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {form.ownsCar === "Yes" ? (
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Current car (model / brand)</Label>
            <Input
              value={form.currentCarDetails}
              onChange={(e) => update("currentCarDetails", e.target.value)}
              className="bg-secondary/50"
              placeholder="e.g. Honda City"
            />
          </div>
        ) : null}
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Planning to purchase within</Label>
          <Select
            value={form.purchaseTimeline || SELECT_NONE}
            onValueChange={(v) => update("purchaseTimeline", v === SELECT_NONE ? "" : v)}
          >
            <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_NONE}>— Not set —</SelectItem>
              {PURCHASE_TIMELINE_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Feedback</Label><Textarea value={form.feedback} onChange={e => update("feedback", e.target.value)} className="bg-secondary/50" rows={2} /></div>
      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => {
            const isUpcoming = ["Pending", "Scheduled"].includes(form.status);
            if (isUpcoming && form.preferredDate) {
              const selected = new Date(`${form.preferredDate}T00:00:00`);
              const today = new Date(`${todayStr}T00:00:00`);

              if (Number.isNaN(selected.getTime())) {
                toast.error("Please select a valid booking date.");
                return;
              }
              if (selected.getTime() < today.getTime()) {
                toast.error("Back date bookings are not allowed. Please select today or a future date.");
                return;
              }
            }

            onSave(form);
          }}
          className="bg-primary text-primary-foreground flex-1"
        >
          Save
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
      </div>
    </div>
  );
};

export default AdminTestDrives;
