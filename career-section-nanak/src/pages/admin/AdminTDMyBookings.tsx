import { useCallback, useEffect, useState } from "react";
import { adminGet, adminPatchJson, formatApiErrors } from "@/lib/api";
import { getAdminUser, isFieldStaffUser, canPerformAction } from "@/lib/adminAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarCheck, Search, RefreshCw, Car, Clock, Building2,
  CheckCircle2, XCircle, Loader2, Eye, Ban, Play, CalendarClock, User, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { formatTime12h } from "@/lib/tdSlotSchedule";
import { designationLabel } from "@/lib/staffRoles";
import { fetchTDFeedbackByBooking, type TDFeedbackRecord } from "@/lib/tdFeedbackApi";
import { TDFeedbackForm } from "@/components/admin/TDFeedbackForm";
import {
  fetchTdLogByBooking,
  startTestDriveLog,
  type TDLogRecord,
} from "@/lib/tdLogApi";
import {
  CompleteTestDriveDialog,
  TestDriveCompletionSummary,
} from "@/components/admin/CompleteTestDriveDialog";
import { AddCrmLeadDialog } from "@/components/admin/AddCrmLeadDialog";
import { DrivingLicenceVerify } from "@/components/admin/DrivingLicenceVerify";

type Booking = {
  _id: string;
  bookingId: string;
  bookingStatus: string;
  assignmentStatus?: string;
  slotDate: string;
  slotTime: string;
  slotDuration: number;
  dlVerified: boolean;
  dlImageUrl?: string | null;
  dlVerifiedAt?: string | null;
  dlNumber?: string | null;
  dlValidUntil?: string | null;
  preferredModel: string;
  remarks?: string;
  customerId: { _id: string; name: string; mobile: string; customerId: string; email?: string; city?: string } | null;
  vehicleId: {
    _id?: string;
    vehicleId: string;
    model: string;
    registrationNo: string;
    color: string;
    batteryPercent?: number;
    currentOdometer?: number;
  } | null;
  branchId: { _id?: string; name: string; code: string } | null;
  testDriveId?: {
    customerName?: string;
    mobile?: string;
    email?: string;
    city?: string;
    model?: string;
    variant?: string;
    preferredTestDriveLocation?: string;
    ownsCar?: string;
    currentCarDetails?: string;
    purchaseTimeline?: string;
    remarks?: string;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
  CONFIRMED: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  IN_PROGRESS: "bg-purple-400/10 text-purple-400 border-purple-400/20",
  COMPLETED: "bg-green-400/10 text-green-400 border-green-400/20",
  CANCELLED: "bg-red-400/10 text-red-400 border-red-400/20",
  RESCHEDULED: "bg-orange-400/10 text-orange-400 border-orange-400/20",
  MISSED: "bg-gray-400/10 text-gray-400 border-gray-400/20",
};

const ALL_STATUSES = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "RESCHEDULED", "MISSED"];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatSlotDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default function AdminTDMyBookings() {
  const adminUser = getAdminUser();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDialog, setRescheduleDialog] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<{ time: string; label?: string; available: boolean }[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState<TDFeedbackRecord | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [tdLog, setTdLog] = useState<TDLogRecord | null>(null);
  const [openingOdometer, setOpeningOdometer] = useState("");
  const [closingOdometer, setClosingOdometer] = useState("");
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);

  const isExecutive = isFieldStaffUser(adminUser);
  const canVerifyDl = canPerformAction(adminUser, "td_my_bookings", "verify_dl");
  const canUpdateAssignment = canPerformAction(adminUser, "td_my_bookings", "update");
  const canStartDrive = canPerformAction(adminUser, "td_my_bookings", "start_drive");
  const canComplete = canPerformAction(adminUser, "td_my_bookings", "complete");
  const canReschedule = canPerformAction(adminUser, "td_my_bookings", "reschedule");
  const canCancel = canPerformAction(adminUser, "td_my_bookings", "cancel");
  const canCreateLead = canPerformAction(adminUser, "crm_leads", "create");
  const canManageDrive =
    canUpdateAssignment || canStartDrive || canComplete || canReschedule || canCancel;

  const isTerminalStatus = (status: string) => ["COMPLETED", "CANCELLED", "MISSED"].includes(status);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "100" });
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterDate) params.set("date", filterDate);
      const { data } = await adminGet<Booking[]>(`/admin/td/bookings/my?${params}`);
      setBookings(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDate]);

  useEffect(() => { void fetchBookings(); }, [fetchBookings]);

  const refreshSelected = useCallback(async (id: string) => {
    try {
      const { data } = await adminGet<Booking>(`/admin/td/bookings/${id}`);
      if (data) setSelected(data);
      return data ?? null;
    } catch {
      return null;
    }
  }, []);

  const openBookingDetail = async (b: Booking) => {
    setSelected(b);
    setDetailLoading(true);
    setBookingFeedback(null);
    setTdLog(null);
    setOpeningOdometer("");
    setClosingOdometer("");
    try {
      const refreshed = await refreshSelected(b._id);
      const log = await fetchTdLogByBooking(b._id);
      setTdLog(log);
      const vehicleOdometer = refreshed?.vehicleId?.currentOdometer ?? b.vehicleId?.currentOdometer;
      if (log?.openingOdometer != null) {
        setOpeningOdometer(String(log.openingOdometer));
      } else if (vehicleOdometer != null) {
        setOpeningOdometer(String(vehicleOdometer));
      }
      if (log?.closingOdometer != null) {
        setClosingOdometer(String(log.closingOdometer));
      }
      if (b.bookingStatus === "COMPLETED") {
        setFeedbackLoading(true);
        const fb = await fetchTDFeedbackByBooking(b._id);
        setBookingFeedback(fb);
      }
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setDetailLoading(false);
      setFeedbackLoading(false);
    }
  };

  const filtered = bookings.filter((b) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      b.bookingId?.toLowerCase().includes(s) ||
      b.customerId?.name?.toLowerCase().includes(s) ||
      b.customerId?.mobile?.includes(s)
    );
  });

  const handleCancel = async () => {
    if (!cancelDialog) return;
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/bookings/${cancelDialog._id}/cancel`, { reason: cancelReason });
      toast.success("Booking cancelled");
      setCancelDialog(null);
      setCancelReason("");
      void fetchBookings();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/bookings/${id}`, { bookingStatus: status });
      toast.success(`Booking marked as ${status}`);
      void fetchBookings();
      if (selected?._id === id) {
        await refreshSelected(id);
        if (status === "COMPLETED") {
          setFeedbackLoading(true);
          const fb = await fetchTDFeedbackByBooking(id);
          setBookingFeedback(fb);
          setFeedbackLoading(false);
        }
      }
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartDriving = async (id: string) => {
    if (!selected?.dlVerified || !selected?.dlImageUrl) {
      toast.error("Upload and verify driving licence before starting the test drive");
      return;
    }
    if (selected.assignmentStatus === "PENDING_ACCEPTANCE") {
      toast.error("Accept this assignment before starting the test drive");
      return;
    }
    const opening = Number(openingOdometer);
    if (!openingOdometer.trim() || Number.isNaN(opening) || opening < 0) {
      toast.error("Enter opening odometer reading (km) before starting the drive");
      return;
    }
    setActionLoading(true);
    try {
      const log = await startTestDriveLog({
        bookingId: id,
        openingOdometer: opening,
        openingBattery: selected?.vehicleId?.batteryPercent,
      });
      setTdLog(log);
      toast.success("Test drive started — opening odometer recorded");
      void fetchBookings();
      if (selected?._id === id) await refreshSelected(id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptAssignment = async (id: string) => {
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/bookings/${id}/accept-assignment`, {});
      toast.success("Assignment accepted");
      void fetchBookings();
      await refreshSelected(id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAssignment = async (id: string) => {
    const reason = window.prompt("Reason for rejecting this assignment (optional)") || undefined;
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/bookings/${id}/reject-assignment`, { reason });
      toast.success("Assignment rejected — returned for reassignment");
      setSelected(null);
      void fetchBookings();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const openCompleteDialog = () => {
    if (!tdLog?._id) {
      toast.error("No active test drive log found. Start the drive first.");
      return;
    }
    setCompleteDialogOpen(true);
  };

  const handleDriveCompleted = async () => {
    if (!selected) return;
    const id = selected._id;
    const log = await fetchTdLogByBooking(id);
    setTdLog(log);
    if (log?.closingOdometer != null) setClosingOdometer(String(log.closingOdometer));
    void fetchBookings();
    await refreshSelected(id);
    setFeedbackLoading(true);
    const fb = await fetchTDFeedbackByBooking(id);
    setBookingFeedback(fb);
    setFeedbackLoading(false);
  };

  const openRescheduleDialog = (b: Booking) => {
    setRescheduleDialog(b);
    const d = new Date(b.slotDate);
    setRescheduleDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    setRescheduleTime(b.slotTime);
    setRescheduleSlots([]);
  };

  const loadRescheduleSlots = async () => {
    if (!rescheduleDialog?.branchId?._id || !rescheduleDate) return;
    setRescheduleSlotsLoading(true);
    try {
      const { data } = await adminGet<{ time: string; label?: string; available: boolean }[]>(
        `/admin/td/slots/available?branchId=${rescheduleDialog.branchId._id}&date=${rescheduleDate}`,
      );
      setRescheduleSlots(data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setRescheduleSlotsLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDialog || !rescheduleDate || !rescheduleTime) {
      toast.error("Select a new date and time slot");
      return;
    }
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/bookings/${rescheduleDialog._id}/reschedule`, {
        slotDate: rescheduleDate,
        slotTime: rescheduleTime,
      });
      toast.success("Booking rescheduled");
      setRescheduleDialog(null);
      setSelected(null);
      void fetchBookings();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const roleLabel = adminUser?.designationLabel || designationLabel(adminUser?.designation) || adminUser?.role;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <User className="w-6 h-6 text-primary" /> My Test Drives
          </h1>
          <p className="text-muted-foreground text-sm">
            {adminUser?.name} · {roleLabel} · {filtered.length} assigned booking(s)
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {canCreateLead ? (
          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setShowAddLead(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Lead
          </Button>
          ) : null}
          <Button onClick={() => setFilterDate(todayIso())} variant={filterDate === todayIso() ? "default" : "outline"} size="sm">Today</Button>
          <Button onClick={() => setFilterDate("")} variant={filterDate === "" ? "default" : "outline"} size="sm">All dates</Button>
          <Button onClick={() => void fetchBookings()} variant="outline" size="sm"><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customer or booking ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-secondary/50" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No test drives assigned to you yet.</p>
          <p className="text-xs mt-2">When a manager assigns a booking to you, it will appear here.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b) => (
            <Card key={b._id} className="p-4 border-border/50 bg-card/50 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{b.bookingId}</p>
                  <p className="font-semibold text-foreground">{b.customerId?.name ?? "Customer"}</p>
                  <p className="text-xs text-muted-foreground">{b.customerId?.mobile}</p>
                </div>
                <Badge variant="outline" className={STATUS_COLORS[b.bookingStatus] ?? ""}>{b.bookingStatus}</Badge>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" />{formatSlotDate(b.slotDate)} · {formatTime12h(b.slotTime)}</div>
                <div className="flex items-center gap-2"><Car className="w-3.5 h-3.5" />{b.preferredModel}{b.vehicleId ? ` · ${b.vehicleId.registrationNo}` : ""}</div>
                <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5" />{b.branchId?.name ?? "—"}</div>
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => void openBookingDetail(b)}>
                <Eye className="w-3.5 h-3.5 mr-1" /> View & manage
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">My assigned test drive</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              {detailLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide">Customer details</p>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <p><span className="text-muted-foreground">Name</span><br />{selected.testDriveId?.customerName || selected.customerId?.name}</p>
                      <p><span className="text-muted-foreground">Mobile</span><br />{selected.testDriveId?.mobile || selected.customerId?.mobile}</p>
                      <p><span className="text-muted-foreground">Email</span><br />{selected.testDriveId?.email || selected.customerId?.email || "—"}</p>
                      <p><span className="text-muted-foreground">City</span><br />{selected.testDriveId?.city || selected.customerId?.city || "—"}</p>
                      <p><span className="text-muted-foreground">Model</span><br />{selected.testDriveId?.model || selected.preferredModel}</p>
                      <p><span className="text-muted-foreground">Slot</span><br />{formatSlotDate(selected.slotDate)} · {formatTime12h(selected.slotTime)}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                    <DrivingLicenceVerify
                      bookingId={selected._id}
                      dlVerified={selected.dlVerified}
                      dlImageUrl={selected.dlImageUrl}
                      dlNumber={selected.dlNumber}
                      dlValidUntil={selected.dlValidUntil}
                      disabled={actionLoading}
                      canEdit={canVerifyDl}
                      onVerified={async () => {
                        await refreshSelected(selected._id);
                        void fetchBookings();
                      }}
                    />
                  </div>

                  {!isTerminalStatus(selected.bookingStatus) && canManageDrive ? (
                    <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Manage test drive</p>
                      {canUpdateAssignment && selected.assignmentStatus === "PENDING_ACCEPTANCE" ? (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                          <p className="text-sm text-foreground font-medium">Assignment awaiting your response</p>
                          <p className="text-xs text-muted-foreground">
                            Accept to confirm this test drive, or reject to return it for reassignment.
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              className="h-10"
                              disabled={actionLoading}
                              onClick={() => void handleAcceptAssignment(selected._id)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" /> Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-10"
                              disabled={actionLoading}
                              onClick={() => void handleRejectAssignment(selected._id)}
                            >
                              <XCircle className="w-4 h-4 mr-2" /> Reject
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {(canStartDrive || canComplete) ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="my-opening-odometer" className="text-xs">
                            Opening odometer (km) *
                          </Label>
                          <Input
                            id="my-opening-odometer"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            placeholder="e.g. 1240"
                            value={openingOdometer}
                            onChange={(e) => setOpeningOdometer(e.target.value)}
                            disabled={actionLoading || selected.bookingStatus === "IN_PROGRESS" || !canStartDrive}
                            className="bg-background/80"
                          />
                          {selected.vehicleId?.currentOdometer != null ? (
                            <p className="text-[10px] text-muted-foreground">
                              Fleet reading: {selected.vehicleId.currentOdometer} km
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="my-closing-odometer" className="text-xs">
                            Closing odometer (km) *
                          </Label>
                          <Input
                            id="my-closing-odometer"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            placeholder="After test drive"
                            value={closingOdometer}
                            onChange={(e) => setClosingOdometer(e.target.value)}
                            disabled={actionLoading || selected.bookingStatus !== "IN_PROGRESS" || !canComplete}
                            className="bg-background/80"
                          />
                          {tdLog?.totalKM != null ? (
                            <p className="text-[10px] text-muted-foreground">
                              Distance driven: {tdLog.totalKM} km
                            </p>
                          ) : null}
                        </div>
                      </div>
                      ) : null}
                      <div className="grid grid-cols-2 gap-2">
                        {canStartDrive ? (
                        <Button
                          size="sm"
                          className="h-10"
                          disabled={
                            actionLoading ||
                            selected.bookingStatus === "IN_PROGRESS" ||
                            selected.assignmentStatus === "PENDING_ACCEPTANCE" ||
                            !selected.dlVerified
                          }
                          onClick={() => void handleStartDriving(selected._id)}
                        >
                          <Play className="w-4 h-4 mr-2" /> Start driving
                        </Button>
                        ) : null}
                        {canComplete ? (
                        <Button
                          size="sm"
                          className="h-10 bg-green-600 hover:bg-green-700 disabled:opacity-40"
                          disabled={actionLoading || selected.bookingStatus !== "IN_PROGRESS"}
                          onClick={openCompleteDialog}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Mark completed
                        </Button>
                        ) : null}
                        {canReschedule ? (
                        <Button size="sm" variant="outline" className="h-10" disabled={actionLoading} onClick={() => { openRescheduleDialog(selected); setSelected(null); }}>
                          <CalendarClock className="w-4 h-4 mr-2" /> Reschedule
                        </Button>
                        ) : null}
                        {canCancel ? (
                        <Button size="sm" variant="destructive" className="h-10" disabled={actionLoading} onClick={() => { setCancelDialog(selected); setSelected(null); }}>
                          <Ban className="w-4 h-4 mr-2" /> Cancel booking
                        </Button>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {selected.assignmentStatus === "PENDING_ACCEPTANCE"
                          ? "Accept or reject this assignment before starting."
                          : !selected.dlVerified
                            ? "Driving licence must be verified before starting the test drive."
                            : selected.bookingStatus === "IN_PROGRESS"
                              ? "Tap Mark completed to capture the closing odometer, photos, location, and customer feedback."
                              : "Enter opening odometer before starting the test drive."}
                      </p>
                    </div>
                  ) : selected.bookingStatus === "COMPLETED" ? (
                    <div className="space-y-3">
                      {tdLog?.openingOdometer != null ? (
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-4 grid sm:grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Opening odometer</p>
                            <p className="font-semibold text-foreground">{tdLog.openingOdometer} km</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Closing odometer</p>
                            <p className="font-semibold text-foreground">{tdLog.closingOdometer ?? "—"} km</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Distance driven</p>
                            <p className="font-semibold text-foreground">{tdLog.totalKM ?? "—"} km</p>
                          </div>
                        </div>
                      ) : null}
                      {tdLog ? <TestDriveCompletionSummary log={tdLog} /> : null}
                      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                        Test drive completed — customer added to your Leads (source: Test Drive). Capture feedback below to update their status.
                      </div>
                      {feedbackLoading ? (
                        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                      ) : (
                        <TDFeedbackForm
                          bookingId={selected._id}
                          customerId={selected.customerId?._id}
                          preferredModel={selected.testDriveId?.model || selected.preferredModel}
                          existing={bookingFeedback}
                          onSubmitted={async () => {
                            const fb = await fetchTDFeedbackByBooking(selected._id);
                            setBookingFeedback(fb);
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                      Booking is <span className="font-medium text-foreground">{selected.bookingStatus}</span> — no further actions.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selected ? (
        <CompleteTestDriveDialog
          open={completeDialogOpen}
          onOpenChange={setCompleteDialogOpen}
          bookingMongoId={selected._id}
          bookingCode={selected.bookingId}
          customerName={selected.testDriveId?.customerName || selected.customerId?.name}
          customerId={selected.customerId?._id}
          preferredModel={selected.testDriveId?.model || selected.preferredModel}
          dlVerified={selected.dlVerified}
          log={tdLog}
          vehicleBattery={selected.vehicleId?.batteryPercent}
          initialClosingOdometer={closingOdometer}
          onCompleted={handleDriveCompleted}
        />
      ) : null}

      <Dialog open={!!rescheduleDialog} onOpenChange={(o) => !o && setRescheduleDialog(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Reschedule booking</DialogTitle></DialogHeader>
          {rescheduleDialog && (
            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <Label className="text-xs">New date</Label>
                <Input type="date" value={rescheduleDate} onChange={(e) => { setRescheduleDate(e.target.value); setRescheduleTime(""); setRescheduleSlots([]); }} className="bg-secondary/50" />
              </div>
              <Button type="button" variant="outline" size="sm" disabled={rescheduleSlotsLoading || !rescheduleDate} onClick={() => void loadRescheduleSlots()}>
                {rescheduleSlotsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Load available slots
              </Button>
              {rescheduleSlots.length > 0 ? (
                <Select value={rescheduleTime} onValueChange={setRescheduleTime}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Pick time" /></SelectTrigger>
                  <SelectContent>
                    {rescheduleSlots.filter((s) => s.available).map((s) => (
                      <SelectItem key={s.time} value={s.time}>{s.label ?? formatTime12h(s.time)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Button className="w-full" disabled={actionLoading || !rescheduleDate || !rescheduleTime} onClick={() => void handleReschedule()}>Save reschedule</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelDialog} onOpenChange={(o) => !o && setCancelDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Cancel booking</DialogTitle></DialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="bg-secondary/50" rows={3} placeholder="Reason (optional)" />
          <Button variant="destructive" className="w-full" onClick={() => void handleCancel()} disabled={actionLoading}>Confirm cancel</Button>
        </DialogContent>
      </Dialog>

      {showAddLead ? (
        <AddCrmLeadDialog
          open={showAddLead}
          onOpenChange={setShowAddLead}
          isExecutive={isExecutive}
        />
      ) : null}
    </div>
  );
}
