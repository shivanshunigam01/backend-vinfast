import { useCallback, useEffect, useState } from "react";
import { adminGet, adminPatchJson, adminPostJson, adminDeleteJson, formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction, canPerformManagerAction } from "@/lib/adminAuth";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
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
  CheckCircle2, XCircle, AlertTriangle, Loader2, Eye, UserCheck, Ban, Play, CalendarClock, Lock, Pencil, Trash2,
  CheckSquare, Square, X,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { formatTime12h } from "@/lib/tdSlotSchedule";
import { designationLabel } from "@/lib/staffRoles";
import { fetchTDFeedbackByBooking, type TDFeedbackRecord } from "@/lib/tdFeedbackApi";
import { TDFeedbackForm } from "@/components/admin/TDFeedbackForm";
import { DrivingLicenceVerify } from "@/components/admin/DrivingLicenceVerify";
import {
  fetchTdLogByBooking,
  startTestDriveLog,
  type TDLogRecord,
} from "@/lib/tdLogApi";
import {
  CompleteTestDriveDialog,
  TestDriveCompletionSummary,
} from "@/components/admin/CompleteTestDriveDialog";
import { BookTestDriveDialog } from "@/components/admin/BookTestDriveDialog";

type TestDriveDetails = {
  _id: string;
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
  status?: string;
};

/** Stable reference so the dialog's reset effect only fires on open/close. */
const EMPTY_WALK_IN_CUSTOMER = { name: "", mobile: "" };

type Booking = {
  _id: string;
  bookingId: string;
  bookingStatus: string;
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
  assignedExecutive: { _id: string; name: string; email: string } | null;
  branchId: { _id?: string; name: string; code: string } | null;
  testDriveId?: TestDriveDetails | null;
  createdAt: string;
  cancellationReason?: string;
  isRepeatDrive?: boolean;
};

type Executive = { _id: string; name: string; email: string; role: string; designation?: string; designationLabel?: string };
type DemoVehicleOption = {
  _id: string;
  vehicleId: string;
  model: string;
  variant: string;
  registrationNo: string;
  color: string;
  status: string;
  batteryPercent: number;
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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export default function AdminTDBookings() {
  const adminUser = getAdminUser();
  const { models: catalogModels } = useVehicleCatalog();
  const canCreate = canPerformAction(adminUser, "td_bookings", "create");
  const canUpdate = canPerformAction(adminUser, "td_bookings", "update");
  const canAssign = canPerformAction(adminUser, "td_bookings", "assign");
  const canVerifyDl = canPerformAction(adminUser, "td_bookings", "verify_dl");
  const canStartDrive = canPerformAction(adminUser, "td_bookings", "start_drive");
  const canCancel = canPerformAction(adminUser, "td_bookings", "cancel");
  const canReschedule = canPerformAction(adminUser, "td_bookings", "reschedule_approve");
  const canEditDetails = canPerformManagerAction(adminUser, "td_bookings", "update");
  const canDelete = canEditDetails;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterExecutive, setFilterExecutive] = useState("all");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [assignExecutiveId, setAssignExecutiveId] = useState("");
  const [cancelDialog, setCancelDialog] = useState<Booking | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Booking | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleDialog, setRescheduleDialog] = useState<Booking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<{ time: string; label?: string; available: boolean }[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [bookingFeedback, setBookingFeedback] = useState<TDFeedbackRecord | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [assignVehicleId, setAssignVehicleId] = useState("");
  const [availableVehicles, setAvailableVehicles] = useState<DemoVehicleOption[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [tdLog, setTdLog] = useState<TDLogRecord | null>(null);
  const [openingOdometer, setOpeningOdometer] = useState("");
  const [closingOdometer, setClosingOdometer] = useState("");
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailName, setDetailName] = useState("");
  const [detailMobile, setDetailMobile] = useState("");
  const [detailEmail, setDetailEmail] = useState("");
  const [detailCity, setDetailCity] = useState("");
  const [detailModel, setDetailModel] = useState("");
  const [detailRemarks, setDetailRemarks] = useState("");

  const primeDetailDrafts = (b: Booking) => {
    setDetailName(b.testDriveId?.customerName ?? b.customerId?.name ?? "");
    setDetailMobile(b.testDriveId?.mobile ?? b.customerId?.mobile ?? "");
    setDetailEmail(b.testDriveId?.email ?? b.customerId?.email ?? "");
    setDetailCity(b.testDriveId?.city ?? b.customerId?.city ?? "");
    setDetailModel(b.preferredModel || b.testDriveId?.model || "");
    setDetailRemarks(b.testDriveId?.remarks ?? b.remarks ?? "");
  };

  const isTerminalStatus = (status: string) => ["COMPLETED", "CANCELLED", "MISSED"].includes(status);

  const isStep1Complete = (b: Booking) => Boolean(b.assignedExecutive?._id);
  const isVehicleAssigned = (b: Booking) => Boolean(b.vehicleId?._id || b.vehicleId);
  const isReadyForDrive = (b: Booking) => isStep1Complete(b) && isVehicleAssigned(b);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: "100" });
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterDate) params.set("date", filterDate);
      if (filterExecutive !== "all") {
        params.set(
          "assignedExecutive",
          filterExecutive === "unassigned" ? "unassigned" : filterExecutive,
        );
      }
      const { data } = await adminGet<Booking[]>(`/admin/td/bookings?${params}`);
      setBookings(data ?? []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDate, filterExecutive]);

  useEffect(() => { void fetchBookings(); }, [fetchBookings]);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await adminGet<Executive[]>("/admin/td/bookings/executives/list");
        setExecutives(data ?? []);
      } catch {
        setExecutives([]);
      }
    })();
  }, []);

  const refreshSelected = useCallback(async (id: string) => {
    try {
      const { data } = await adminGet<Booking>(`/admin/td/bookings/${id}`);
      if (data) {
        setSelected(data);
        setAssignExecutiveId(data.assignedExecutive?._id ?? "");
        setAssignVehicleId(data.vehicleId?._id ?? "");
      }
      return data ?? null;
    } catch {
      return null;
    }
  }, []);

  const loadAvailableVehicles = useCallback(async (b: Booking) => {
    if (!b.branchId?._id) {
      setAvailableVehicles([]);
      return;
    }
    setVehiclesLoading(true);
    try {
      const model = b.testDriveId?.model || b.preferredModel || "";
      const params = new URLSearchParams({ branchId: b.branchId._id, limit: "50" });
      if (model) params.set("model", model);
      const { data } = await adminGet<DemoVehicleOption[]>(`/admin/td/vehicles?${params}`);
      const list = (data ?? []).filter((v) =>
        ["AVAILABLE", "BOOKED"].includes(v.status) ||
        String(v._id) === String(b.vehicleId?._id),
      );
      setAvailableVehicles(list);
    } catch {
      setAvailableVehicles([]);
    } finally {
      setVehiclesLoading(false);
    }
  }, []);
  const openBookingDetail = async (b: Booking) => {
    setSelected(b);
    setDetailLoading(true);
    setAssignExecutiveId(b.assignedExecutive?._id ?? "");
    setAssignVehicleId(b.vehicleId?._id ?? "");
    setBookingFeedback(null);
    setTdLog(null);
    setOpeningOdometer("");
    setClosingOdometer("");
    setEditingDetails(false);
    primeDetailDrafts(b);
    try {
      const refreshed = await refreshSelected(b._id);
      if (refreshed) primeDetailDrafts(refreshed);
      await loadAvailableVehicles(refreshed ?? b);
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
      b.customerId?.mobile?.includes(s) ||
      b.vehicleId?.registrationNo?.toLowerCase().includes(s)
    );
  });

  const handleDetailsSave = async () => {
    if (!selected || !canEditDetails) return;
    const mobileDigits = detailMobile.replace(/\D/g, "").slice(0, 10);
    if (!detailName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }
    if (!detailModel) {
      toast.error("Select a vehicle model");
      return;
    }
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/bookings/${selected._id}/details`, {
        customerName: detailName.trim(),
        customerMobile: mobileDigits,
        customerEmail: detailEmail.trim(),
        customerCity: detailCity.trim(),
        preferredModel: detailModel,
        remarks: detailRemarks.trim(),
      });
      toast.success("Booking details updated");
      setEditingDetails(false);
      const refreshed = await refreshSelected(selected._id);
      if (refreshed) {
        primeDetailDrafts(refreshed);
        await loadAvailableVehicles(refreshed);
      }
      void fetchBookings();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

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

  const handleDeleteBooking = async () => {
    if (!deleteDialog || !canDelete) return;
    setActionLoading(true);
    try {
      await adminDeleteJson(`/admin/td/bookings/${deleteDialog._id}`);
      toast.success(`Booking ${deleteDialog.bookingId} deleted`);
      if (selected?._id === deleteDialog._id) setSelected(null);
      setDeleteDialog(null);
      void fetchBookings();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filtered.map((b) => b._id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };

  const handleBulkDeleteBookings = async () => {
    if (!canDelete || selectedIds.size === 0) return;
    setActionLoading(true);
    try {
      const result = await adminPostJson<{
        deleted: number;
        requested: number;
        skippedInProgress?: string[];
      }>("/admin/td/bookings/bulk-delete", { ids: [...selectedIds] });
      const skipped = result.skippedInProgress?.length ?? 0;
      toast.success(
        skipped
          ? `Deleted ${result.deleted} booking(s); skipped ${skipped} in progress`
          : `Deleted ${result.deleted} booking(s)`,
      );
      exitSelectMode();
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

  const handleAssignExecutive = async (id: string) => {
    if (!assignExecutiveId) {
      toast.error("Select an executive first");
      return;
    }
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/bookings/${id}/assign-executive`, { executiveId: assignExecutiveId });
      toast.success("Executive assigned");
      void fetchBookings();
      if (selected?._id === id) await refreshSelected(id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignVehicle = async (id: string) => {
    if (!assignVehicleId) {
      toast.error("Select a demo vehicle first");
      return;
    }
    setActionLoading(true);
    try {
      await adminPatchJson(`/admin/td/bookings/${id}/assign-vehicle`, { vehicleId: assignVehicleId });
      toast.success("Demo vehicle assigned — booking confirmed when executive is also set");
      void fetchBookings();
      if (selected?._id === id) {
        await refreshSelected(id);
        if (selected) await loadAvailableVehicles(selected);
      }
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartDriving = async (id: string) => {
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
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setRescheduleDate(iso);
    setRescheduleTime(b.slotTime);
    setRescheduleSlots([]);
  };

  const loadRescheduleSlots = async () => {
    if (!rescheduleDialog?.branchId?._id || !rescheduleDate) {
      toast.error("Branch or date missing");
      return;
    }
    setRescheduleSlotsLoading(true);
    try {
      const variant =
        rescheduleDialog.testDriveId?.variant ||
        (rescheduleDialog as Booking & { preferredVariant?: string }).preferredVariant ||
        "";
      const q = new URLSearchParams({
        branchId: rescheduleDialog.branchId._id,
        date: rescheduleDate,
        model: rescheduleDialog.preferredModel || rescheduleDialog.testDriveId?.model || "",
      });
      if (variant) q.set("variant", variant);
      const { data } = await adminGet<{ time: string; label?: string; available: boolean }[]>(
        `/admin/td/slots/available?${q}`,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-primary" /> TD Bookings
          </h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} booking(s) · website test drives sync here automatically
            {canDelete ? " · open a booking to Cancel or permanently Delete" : ""}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            onClick={() => setFilterDate(todayIso())}
            variant={filterDate === todayIso() ? "default" : "outline"}
            size="sm"
          >
            Today
          </Button>
          <Button
            onClick={() => setFilterDate("")}
            variant={filterDate === "" ? "default" : "outline"}
            size="sm"
          >
            All dates
          </Button>
          <Button onClick={() => void fetchBookings()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          {canCreate ? (
          <Button onClick={() => setShowNewBooking(true)} size="sm">
            <CalendarClock className="w-4 h-4 mr-2" /> New booking
          </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (selectMode) exitSelectMode();
                else setSelectMode(true);
              }}
            >
              {selectMode ? <X className="w-4 h-4 mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
              {selectMode ? "Cancel select" : "Select"}
            </Button>
          ) : null}
        </div>
      </div>

      <BookTestDriveDialog
        open={showNewBooking}
        onOpenChange={setShowNewBooking}
        allowCustomerEdit
        customer={EMPTY_WALK_IN_CUSTOMER}
        onBooked={() => void fetchBookings()}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search booking / customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-secondary/50" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ALL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(canAssign || canEditDetails) ? (
          <Select value={filterExecutive} onValueChange={setFilterExecutive}>
            <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Executive" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (my team)</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {executives.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.name}
                  {e.designationLabel ? ` · ${e.designationLabel}` : ""}
                  {adminUser && (e._id === adminUser._id || e.email?.toLowerCase() === adminUser.email?.toLowerCase())
                    ? " · Me"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="bg-secondary/50"
          title="Filter by scheduled slot date (not submission date)"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading bookings...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No bookings found</p>
        </div>
      ) : (
        <>
        {selectMode && canDelete ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
            <Button type="button" variant="outline" size="sm" onClick={toggleSelectAllVisible}>
              {filtered.length > 0 && filtered.every((b) => selectedIds.has(b._id)) ? (
                <><Square className="w-4 h-4 mr-2" /> Deselect all</>
              ) : (
                <><CheckSquare className="w-4 h-4 mr-2" /> Select all</>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedIds.size === 0 || actionLoading}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete selected
            </Button>
          </div>
        ) : null}
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((b) => (
            <Card
              key={b._id}
              className={cn(
                "bg-card border-border/50 p-4 space-y-3 transition-colors",
                !selectMode && "hover:border-primary/30",
                selectMode && selectedIds.has(b._id) && "border-primary/50 bg-primary/5",
              )}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {selectMode && canDelete ? (
                    <Checkbox
                      checked={selectedIds.has(b._id)}
                      disabled={b.bookingStatus === "IN_PROGRESS"}
                      onCheckedChange={() => {
                        if (b.bookingStatus === "IN_PROGRESS") {
                          toast.error("Cannot delete a booking that is in progress");
                          return;
                        }
                        toggleSelectId(b._id);
                      }}
                      className="mt-1 shrink-0"
                      aria-label={`Select ${b.bookingId}`}
                    />
                  ) : null}
                  <div className="min-w-0">
                  <p className="text-xs text-muted-foreground font-mono">{b.bookingId}</p>
                  <p className="font-semibold text-foreground truncate">{b.customerId?.name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{b.customerId?.mobile}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge className={`text-[10px] border ${STATUS_COLORS[b.bookingStatus] ?? "bg-secondary"}`}>
                    {b.bookingStatus}
                  </Badge>
                  {b.isRepeatDrive ? (
                    <Badge className="text-[10px] border bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      REPEAT
                    </Badge>
                  ) : null}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-2 text-xs border-t border-border/30 pt-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>{new Date(b.slotDate).toLocaleDateString("en-IN")} {formatTime12h(b.slotTime)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Car className="w-3.5 h-3.5 shrink-0" />
                  <span>{b.vehicleId ? `${b.vehicleId.model} — ${b.vehicleId.registrationNo}` : b.preferredModel || "TBD"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>{b.assignedExecutive?.name ?? "Unassigned"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{b.branchId?.name ?? "—"}</span>
                </div>
              </div>

              {/* DL badge (optional) */}
              <div className="flex items-center gap-1.5 text-xs">
                {b.dlVerified ? (
                  <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3 h-3" /> DL Verified</span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">DL not verified (optional)</span>
                )}
              </div>

              {/* Actions — open verify panel only */}
              <div className="border-t border-border/30 pt-3">
                {selectMode ? (
                  <p className="text-[11px] text-muted-foreground text-center">
                    {b.bookingStatus === "IN_PROGRESS"
                      ? "In progress — cannot select for delete"
                      : "Tap the checkbox to select for bulk delete"}
                  </p>
                ) : (
                <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => void openBookingDetail(b)}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> Verify & manage
                </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Verify & manage booking</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5 text-sm">
              {detailLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading details…
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={`border ${STATUS_COLORS[selected.bookingStatus] ?? "bg-secondary"}`}>
                      {selected.bookingStatus}
                    </Badge>
                    {selected.isRepeatDrive ? (
                      <Badge className="border bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">
                        Repeat drive (admin approved)
                      </Badge>
                    ) : null}
                    <span className="font-mono text-xs text-muted-foreground">{selected.bookingId}</span>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Customer (website form)</p>
                      {canEditDetails && !editingDetails ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={actionLoading}
                          onClick={() => {
                            primeDetailDrafts(selected);
                            setEditingDetails(true);
                          }}
                        >
                          <Pencil className="w-3 h-3 mr-1.5" /> Edit
                        </Button>
                      ) : null}
                    </div>

                    {editingDetails ? (
                      <div className="space-y-3">
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Name *</Label>
                            <Input
                              value={detailName}
                              onChange={(e) => setDetailName(e.target.value)}
                              className="bg-background/80"
                              placeholder="Customer name"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Mobile *</Label>
                            <Input
                              value={detailMobile}
                              onChange={(e) => setDetailMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                              inputMode="numeric"
                              maxLength={10}
                              className="bg-background/80"
                              placeholder="10-digit mobile"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Email</Label>
                            <Input
                              type="email"
                              value={detailEmail}
                              onChange={(e) => setDetailEmail(e.target.value)}
                              className="bg-background/80"
                              placeholder="Optional"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">City</Label>
                            <Input
                              value={detailCity}
                              onChange={(e) => setDetailCity(e.target.value)}
                              className="bg-background/80"
                              placeholder="City / district"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Model *</Label>
                            <Select value={detailModel || "none"} onValueChange={(v) => setDetailModel(v === "none" ? "" : v)}>
                              <SelectTrigger className="bg-background/80"><SelectValue placeholder="Select model" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Select model —</SelectItem>
                                {catalogModels.map((m) => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground">
                              Changing the model releases a demo vehicle that no longer matches.
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Remarks</Label>
                            <Input
                              value={detailRemarks}
                              onChange={(e) => setDetailRemarks(e.target.value)}
                              className="bg-background/80"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" disabled={actionLoading} onClick={() => void handleDetailsSave()}>
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Save details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionLoading}
                            onClick={() => {
                              setEditingDetails(false);
                              primeDetailDrafts(selected);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {[
                            ["Name", selected.testDriveId?.customerName ?? selected.customerId?.name],
                            ["Mobile", selected.testDriveId?.mobile ?? selected.customerId?.mobile],
                            ["Email", selected.testDriveId?.email ?? selected.customerId?.email],
                            ["City", selected.testDriveId?.city ?? selected.customerId?.city],
                            ["Model", selected.testDriveId?.model ?? selected.preferredModel],
                            ["Variant", selected.testDriveId?.variant],
                            ["TD location", selected.testDriveId?.preferredTestDriveLocation],
                            ["Owns car", selected.testDriveId?.ownsCar],
                            ["Current car", selected.testDriveId?.currentCarDetails],
                            ["Purchase plan", selected.testDriveId?.purchaseTimeline],
                            ["Slot", `${new Date(selected.slotDate).toLocaleDateString("en-IN")} · ${formatTime12h(selected.slotTime)}`],
                            ["Branch", selected.branchId?.name],
                          ].map(([label, val]) => (
                            <div key={label}>
                              <p className="text-[11px] text-muted-foreground">{label}</p>
                              <p className="font-medium text-foreground">{val || "—"}</p>
                            </div>
                          ))}
                        </div>
                        {selected.testDriveId?.remarks || selected.remarks ? (
                          <div>
                            <p className="text-[11px] text-muted-foreground">Remarks</p>
                            <p className="text-foreground text-xs leading-relaxed mt-0.5">
                              {selected.testDriveId?.remarks || selected.remarks}
                            </p>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Step 1 — Assign staff</p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${selected.assignedExecutive?._id ? "border-green-400/40 bg-green-400/10 text-green-400" : "border-yellow-400/40 bg-yellow-400/10 text-yellow-400"}`}>
                        {selected.assignedExecutive?._id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        Executive {selected.assignedExecutive?._id ? `· ${selected.assignedExecutive.name}` : "· not assigned"}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${selected.dlVerified ? "border-green-400/40 bg-green-400/10 text-green-400" : "border-border/60 bg-muted/30 text-muted-foreground"}`}>
                        {selected.dlVerified ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                        DL {selected.dlVerified ? "verified" : "optional · not verified"}
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Assign staff</Label>
                        {canAssign ? (
                          <>
                        <Select value={assignExecutiveId} onValueChange={setAssignExecutiveId}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Choose staff member" /></SelectTrigger>
                          <SelectContent>
                            {executives.map((e) => (
                              <SelectItem key={e._id} value={e._id}>
                                {e.name} ({e.designationLabel || designationLabel(e.designation) || e.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={actionLoading || !assignExecutiveId}
                          onClick={() => void handleAssignExecutive(selected._id)}
                        >
                          <UserCheck className="w-4 h-4 mr-2" /> Save executive
                        </Button>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground pt-1">
                            {selected.assignedExecutive?.name || "Not assigned"} · view only
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <DrivingLicenceVerify
                          bookingId={selected._id}
                          dlVerified={selected.dlVerified}
                          dlImageUrl={selected.dlImageUrl}
                          dlNumber={selected.dlNumber}
                          dlValidUntil={selected.dlValidUntil}
                          disabled={actionLoading}
                          canEdit={canVerifyDl}
                          onVerified={async () => {
                            if (selected?._id) await refreshSelected(selected._id);
                            void fetchBookings();
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      Step 1b — Assign demo vehicle
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Confirm a demo car is available for this customer&apos;s model. If none is free, use{" "}
                      <span className="text-primary font-medium">Reschedule</span> to move them to another slot.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border ${
                          isVehicleAssigned(selected)
                            ? "border-green-400/40 bg-green-400/10 text-green-400"
                            : "border-yellow-400/40 bg-yellow-400/10 text-yellow-400"
                        }`}
                      >
                        {isVehicleAssigned(selected) ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        Vehicle{" "}
                        {isVehicleAssigned(selected)
                          ? `· ${selected.vehicleId?.registrationNo} (${selected.vehicleId?.model})`
                          : "· not assigned"}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Available demo fleet ({selected.preferredModel || selected.testDriveId?.model || "all"})</Label>
                      {canAssign ? (
                      <>
                      {vehiclesLoading ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading vehicles…
                        </p>
                      ) : (
                        <Select value={assignVehicleId || "none"} onValueChange={(v) => setAssignVehicleId(v === "none" ? "" : v)}>
                          <SelectTrigger className="bg-secondary/50">
                            <SelectValue placeholder="Choose demo vehicle" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Select vehicle —</SelectItem>
                            {availableVehicles.map((v) => (
                              <SelectItem key={v._id} value={v._id}>
                                {v.registrationNo} · {v.model} {v.variant} · {v.status} · {v.batteryPercent}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {availableVehicles.length === 0 && !vehiclesLoading ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          No demo vehicle available for this model — reschedule the customer to another date/time.
                        </p>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        disabled={actionLoading || !assignVehicleId || isTerminalStatus(selected.bookingStatus)}
                        onClick={() => void handleAssignVehicle(selected._id)}
                      >
                        <Car className="w-4 h-4 mr-2" /> Save vehicle assignment
                      </Button>
                      </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {selected.vehicleId?.registrationNo
                            ? `${selected.vehicleId.registrationNo} · view only`
                            : "Not assigned · view only"}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isTerminalStatus(selected.bookingStatus) ? (
                    <div
                      className={`rounded-lg border p-4 space-y-3 transition-opacity ${
                        isReadyForDrive(selected)
                          ? "border-primary/25 bg-primary/5"
                          : "border-dashed border-yellow-400/30 bg-yellow-400/5 opacity-75"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {!isReadyForDrive(selected) ? (
                          <Lock className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                        ) : null}
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            isReadyForDrive(selected) ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          Step 2 — Manage test drive
                        </p>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="opening-odometer" className="text-xs">
                            Opening odometer (km) *
                          </Label>
                          <Input
                            id="opening-odometer"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            placeholder="e.g. 1240"
                            value={openingOdometer}
                            onChange={(e) => setOpeningOdometer(e.target.value)}
                            disabled={
                              actionLoading ||
                              selected.bookingStatus === "IN_PROGRESS" ||
                              selected.bookingStatus === "COMPLETED"
                            }
                            className="bg-background/80"
                          />
                          {selected.vehicleId?.currentOdometer != null ? (
                            <p className="text-[10px] text-muted-foreground">
                              Fleet reading: {selected.vehicleId.currentOdometer} km
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="closing-odometer" className="text-xs">
                            Closing odometer (km) *
                          </Label>
                          <Input
                            id="closing-odometer"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            placeholder="After test drive"
                            value={closingOdometer}
                            onChange={(e) => setClosingOdometer(e.target.value)}
                            disabled={actionLoading || selected.bookingStatus !== "IN_PROGRESS"}
                            className="bg-background/80"
                          />
                          {tdLog?.totalKM != null ? (
                            <p className="text-[10px] text-muted-foreground">
                              Distance driven: {tdLog.totalKM} km
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {canStartDrive ? (
                        <Button
                          size="sm"
                          className="h-10"
                          disabled={!isReadyForDrive(selected) || actionLoading || selected.bookingStatus === "IN_PROGRESS"}
                          onClick={() => void handleStartDriving(selected._id)}
                        >
                          <Play className="w-4 h-4 mr-2" /> Start driving
                        </Button>
                        ) : null}
                        {canStartDrive ? (
                        <Button
                          size="sm"
                          className="h-10 bg-green-600 hover:bg-green-700 disabled:opacity-40"
                          disabled={!isReadyForDrive(selected) || actionLoading || selected.bookingStatus !== "IN_PROGRESS"}
                          onClick={openCompleteDialog}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Mark completed
                        </Button>
                        ) : null}
                        {canReschedule ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10"
                          disabled={!isStep1Complete(selected) || actionLoading}
                          onClick={() => {
                            openRescheduleDialog(selected);
                            setSelected(null);
                          }}
                        >
                          <CalendarClock className="w-4 h-4 mr-2" /> Reschedule
                        </Button>
                        ) : null}
                        {canCancel ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-10"
                          disabled={!isStep1Complete(selected) || actionLoading}
                          onClick={() => {
                            setCancelDialog(selected);
                            setSelected(null);
                          }}
                        >
                          <Ban className="w-4 h-4 mr-2" /> Cancel booking
                        </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={actionLoading || selected.bookingStatus === "IN_PROGRESS"}
                            onClick={() => setDeleteDialog(selected)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </Button>
                        ) : null}
                      </div>
                      {!isReadyForDrive(selected) ? (
                        <p className="text-[11px] text-muted-foreground">
                          Assign both an executive and a demo vehicle before starting the test drive.
                        </p>
                      ) : selected.bookingStatus === "IN_PROGRESS" ? (
                        <p className="text-[11px] text-muted-foreground">
                          Drive in progress — tap Mark completed to capture the closing odometer, photos, location, and
                          customer feedback.
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Enter opening odometer, then tap Start driving when the customer begins the test drive.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {isTerminalStatus(selected.bookingStatus) ? (
                    selected.bookingStatus === "COMPLETED" ? (
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
                      <div className="space-y-3">
                        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                          This booking is <span className="font-medium text-foreground">{selected.bookingStatus}</span> — no further actions available.
                        </div>
                        {canDelete ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={actionLoading || selected.bookingStatus === "IN_PROGRESS"}
                            onClick={() => setDeleteDialog(selected)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete record
                          </Button>
                        ) : null}
                      </div>
                    )
                  ) : null}
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

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleDialog} onOpenChange={(o) => !o && setRescheduleDialog(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Reschedule booking</DialogTitle></DialogHeader>
          {rescheduleDialog && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                {rescheduleDialog.bookingId} · {rescheduleDialog.customerId?.name}
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">New date</Label>
                <Input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => {
                    setRescheduleDate(e.target.value);
                    setRescheduleTime("");
                    setRescheduleSlots([]);
                  }}
                  className="bg-secondary/50"
                />
              </div>
              <Button type="button" variant="outline" size="sm" disabled={rescheduleSlotsLoading || !rescheduleDate} onClick={() => void loadRescheduleSlots()}>
                {rescheduleSlotsLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Load available slots
              </Button>
              {rescheduleSlots.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">New time slot</Label>
                  <Select value={rescheduleTime} onValueChange={setRescheduleTime}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Pick time" /></SelectTrigger>
                    <SelectContent>
                      {rescheduleSlots.filter((s) => s.available || s.time === rescheduleDialog.slotTime).map((s) => (
                        <SelectItem key={s.time} value={s.time} disabled={!s.available && s.time !== rescheduleDialog.slotTime}>
                          {s.label ?? formatTime12h(s.time)} {!s.available ? "(full)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="flex gap-3 pt-2">
                <Button className="flex-1" disabled={actionLoading || !rescheduleDate || !rescheduleTime} onClick={() => void handleReschedule()}>
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarClock className="w-4 h-4 mr-2" />}
                  Save reschedule
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setRescheduleDialog(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialog} onOpenChange={(o) => !o && setCancelDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Cancel Booking</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Cancelling <span className="text-foreground font-mono">{cancelDialog?.bookingId}</span> for <span className="text-foreground">{cancelDialog?.customerId?.name}</span>.</p>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="bg-secondary/50" rows={3} placeholder="e.g. Customer requested cancellation" />
            </div>
            <div className="flex gap-3">
              <Button variant="destructive" className="flex-1" onClick={() => void handleCancel()} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />} Confirm Cancel
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setCancelDialog(null)}>Keep Booking</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permanent delete — managers only; distinct from Cancel */}
      <Dialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Delete booking permanently?</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This permanently removes{" "}
              <span className="text-foreground font-mono">{deleteDialog?.bookingId}</span> from the database.
              Prefer <strong>Cancel booking</strong> if you only need to mark it cancelled and keep the history.
            </p>
            {deleteDialog?.bookingStatus === "IN_PROGRESS" ? (
              <p className="text-xs text-destructive">Cannot delete while a drive is in progress — complete or cancel it first.</p>
            ) : null}
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => void handleDeleteBooking()}
                disabled={actionLoading || deleteDialog?.bookingStatus === "IN_PROGRESS"}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete forever
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setDeleteDialog(null)}>
                Keep record
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete selected bookings?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Permanently delete <strong className="text-foreground">{selectedIds.size}</strong> booking(s)?
              In-progress drives are skipped. Prefer Cancel if you only need to keep history.
            </p>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={actionLoading || selectedIds.size === 0}
                onClick={() => void handleBulkDeleteBookings()}
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete forever
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setBulkDeleteOpen(false)}>
                Keep
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
