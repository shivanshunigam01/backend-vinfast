import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Users, Search, RefreshCw, Loader2, Phone, Clock,
  MessageSquare, ArrowRight, CheckCircle2, CalendarClock, UserCheck, Plus, ChevronLeft, ChevronRight, Pencil,
  History, Trophy, ShieldAlert, Trash2, CheckSquare, Square, X, Download, Upload, FileSpreadsheet, Star,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, isFieldStaffUser, canPerformAction, canPerformManagerAction } from "@/lib/adminAuth";
import { createVehicleOrder } from "@/lib/stockDeliveryApi";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  addPvCrmFollowUp,
  assignPvCrmLeadExecutive,
  completePvCrmFollowUp,
  fetchAssignableStaffUsers,
  fetchPvCrmLeadDetail,
  fetchPvCrmLeads,
  fetchPvCrmLeadStats,
  togglePvCrmFavourite,
  displayCrmLeadName,
  PV_CRM_SOURCES,
  updatePvCrmLeadDetails,
  updatePvCrmLeadRemarks,
  updatePvCrmLeadStage,
  convertPvCrmLeadToSale,
  deletePvCrmLead,
  bulkDeletePvCrmLeads,
  exportPvCrmLeadsExcel,
  importPvCrmLeadsFile,
  downloadPvCrmLeadImportTemplate,
  downloadCrmImportErrors,
  fetchOpportunityDuplicates,
  CRM_IMPORT_MODEL_OPTIONS,
  type AssignableStaffUser,
  type PvCrmLead,
  type PvCrmLeadDetail,
  type PvCrmLeadDateField,
  type OpportunityDuplicatesReport,
  type CrmLeadImportFailure,
  type CrmLeadImportRow,
  type CrmLeadImportRowStatus,
} from "@/lib/pvLeadCrmApi";
import { lookupCrmCustomerByMobile, type CustomerHistory } from "@/lib/crmCustomerApi";
import { CustomerHistoryDialog } from "@/components/admin/CustomerHistoryDialog";
import { CRM_LEAD_STAGES, normalizeCrmStage, STAGE_COLORS } from "@/lib/leadStages";
import { useCrmLeadStages } from "@/hooks/useCrmLeadStages";
import { cn } from "@/lib/utils";
import { AddPvLeadDialog } from "@/components/admin/AddPvLeadDialog";
import { BookTestDriveDialog } from "@/components/admin/BookTestDriveDialog";
import { LeadFollowUpTimeline } from "@/components/admin/LeadFollowUpTimeline";
import { fetchBuyerTypes, type BuyerTypeDoc } from "@/lib/buyerTypesApi";
import { ModelTrimSelect } from "@/components/ModelTrimSelect";
import { leadModelLabel, parseStoredModelLine } from "@/data/vinfastModels";
import { Checkbox } from "@/components/ui/checkbox";

function stageBadgeClass(stage: string) {
  const normalized = normalizeCrmStage(stage);
  return STAGE_COLORS[normalized] ?? "bg-muted text-muted-foreground";
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy · h:mm a");
  } catch {
    return "—";
  }
}

const PAGE_SIZE = 20;

function followUpColor(highlight?: string) {
  if (highlight === "overdue") return "text-red-600 dark:text-red-400";
  if (highlight === "today") return "text-orange-600 dark:text-orange-400";
  if (highlight === "none") return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}

export default function AdminCrmLeads() {
  const adminUser = getAdminUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreateVehicleOrder = canPerformAction(adminUser, "stock_delivery", "create");
  const isExecutive = isFieldStaffUser(adminUser);
  const isCre = String(adminUser?.designation || "").toLowerCase() === "cre";
  const isAdminPortal =
    adminUser?.userType === "admin" || adminUser?.role === "superadmin";
  const canCreate = canPerformAction(adminUser, "crm_leads", "create");
  const canUpdate = canPerformAction(adminUser, "crm_leads", "update");
  const canAssignLeads =
    isCre || canPerformManagerAction(adminUser, "crm_leads", "assign");
  const canEditDetails = canPerformManagerAction(adminUser, "crm_leads", "update");
  const canDelete =
    isCre || canPerformManagerAction(adminUser, "crm_leads", "delete");
  /** Bulk Excel download/upload — Admin + CRE (and managers with export/create). */
  const canExportExcel =
    isAdminPortal ||
    isCre ||
    canPerformAction(adminUser, "crm_leads", "export") ||
    canAssignLeads;
  const canImportExcel =
    canCreate && (isAdminPortal || isCre || adminUser?.role === "manager" || canAssignLeads);

  const { stages: crmStages } = useCrmLeadStages();
  const stageList = crmStages.length ? crmStages : [...CRM_LEAD_STAGES];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [leads, setLeads] = useState<PvCrmLead[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterSource, setFilterSource] = useState("all");
  const [executives, setExecutives] = useState<AssignableStaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  // Default CRE list to unassigned so the calling queue is obvious; backend also scopes CRE.
  const [filterExecutive, setFilterExecutive] = useState(isCre ? "unassigned" : "all");
  const [followUpDueOnly, setFollowUpDueOnly] = useState(false);
  const [favouriteOnly, setFavouriteOnly] = useState(false);
  const [filterBuyerType, setFilterBuyerType] = useState("all");
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
  const [favouriteCount, setFavouriteCount] = useState(0);
  const [buyerTypes, setBuyerTypes] = useState<BuyerTypeDoc[]>([]);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeOutcome, setCompleteOutcome] = useState("");
  const [completeNextAction, setCompleteNextAction] = useState("");
  const [completeNextAt, setCompleteNextAt] = useState("");
  const [completeInterest, setCompleteInterest] = useState("");
  const [completeRemarks, setCompleteRemarks] = useState("");
  const [followUpNextAction, setFollowUpNextAction] = useState("");
  const [followUpInterest, setFollowUpInterest] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterDateField, setFilterDateField] = useState<PvCrmLeadDateField>("created");
  const [selected, setSelected] = useState<PvCrmLead | null>(null);
  const [detail, setDetail] = useState<PvCrmLeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [stageDraft, setStageDraft] = useState("");
  const [stageReason, setStageReason] = useState("");
  const [remarksDraft, setRemarksDraft] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpScheduled, setFollowUpScheduled] = useState("");
  const [followUpOutcome, setFollowUpOutcome] = useState("");
  const [followUpCompleted, setFollowUpCompleted] = useState(false);
  const [assignExecutiveId, setAssignExecutiveId] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [showBookTestDrive, setShowBookTestDrive] = useState(false);

  const [customerHistory, setCustomerHistory] = useState<CustomerHistory | null>(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [convertStage, setConvertStage] = useState<"Booking" | "Delivered">("Booking");
  const [convertBuyerDiffers, setConvertBuyerDiffers] = useState(false);
  const [convertBuyerName, setConvertBuyerName] = useState("");
  const [convertBuyerMobile, setConvertBuyerMobile] = useState("");
  const [convertRegistration, setConvertRegistration] = useState("");
  const [convertRemarks, setConvertRemarks] = useState("");

  const [oppReport, setOppReport] = useState<OpportunityDuplicatesReport | null>(null);
  const [showOppReport, setShowOppReport] = useState(false);
  const [oppLoading, setOppLoading] = useState(false);

  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editModel, setEditModel] = useState("VF 7");
  const [editVariant, setEditVariant] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editBuyerType, setEditBuyerType] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [importResultOpen, setImportResultOpen] = useState(false);
  const [importListFilter, setImportListFilter] = useState<"all" | CrmLeadImportRowStatus>("all");
  const [importRows, setImportRows] = useState<CrmLeadImportRow[]>([]);
  const [importFailures, setImportFailures] = useState<CrmLeadImportFailure[]>([]);
  const [importSummary, setImportSummary] = useState<{
    created: number;
    updated: number;
    followUps: number;
    failed: number;
    total: number;
    needsModel?: number;
    dryRun?: boolean;
  } | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [modelMapOpen, setModelMapOpen] = useState(false);
  const [modelMapRows, setModelMapRows] = useState<CrmLeadImportRow[]>([]);
  const [modelCorrections, setModelCorrections] = useState<Record<string, string>>({});
  const [committingImport, setCommittingImport] = useState(false);

  const primeEditDrafts = (lead: PvCrmLead) => {
    setEditName(lead.customerName || lead.name || "");
    setEditMobile(lead.mobile ?? "");
    setEditEmail(lead.email ?? "");
    setEditCity(lead.city ?? "");
    const parsed = parseStoredModelLine(lead.model ?? "");
    // Ambiguous "Both" cannot be saved — default to a concrete model for the editor.
    setEditModel(parsed.model === "Both" ? "VF 7" : parsed.model);
    setEditVariant(parsed.model === "Both" ? "" : parsed.variant);
    setEditSource(lead.source ?? "");
    setEditBuyerType(lead.buyerType ?? "");
  };

  const loadStaffUsers = useCallback(async () => {
    if (!canAssignLeads) return;
    try {
      const list = await fetchAssignableStaffUsers();
      setExecutives(list);
    } catch (e) {
      toast.error(formatApiErrors(e));
      setExecutives([]);
    }
  }, [canAssignLeads]);

  useEffect(() => {
    void loadStaffUsers();
  }, [loadStaffUsers]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPvCrmLeads({
        search: search.trim() || undefined,
        status: filterStatus,
        source: filterSource,
        followUpDue: followUpDueOnly,
        favourite: favouriteOnly,
        buyerType: filterBuyerType !== "all" ? filterBuyerType : undefined,
        from: filterDateFrom || undefined,
        to: filterDateTo || undefined,
        dateField: filterDateField,
        page,
        limit: PAGE_SIZE,
        assignedTo:
          canAssignLeads && filterExecutive !== "all"
            ? filterExecutive === "unassigned"
              ? "unassigned"
              : filterExecutive
            : undefined,
      });
      setLeads(Array.isArray(res.leads) ? res.leads : []);
      setTotal(res.total ?? 0);
    } catch (e) {
      setLeads([]);
      setTotal(0);
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterSource, followUpDueOnly, favouriteOnly, filterBuyerType, filterDateFrom, filterDateTo, filterDateField, filterExecutive, canAssignLeads, page]);

  const hasDateFilter = Boolean(filterDateFrom || filterDateTo);

  const clearDateFilter = () => {
    setPage(1);
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterDateField("created");
  };

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    void (async () => {
      try {
        const stats = await fetchPvCrmLeadStats({
          source: filterSource,
          assignedTo:
            canAssignLeads && filterExecutive !== "all"
              ? filterExecutive === "unassigned"
                ? "unassigned"
                : filterExecutive
              : undefined,
          from: filterDateFrom || undefined,
          to: filterDateTo || undefined,
        });
        setPipelineCounts(stats.pipeline || {});
        setFavouriteCount(stats.favouriteCount || 0);
      } catch {
        setPipelineCounts({});
      }
    })();
  }, [filterSource, filterExecutive, filterDateFrom, filterDateTo, canAssignLeads, leads]);

  useEffect(() => {
    void fetchBuyerTypes().then(setBuyerTypes).catch(() => setBuyerTypes([]));
  }, []);

  useEffect(() => {
    const id = searchParams.get("lead");
    if (!id) return;
    void (async () => {
      try {
        const d = await fetchPvCrmLeadDetail(id);
        setSelected(d.lead);
        setDetail(d);
      } catch {
        /* ignore */
      }
    })();
  }, [searchParams]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of stageList) counts[s] = pipelineCounts[s] ?? 0;
    return counts;
  }, [pipelineCounts, stageList]);

  const safeLeads = Array.isArray(leads) ? leads : [];
  const staffUsers = Array.isArray(executives) ? executives : [];
  const detailFollowUps = Array.isArray(detail?.followUps) ? detail.followUps : [];
  const detailHistory = Array.isArray(detail?.history) ? detail.history : [];

  const openLead = async (lead: PvCrmLead) => {
    setSelected(lead);
    setDetail(null);
    setStageDraft(normalizeCrmStage(lead.status));
    setStageReason("");
    setRemarksDraft(lead.remarks ?? "");
    setFollowUpNote("");
    setFollowUpScheduled("");
    setFollowUpOutcome("");
    setFollowUpCompleted(false);
    setAssignExecutiveId(lead.assignedTo?._id ?? "");
    primeEditDrafts(lead);
    if (canAssignLeads) void loadStaffUsers();
    setDetailLoading(true);
    try {
      const d = await fetchPvCrmLeadDetail(lead._id);
      setDetail(d);
      setStageDraft(normalizeCrmStage(d.lead.status));
      setRemarksDraft(d.lead.remarks ?? "");
      setAssignExecutiveId(d.lead.assignedTo?._id ?? "");
      primeEditDrafts(d.lead);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (id: string) => {
    const d = await fetchPvCrmLeadDetail(id);
    setDetail(d);
    setSelected(d.lead);
    setStageDraft(normalizeCrmStage(d.lead.status));
    setRemarksDraft(d.lead.remarks ?? "");
    primeEditDrafts(d.lead);
    void loadLeads();
  };

  const handleDetailsSave = async () => {
    if (!selected || !canEditDetails) return;
    const mobileDigits = editMobile.replace(/\D/g, "").slice(0, 10);
    if (!editName.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
      toast.error("Enter a valid 10-digit Indian mobile number");
      return;
    }
    if (!editCity.trim()) {
      toast.error("City is required");
      return;
    }
    setSaving(true);
    try {
      await updatePvCrmLeadDetails(selected._id, {
        name: editName.trim(),
        mobile: mobileDigits,
        email: editEmail.trim(),
        city: editCity.trim(),
        model: leadModelLabel(editModel, editVariant),
        source: editSource || undefined,
        buyerType: editBuyerType || undefined,
      });
      toast.success("Lead details updated");
      await refreshDetail(selected._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAssignExecutive = async () => {
    if (!selected || !canAssignLeads) return;
    setSaving(true);
    try {
      await assignPvCrmLeadExecutive(selected._id, assignExecutiveId || null);
      toast.success(assignExecutiveId ? "Lead assigned to executive" : "Lead unassigned");
      await refreshDetail(selected._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleStageUpdate = async () => {
    if (!selected || !stageDraft) return;
    setSaving(true);
    try {
      const updated = await updatePvCrmLeadStage(selected._id, stageDraft, stageReason.trim() || undefined);
      const vo = updated.vehicleOrder;
      if (stageDraft === "Booking" && vo?.orderNumber) {
        toast.success(
          vo.created
            ? `Booking done — vehicle order ${vo.orderNumber} created`
            : `Booking done — vehicle order ${vo.orderNumber} ready`,
          { action: { label: "Open orders", onClick: () => navigate("/admin/stock/orders") } },
        );
      } else if (stageDraft === "Booking" && updated.vehicleOrderError) {
        toast.error(
          `Booking saved, but vehicle order failed: ${updated.vehicleOrderError}. Set lead model, then use Open vehicle order.`,
        );
      } else {
        toast.success(`Stage updated to ${stageDraft}`);
      }
      await refreshDetail(selected._id);
      setStageReason("");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRemarksSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updatePvCrmLeadRemarks(selected._id, remarksDraft);
      toast.success("Remarks saved");
      await refreshDetail(selected._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAddFollowUp = async () => {
    if (!selected || !followUpNote.trim()) {
      toast.error("Enter a follow-up note");
      return;
    }
    if (followUpCompleted && !followUpOutcome.trim()) {
      toast.error("Enter the follow-up outcome to complete");
      return;
    }
    setSaving(true);
    try {
      await addPvCrmFollowUp(selected._id, {
        note: followUpNote.trim(),
        scheduledAt: followUpScheduled || undefined,
        outcome: followUpOutcome.trim() || undefined,
        markCompleted: followUpCompleted,
        nextAction: followUpNextAction.trim() || undefined,
        nextFollowUpAt: followUpScheduled || undefined,
        interestLevel: followUpInterest || undefined,
      });
      toast.success("Follow-up logged");
      setFollowUpNote("");
      setFollowUpScheduled("");
      setFollowUpOutcome("");
      setFollowUpCompleted(false);
      setFollowUpNextAction("");
      setFollowUpInterest("");
      await refreshDetail(selected._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const openCustomerHistory = async (mobile: string) => {
    setHistoryLoading(true);
    try {
      const res = await lookupCrmCustomerByMobile(mobile);
      if (res.existingCustomer) {
        setCustomerHistory(res);
        setShowCustomerHistory(true);
      } else {
        toast.info("No customer record found for this mobile yet");
      }
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleConvertToSale = async () => {
    if (!selected) return;
    if (convertBuyerDiffers) {
      if (!convertBuyerName.trim()) { toast.error("Enter the buyer's name"); return; }
      if (!/^[6-9]\d{9}$/.test(convertBuyerMobile)) { toast.error("Enter a valid 10-digit buyer mobile"); return; }
    }
    setSaving(true);
    try {
      const res = await convertPvCrmLeadToSale(selected._id, {
        stage: convertStage,
        buyerName: convertBuyerDiffers ? convertBuyerName.trim() : undefined,
        buyerMobile: convertBuyerDiffers ? convertBuyerMobile : undefined,
        vehicleRegistration: convertRegistration.trim() || undefined,
        remarks: convertRemarks.trim() || undefined,
      });
      if (convertStage === "Booking" && res.vehicleOrderError && !res.vehicleOrder?.orderNumber) {
        toast.error(
          `Converted, but vehicle order failed: ${res.vehicleOrderError}. Set lead model, then use Open vehicle order.`,
        );
      } else {
        toast.success(
          res.vehicleOrder?.orderNumber
            ? `Opportunity converted — customer ${res.customer.customerId} — order ${res.vehicleOrder.orderNumber}`
            : `Opportunity converted — customer ${res.customer.customerId}`,
        );
      }
      setConvertBuyerDiffers(false);
      setConvertBuyerName("");
      setConvertBuyerMobile("");
      setConvertRegistration("");
      setConvertRemarks("");
      await refreshDetail(selected._id);
      if (convertStage === "Booking" && res.vehicleOrder?.orderNumber) {
        navigate("/admin/stock/orders");
      }
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const openOpportunityReport = async () => {
    setOppLoading(true);
    setShowOppReport(true);
    try {
      setOppReport(await fetchOpportunityDuplicates());
    } catch (e) {
      toast.error(formatApiErrors(e));
      setShowOppReport(false);
    } finally {
      setOppLoading(false);
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    if (!selected) return;
    if (!completeOutcome.trim()) {
      toast.error("Enter the follow-up outcome to complete");
      return;
    }
    if (!completeRemarks.trim()) {
      toast.error("Enter follow-up remarks to complete");
      return;
    }
    setSaving(true);
    try {
      await completePvCrmFollowUp(selected._id, followUpId, {
        outcome: completeOutcome.trim(),
        note: completeRemarks.trim(),
        nextAction: completeNextAction.trim() || undefined,
        nextFollowUpAt: completeNextAt || undefined,
        interestLevel: completeInterest || undefined,
      });
      toast.success("Follow-up marked completed");
      setCompletingId(null);
      setCompleteOutcome("");
      setCompleteRemarks("");
      setCompleteNextAction("");
      setCompleteNextAt("");
      setCompleteInterest("");
      await refreshDetail(selected._id);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavourite = async (lead: PvCrmLead, e?: { stopPropagation: () => void }) => {
    e?.stopPropagation();
    try {
      const updated = await togglePvCrmFavourite(lead._id);
      setLeads((prev) => prev.map((l) => (l._id === lead._id ? { ...l, isFavourite: updated.isFavourite } : l)));
      if (selected?._id === lead._id) {
        setSelected((s) => (s ? { ...s, isFavourite: updated.isFavourite } : s));
        if (detail?.lead) setDetail({ ...detail, lead: { ...detail.lead, isFavourite: updated.isFavourite } });
      }
      setFavouriteCount((c) => Math.max(0, c + (updated.isFavourite ? 1 : -1)));
    } catch (err) {
      toast.error(formatApiErrors(err));
    }
  };

  const handleDeleteLead = async () => {
    if (!selected || !canDelete) return;
    const label = selected.leadId || selected.name;
    if (!window.confirm(`Permanently delete lead "${label}"? Follow-ups and stage history will also be removed. This cannot be undone.`)) {
      return;
    }
    setSaving(true);
    try {
      await deletePvCrmLead(selected._id);
      toast.success("Lead deleted");
      setSelected(null);
      setDetail(null);
      void loadLeads();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
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
    const visibleIds = safeLeads.map((l) => l._id);
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

  const handleBulkDeleteLeads = async () => {
    if (!canDelete || selectedIds.size === 0) return;
    setSaving(true);
    try {
      const result = await bulkDeletePvCrmLeads([...selectedIds]);
      toast.success(`Deleted ${result.deleted} lead(s)`);
      exitSelectMode();
      void loadLeads();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    if (!canExportExcel) return;
    setExporting(true);
    try {
      await exportPvCrmLeadsExcel({
        search: search.trim() || undefined,
        status: filterStatus,
        source: filterSource,
        from: filterDateFrom || undefined,
        to: filterDateTo || undefined,
        dateField: filterDateField,
        buyerType: filterBuyerType !== "all" ? filterBuyerType : undefined,
        assignedTo:
          canAssignLeads && filterExecutive !== "all"
            ? filterExecutive === "unassigned"
              ? "unassigned"
              : filterExecutive
            : undefined,
      });
      toast.success("Excel download started");
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setExporting(false);
    }
  };

  const applyImportCommitResult = (result: {
    created?: number;
    updated?: number;
    followUpsCreated?: number;
    failed?: CrmLeadImportFailure[];
    rows?: CrmLeadImportRow[];
  }) => {
    const failedRows = result.failed ?? [];
    const failed = failedRows.length;
    const followUps = result.followUpsCreated ?? 0;
    const updated = result.updated ?? 0;
    const created = result.created ?? 0;
    const uploaded = created + updated + failed;
    const detailRows: CrmLeadImportRow[] =
      Array.isArray(result.rows) && result.rows.length
        ? result.rows
        : failedRows.map((f) => ({
            row: f.row,
            status: "failed" as const,
            name: f.name,
            mobile: f.mobile,
            message: f.message,
          }));
    setImportRows(detailRows);
    setImportFailures(failedRows);
    setImportSummary({ created, updated, followUps, failed, total: uploaded });
    setImportListFilter(failed > 0 ? "failed" : "all");
    setImportResultOpen(true);
    setPendingImportFile(null);
    setModelMapOpen(false);
    setModelMapRows([]);
    setModelCorrections({});
    if (failed > 0) {
      toast.warning(
        `Uploaded ${uploaded}: ${created} created, ${updated} updated, ${failed} failed.`,
      );
    } else {
      toast.success(
        `Uploaded ${uploaded}: ${created} created` +
          (updated ? `, ${updated} updated` : "") +
          (followUps ? `, ${followUps} follow-up(s)` : ""),
      );
    }
    void loadLeads();
  };

  const handleImportFile = async (file: File) => {
    if (!canImportExcel) return;
    setImporting(true);
    try {
      const preview = await importPvCrmLeadsFile(file, { dryRun: true });
      const rows = Array.isArray(preview.rows) ? preview.rows : [];
      const needsModelRows = rows.filter((r) => r.status === "needs_model");
      if (needsModelRows.length > 0) {
        setPendingImportFile(file);
        setModelMapRows(needsModelRows);
        const initial: Record<string, string> = {};
        for (const r of needsModelRows) {
          initial[String(r.row)] = "VF 7";
        }
        setModelCorrections(initial);
        setModelMapOpen(true);
        setImportRows(rows);
        setImportFailures(preview.failed ?? []);
        setImportSummary({
          created: preview.created ?? 0,
          updated: preview.updated ?? 0,
          followUps: 0,
          failed: (preview.failed ?? []).length,
          total: rows.length,
          needsModel: needsModelRows.length,
          dryRun: true,
        });
        toast.info(
          `${needsModelRows.length} row(s) have an ambiguous model — map each to a single model before importing.`,
        );
        return;
      }

      // No ambiguous models — commit immediately with the same file
      const result = await importPvCrmLeadsFile(file);
      applyImportCommitResult(result);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setImporting(false);
    }
  };

  const commitImportWithCorrections = async () => {
    if (!pendingImportFile || !canImportExcel) return;
    const missing = modelMapRows.filter((r) => !modelCorrections[String(r.row)]?.trim());
    if (missing.length) {
      toast.error("Select a model for every ambiguous row");
      return;
    }
    setCommittingImport(true);
    try {
      const result = await importPvCrmLeadsFile(pendingImportFile, {
        modelCorrections,
      });
      applyImportCommitResult(result);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setCommittingImport(false);
    }
  };

  const closeImportResult = () => {
    setImportResultOpen(false);
    setImportRows([]);
    setImportFailures([]);
    setImportSummary(null);
    setImportListFilter("all");
  };

  const closeModelMap = () => {
    setModelMapOpen(false);
    setPendingImportFile(null);
    setModelMapRows([]);
    setModelCorrections({});
  };

  const filteredImportRows = useMemo(() => {
    if (importListFilter === "all") return importRows;
    if (importListFilter === "created") {
      return importRows.filter((r) => r.status === "created" || r.status === "would_create");
    }
    if (importListFilter === "updated") {
      return importRows.filter((r) => r.status === "updated" || r.status === "would_update");
    }
    return importRows.filter((r) => r.status === importListFilter);
  }, [importRows, importListFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> Lead CRM
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isCre
              ? "Calling queue — unassigned, unfollowed, and in-calling leads. Assign to executives after the call."
              : isExecutive
                ? "Your assigned leads from website, Meta Ads, test drives, and enquiries."
                : "Unified lead pipeline — assign executives, track stages, notes, and follow-ups."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCreate ? (
            <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => setShowAddLead(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Lead
            </Button>
          ) : null}
          {canImportExcel ? (
            <Button
              variant="outline"
              size="sm"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Bulk upload
            </Button>
          ) : null}
          {canImportExcel ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => downloadPvCrmLeadImportTemplate()}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Template
            </Button>
          ) : null}
          {canExportExcel ? (
            <Button
              variant="outline"
              size="sm"
              disabled={exporting}
              onClick={() => void handleExportExcel()}
            >
              {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download
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
          {canAssignLeads ? (
            <Button variant="outline" size="sm" onClick={() => void openOpportunityReport()}>
              <ShieldAlert className="w-4 h-4 mr-2" /> Opportunity health
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void loadLeads()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
          {canImportExcel ? (
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void handleImportFile(file);
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {stageList.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setPage(1);
              setFilterStatus((prev) => (prev === s ? "all" : s));
            }}
          >
            <Badge
              variant={filterStatus === s ? "default" : "outline"}
              className={cn("text-xs cursor-pointer", stageBadgeClass(s))}
            >
              {s}: {stageCounts[s] ?? 0}
            </Badge>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setFavouriteOnly((v) => !v);
          }}
        >
          <Badge variant={favouriteOnly ? "default" : "outline"} className="text-xs cursor-pointer">
            <Star className={cn("w-3 h-3 mr-1", favouriteOnly ? "fill-current" : "")} />
            Favourite / HOT Leads — {favouriteCount}
          </Badge>
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${canAssignLeads ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search name, mobile, email…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="pl-10 bg-secondary/50"
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(v) => {
            setPage(1);
            setFilterStatus(v);
          }}
        >
          <SelectTrigger className="bg-secondary/50">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {stageList.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterSource}
          onValueChange={(v) => {
            setPage(1);
            setFilterSource(v);
          }}
        >
          <SelectTrigger className="bg-secondary/50">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {PV_CRM_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterBuyerType}
          onValueChange={(v) => {
            setPage(1);
            setFilterBuyerType(v);
          }}
        >
          <SelectTrigger className="bg-secondary/50">
            <SelectValue placeholder="Buyer type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All buyer types</SelectItem>
            {buyerTypes.map((b) => (
              <SelectItem key={b._id} value={b.label}>{b.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canAssignLeads ? (
          <Select
            value={filterExecutive}
            onValueChange={(v) => {
              setPage(1);
              setFilterExecutive(v);
            }}
          >
            <SelectTrigger className="bg-secondary/50">
              <SelectValue placeholder="Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isCre ? "Calling queue (all)" : "All (my team)"}</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {staffUsers.map((e) => (
                <SelectItem key={e._id} value={e._id}>
                  {e.name}{e.designationLabel ? ` · ${e.designationLabel}` : ""}
                  {adminUser && (e._id === adminUser._id || e.email?.toLowerCase() === adminUser.email?.toLowerCase())
                    ? " · Me"
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button
          variant={followUpDueOnly ? "default" : "outline"}
          size="sm"
          className="h-10"
          onClick={() => {
            setPage(1);
            setFollowUpDueOnly((v) => !v);
          }}
        >
          <CalendarClock className="w-4 h-4 mr-2" />
          Follow-ups due
        </Button>
      </div>

      <Card className="bg-card border-border/50 p-4">
        <div className="flex flex-col lg:flex-row gap-3 items-end">
          <div className="space-y-1.5 flex-1 min-w-[140px]">
            <Label className="text-xs">From date</Label>
            <Input
              type="date"
              value={filterDateFrom}
              max={filterDateTo || undefined}
              onChange={(e) => {
                setPage(1);
                setFilterDateFrom(e.target.value);
              }}
              className="bg-secondary/50"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[140px]">
            <Label className="text-xs">To date</Label>
            <Input
              type="date"
              value={filterDateTo}
              min={filterDateFrom || undefined}
              onChange={(e) => {
                setPage(1);
                setFilterDateTo(e.target.value);
              }}
              className="bg-secondary/50"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <Label className="text-xs">Date type</Label>
            <Select
              value={filterDateField}
              onValueChange={(v) => {
                setPage(1);
                setFilterDateField(v as PvCrmLeadDateField);
              }}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Created date</SelectItem>
                <SelectItem value="activity">Last activity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasDateFilter ? (
            <Button variant="outline" size="sm" className="shrink-0 h-10" onClick={clearDateFilter}>
              Clear dates
            </Button>
          ) : null}
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : safeLeads.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No leads found{isExecutive ? " assigned to you" : ""}.</p>
          <p className="text-xs mt-2">Use <strong>Add Lead</strong> to register a walk-in or referral customer.</p>
          {canCreate ? (
            <Button size="sm" className="mt-4 bg-primary text-primary-foreground" onClick={() => setShowAddLead(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Lead
            </Button>
          ) : null}
        </Card>
      ) : (
        <>
        {selectMode && canDelete ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
            <Button type="button" variant="outline" size="sm" onClick={toggleSelectAllVisible}>
              {safeLeads.length > 0 && safeLeads.every((l) => selectedIds.has(l._id)) ? (
                <><Square className="w-4 h-4 mr-2" /> Deselect page</>
              ) : (
                <><CheckSquare className="w-4 h-4 mr-2" /> Select page</>
              )}
            </Button>
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedIds.size === 0 || saving}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete selected
            </Button>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {safeLeads.map((lead) => (
            <Card
              key={lead._id}
              className={cn(
                "p-4 border-border/50 bg-card/50 transition-colors",
                selectMode
                  ? "cursor-default"
                  : "cursor-pointer hover:border-primary/40",
                selectMode && selectedIds.has(lead._id) && "border-primary/50 bg-primary/5",
              )}
              onClick={() => {
                if (selectMode) {
                  toggleSelectId(lead._id);
                  return;
                }
                void openLead(lead);
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  {selectMode && canDelete ? (
                    <Checkbox
                      checked={selectedIds.has(lead._id)}
                      onCheckedChange={() => toggleSelectId(lead._id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 shrink-0"
                      aria-label={`Select ${lead.name}`}
                    />
                  ) : null}
                  <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{displayCrmLeadName(lead)}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {lead.leadId ?? "—"} · {lead.customerId ?? "—"} · {lead.opportunityId ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 shrink-0" /> {lead.mobile}
                  </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline" className={cn("text-[10px] shrink-0", stageBadgeClass(lead.status))}>
                  {normalizeCrmStage(lead.status)}
                </Badge>
                <button
                  type="button"
                  aria-label="Toggle favourite"
                  className="shrink-0 p-0.5 text-muted-foreground hover:text-amber-500"
                  onClick={(e) => void handleToggleFavourite(lead, e)}
                >
                  <Star className={cn("w-4 h-4", lead.isFavourite && "fill-amber-400 text-amber-500")} />
                </button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{lead.model} · {lead.source ?? "Website"}</p>
                {(lead.lastActivityAt || lead.updatedAt) ? (
                  <p className="text-[11px]">
                    Updated {formatDateTime(lead.lastActivityAt || lead.updatedAt)}
                  </p>
                ) : lead.createdAt ? (
                  <p className="text-[11px]">Created {formatDateTime(lead.createdAt)}</p>
                ) : null}
                <p className="flex items-center gap-1">
                  <UserCheck className="w-3 h-3 shrink-0" />
                  {lead.assignedTo?.name ?? "Unassigned"}
                </p>
                {lead.nextFollowUp ? (
                  <p className={followUpColor(lead.followUpHighlight)}>
                    <Clock className="w-3 h-3 inline mr-1" />
                    Follow-up: {formatDateTime(lead.nextFollowUp)}
                  </p>
                ) : (
                  <p className={followUpColor("none")}>Follow-up completed / none pending</p>
                )}
                {lead.buyerType ? <p>Buyer: {lead.buyerType}</p> : null}
                {lead.remarks ? <p className="line-clamp-2">“{lead.remarks}”</p> : null}
                <p>Age: {lead.leadAgeDays ?? 0} day{(lead.leadAgeDays ?? 0) === 1 ? "" : "s"}</p>
              </div>
            </Card>
          ))}
        </div>
        </>
      )}

      {!loading && total > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/50 pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {total} leads · recent activity first
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-1">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={!!selected} onOpenChange={(o) => {
        if (!o) {
          setSelected(null);
          setCompletingId(null);
          if (searchParams.get("lead")) {
            const next = new URLSearchParams(searchParams);
            next.delete("lead");
            setSearchParams(next, { replace: true });
          }
        }
      }}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{displayCrmLeadName(selected)}</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : selected && detail?.lead ? (
            <div className="space-y-5 text-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline" className={stageBadgeClass(detail.lead.status)}>
                  {normalizeCrmStage(detail.lead.status)}
                </Badge>
                <span className="text-xs text-muted-foreground">{detail.lead.model}</span>
                {detail.lead.convertedAt ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                    <Trophy className="w-3 h-3 mr-1" /> Converted to sale
                  </Badge>
                ) : null}
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    disabled={historyLoading}
                    onClick={() => void openCustomerHistory(detail.lead.mobile)}
                  >
                    {historyLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <History className="w-3.5 h-3.5 mr-1.5" />}
                    History
                  </Button>
                  {/* Book Test Drive: hidden for executives once the drive is done — repeats need admin approval. */}
                  {canUpdate && (canAssignLeads || normalizeCrmStage(detail.lead.status) !== "Test Drive Completed") ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => setShowBookTestDrive(true)}
                    >
                      <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> Book Test Drive
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={saving}
                      onClick={() => void handleDeleteLead()}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 rounded-lg border border-border/50 bg-secondary/20 p-4 text-xs">
                <p><span className="text-muted-foreground">Customer name</span><br />{displayCrmLeadName(detail.lead)}</p>
                <p><span className="text-muted-foreground">Customer ID</span><br /><span className="font-mono">{detail.lead.customerId || "—"}</span></p>
                <p><span className="text-muted-foreground">Lead ID</span><br /><span className="font-mono">{detail.lead.leadId || "—"}</span></p>
                <p><span className="text-muted-foreground">Opportunity ID</span><br /><span className="font-mono">{detail.lead.opportunityId || "—"}</span></p>
                <p><span className="text-muted-foreground">Registration</span><br />{detail.lead.vehicleRegistration || "—"}</p>
                {detail.lead.subCustomerName ? (
                  <p className="sm:col-span-2"><span className="text-muted-foreground">Sub-customer</span><br />{detail.lead.subCustomerName} {detail.lead.subCustomerCode ? `(${detail.lead.subCustomerCode})` : ""}</p>
                ) : null}
                <p><span className="text-muted-foreground">Mobile</span><br />{detail.lead.mobile}</p>
                <p><span className="text-muted-foreground">Email</span><br />{detail.lead.email || "—"}</p>
                <p><span className="text-muted-foreground">City</span><br />{detail.lead.city || "—"}</p>
                <p><span className="text-muted-foreground">Source</span><br />{detail.lead.source || "—"}</p>
                <p><span className="text-muted-foreground">Buyer type</span><br />{detail.lead.buyerType || "—"}</p>
                <p><span className="text-muted-foreground">Assigned to</span><br />{detail.lead.assignedTo?.name || "—"}</p>
                <p><span className="text-muted-foreground">Next follow-up</span><br />{formatDateTime(detail.lead.nextFollowUp)}</p>
              </div>

              {canAssignLeads ? (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-primary" /> Assign staff (User Master)
                  </p>
                  {staffUsers.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      No active staff found. Add users under Test Drive → User Master first.
                    </p>
                  ) : null}
                  <Select
                    value={assignExecutiveId || "none"}
                    onValueChange={(v) => setAssignExecutiveId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Choose staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Unassigned —</SelectItem>
                      {staffUsers.map((e) => (
                        <SelectItem key={e._id} value={e._id}>
                          {e.name}
                          {e.designationLabel ? ` · ${e.designationLabel}` : ""}
                          {e.email ? ` (${e.email})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={saving || staffUsers.length === 0}
                    onClick={() => void handleAssignExecutive()}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserCheck className="w-4 h-4 mr-2" />}
                    Save assignment
                  </Button>
                </div>
              ) : null}

              <Tabs defaultValue="stage">
                <TabsList className="bg-secondary/50 w-full flex flex-wrap h-auto">
                  <TabsTrigger value="stage" className="text-xs">Stage</TabsTrigger>
                  {canEditDetails ? (
                    <TabsTrigger value="edit" className="text-xs">Edit details</TabsTrigger>
                  ) : null}
                  {!detail.lead.convertedAt ? (
                    <TabsTrigger value="convert" className="text-xs">Convert</TabsTrigger>
                  ) : null}
                  <TabsTrigger value="remarks" className="text-xs">Remarks</TabsTrigger>
                  <TabsTrigger value="followups" className="text-xs">Follow-ups ({detailFollowUps.length})</TabsTrigger>
                  <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
                  {(detail.siblingLeads?.length ?? 0) > 0 ? (
                    <TabsTrigger value="related" className="text-xs">Other leads ({detail.siblingLeads?.length})</TabsTrigger>
                  ) : null}
                </TabsList>

                <TabsContent value="stage" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Update stage</Label>
                    <Select value={stageDraft} onValueChange={setStageDraft}>
                      <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {/* Once the drive is done, executives can't re-select the test drive stages (repeat drives need admin approval). */}
                        {stageList.filter(
                          (s) =>
                            canAssignLeads ||
                            normalizeCrmStage(detail.lead.status) !== "Test Drive Completed" ||
                            s === normalizeCrmStage(detail.lead.status) ||
                            !["Test Drive Booked", "Test Drive Completed"].includes(s),
                        ).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Reason (optional)</Label>
                    <Input
                      value={stageReason}
                      onChange={(e) => setStageReason(e.target.value)}
                      placeholder="Why is the stage changing?"
                      className="bg-secondary/50"
                    />
                  </div>
                  <Button onClick={() => void handleStageUpdate()} disabled={saving || !canUpdate} className="w-full">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    Update stage
                  </Button>
                </TabsContent>

                {canEditDetails ? (
                  <TabsContent value="edit" className="mt-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Full name *</Label>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-secondary/50"
                          placeholder="Customer name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Mobile *</Label>
                        <Input
                          value={editMobile}
                          onChange={(e) => setEditMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          inputMode="numeric"
                          maxLength={10}
                          className="bg-secondary/50"
                          placeholder="10-digit mobile"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Email</Label>
                        <Input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="bg-secondary/50"
                          placeholder="Optional"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">City *</Label>
                        <Input
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          className="bg-secondary/50"
                          placeholder="City / district"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Vehicle / model *</Label>
                        <ModelTrimSelect
                          id="crm-edit-model"
                          model={editModel}
                          variant={editVariant}
                          onChange={(m, v) => {
                            setEditModel(m);
                            setEditVariant(v);
                          }}
                          className="w-full h-10 rounded-md border border-input bg-secondary/50 px-3 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Source</Label>
                        <Select value={editSource || "keep"} onValueChange={(v) => setEditSource(v === "keep" ? "" : v)}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Source" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="keep">— Keep current —</SelectItem>
                            {editSource && !(PV_CRM_SOURCES as readonly string[]).includes(editSource) ? (
                              <SelectItem value={editSource}>{editSource}</SelectItem>
                            ) : null}
                            {PV_CRM_SOURCES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Buyer type</Label>
                        <Select value={editBuyerType || "none"} onValueChange={(v) => setEditBuyerType(v === "none" ? "" : v)}>
                          <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {buyerTypes.map((b) => (
                              <SelectItem key={b._id} value={b.label}>{b.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Changes sync to the customer profile and are recorded in the lead history.
                    </p>
                    <Button onClick={() => void handleDetailsSave()} disabled={saving} className="w-full">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
                      Save details
                    </Button>
                  </TabsContent>
                ) : null}

                {!detail.lead.convertedAt ? (
                  <TabsContent value="convert" className="mt-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Converting opportunity <span className="font-mono">{detail.lead.opportunityId || "—"}</span> creates/links a
                      customer record with a unique Customer ID for lifecycle tracking.
                    </p>
                    {canCreateVehicleOrder ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full"
                        disabled={saving}
                        onClick={() =>
                          void (async () => {
                            setSaving(true);
                            try {
                              const order = await createVehicleOrder({
                                leadId: detail.lead._id,
                                preferredModel: detail.lead.model || undefined,
                              });
                              toast.success(`Vehicle order ${order.orderNumber} ready`);
                              navigate("/admin/stock/orders");
                            } catch (e) {
                              toast.error(formatApiErrors(e));
                            } finally {
                              setSaving(false);
                            }
                          })()
                        }
                      >
                        Open vehicle order / Allocate stock
                      </Button>
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-xs">Sale stage</Label>
                      <Select value={convertStage} onValueChange={(v) => setConvertStage(v as "Booking" | "Delivered")}>
                        <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Booking">Booking</SelectItem>
                          <SelectItem value="Delivered">Delivered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={convertBuyerDiffers}
                        onChange={(e) => setConvertBuyerDiffers(e.target.checked)}
                        className="accent-primary"
                      />
                      Actual buyer differs from {detail.lead.name}
                    </label>
                    {convertBuyerDiffers ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Buyer name *</Label>
                          <Input value={convertBuyerName} onChange={(e) => setConvertBuyerName(e.target.value)} className="bg-secondary/50" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Buyer mobile *</Label>
                          <Input
                            value={convertBuyerMobile}
                            onChange={(e) => setConvertBuyerMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                            inputMode="numeric"
                            maxLength={10}
                            className="bg-secondary/50"
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Vehicle registration (optional)</Label>
                        <Input
                          value={convertRegistration}
                          onChange={(e) => setConvertRegistration(e.target.value.toUpperCase())}
                          className="bg-secondary/50 uppercase"
                          placeholder="e.g. BR01AB1234"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Remarks (optional)</Label>
                        <Input value={convertRemarks} onChange={(e) => setConvertRemarks(e.target.value)} className="bg-secondary/50" />
                      </div>
                    </div>
                    <Button onClick={() => void handleConvertToSale()} disabled={saving || !canUpdate} className="w-full">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trophy className="w-4 h-4 mr-2" />}
                      Convert to sale
                    </Button>
                  </TabsContent>
                ) : null}

                <TabsContent value="remarks" className="mt-4 space-y-3">
                  <Label className="text-xs">Remarks</Label>
                  <Textarea
                    value={remarksDraft}
                    onChange={(e) => setRemarksDraft(e.target.value)}
                    rows={5}
                    className="bg-secondary/50"
                    placeholder="Customer preferences, objections, next steps…"
                    readOnly={!canUpdate}
                  />
                  {canUpdate ? (
                    <Button onClick={() => void handleRemarksSave()} disabled={saving} variant="outline" className="w-full">
                      Save remarks
                    </Button>
                  ) : null}
                </TabsContent>

                <TabsContent value="followups" className="mt-4 space-y-4">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" /> Log follow-up
                    </p>
                    <Textarea
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      rows={3}
                      placeholder="What was discussed? Next action?"
                      className="bg-background/80"
                    />
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Schedule next call (optional)</Label>
                        <Input
                          type="datetime-local"
                          value={followUpScheduled}
                          onChange={(e) => setFollowUpScheduled(e.target.value)}
                          className="bg-background/80"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Outcome (optional)</Label>
                        <Input
                          value={followUpOutcome}
                          onChange={(e) => setFollowUpOutcome(e.target.value)}
                          placeholder="e.g. Will visit showroom"
                          className="bg-background/80"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Next action</Label>
                        <Input
                          value={followUpNextAction}
                          onChange={(e) => setFollowUpNextAction(e.target.value)}
                          placeholder="e.g. Call evening"
                          className="bg-background/80"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Interest</Label>
                        <Select value={followUpInterest || "none"} onValueChange={(v) => setFollowUpInterest(v === "none" ? "" : v)}>
                          <SelectTrigger className="bg-background/80"><SelectValue placeholder="HOT / WARM / COLD" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            <SelectItem value="HOT">HOT</SelectItem>
                            <SelectItem value="WARM">WARM</SelectItem>
                            <SelectItem value="COLD">COLD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={followUpCompleted}
                        onChange={(e) => setFollowUpCompleted(e.target.checked)}
                        className="rounded border-border"
                      />
                      Mark as completed (call already done)
                    </label>
                    <Button onClick={() => void handleAddFollowUp()} disabled={saving || !canUpdate} size="sm" className="w-full">
                      Add follow-up
                    </Button>
                  </div>

                  <LeadFollowUpTimeline
                    followUps={detailFollowUps}
                    canUpdate={canUpdate}
                    saving={saving}
                    completingId={completingId}
                    onStartComplete={(id) => {
                      setCompletingId(id);
                      setCompleteOutcome("");
                      setCompleteRemarks("");
                      setCompleteNextAction("");
                      setCompleteNextAt("");
                      setCompleteInterest("");
                    }}
                    completeForm={
                      <div className="mt-2 rounded-md border border-border/60 p-2 space-y-2 bg-background">
                        <Input
                          value={completeOutcome}
                          onChange={(e) => setCompleteOutcome(e.target.value)}
                          placeholder="Outcome (required)"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={completeRemarks}
                          onChange={(e) => setCompleteRemarks(e.target.value)}
                          placeholder="Remarks (required)"
                          className="h-8 text-xs"
                        />
                        <Input
                          value={completeNextAction}
                          onChange={(e) => setCompleteNextAction(e.target.value)}
                          placeholder="Next action"
                          className="h-8 text-xs"
                        />
                        <Input
                          type="datetime-local"
                          value={completeNextAt}
                          onChange={(e) => setCompleteNextAt(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Select value={completeInterest || "none"} onValueChange={(v) => setCompleteInterest(v === "none" ? "" : v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Interest" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            <SelectItem value="HOT">HOT</SelectItem>
                            <SelectItem value="WARM">WARM</SelectItem>
                            <SelectItem value="COLD">COLD</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-7 text-[10px] w-full" disabled={saving} onClick={() => completingId && void handleCompleteFollowUp(completingId)}>
                          Save & complete
                        </Button>
                      </div>
                    }
                  />
                </TabsContent>

                <TabsContent value="history" className="mt-4 space-y-2 max-h-72 overflow-y-auto">
                  {detailHistory.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No stage changes recorded yet.</p>
                  ) : (
                    detailHistory.map((h) => (
                      <div key={h._id} className="flex gap-3 text-xs border-l-2 border-primary/30 pl-3 py-1">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">
                            {h.fromStage ? `${normalizeCrmStage(h.fromStage)} → ` : ""}
                            {normalizeCrmStage(h.toStage)}
                          </p>
                          {h.reason ? <p className="text-muted-foreground mt-0.5">{h.reason}</p> : null}
                          <p className="text-muted-foreground mt-0.5">
                            {h.changedBy?.name ?? "System"} · {formatDateTime(h.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {(detail.siblingLeads?.length ?? 0) > 0 ? (
                  <TabsContent value="related" className="mt-4 space-y-2 max-h-72 overflow-y-auto">
                    {detail.siblingLeads?.map((s) => (
                      <div key={`${s.leadId}-${s.opportunityId}`} className="rounded-lg border border-border/50 p-3 text-xs">
                        <p className="font-mono">{s.leadId} · {s.opportunityId}</p>
                        <p>{s.model} · {s.source} · {normalizeCrmStage(s.status)}</p>
                      </div>
                    ))}
                  </TabsContent>
                ) : null}
              </Tabs>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <CustomerHistoryDialog
        open={showCustomerHistory}
        onOpenChange={setShowCustomerHistory}
        history={customerHistory}
      />

      <Dialog open={showOppReport} onOpenChange={setShowOppReport}>
        <DialogContent className="bg-card border-border max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" /> Opportunity ID health
            </DialogTitle>
          </DialogHeader>
          {oppLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : oppReport ? (
            <div className="space-y-4 text-sm">
              {oppReport.healthy && oppReport.multiOpportunityCustomers.length === 0 ? (
                <p className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> No duplicate or missing opportunity IDs found.
                </p>
              ) : null}
              {oppReport.leadsMissingOpportunityId > 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {oppReport.leadsMissingOpportunityId} lead(s) have no Opportunity ID yet — IDs are assigned automatically the next time those leads are opened.
                </p>
              ) : null}
              {oppReport.duplicateOpportunityIds.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">
                    Duplicated opportunity IDs ({oppReport.duplicateOpportunityIds.length})
                  </p>
                  <div className="space-y-1.5">
                    {oppReport.duplicateOpportunityIds.map((d) => (
                      <p key={d.opportunityId} className="text-xs rounded border border-destructive/30 bg-destructive/10 px-2 py-1.5">
                        <span className="font-mono">{d.opportunityId}</span> used by {d.count} leads
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
              {oppReport.multiOpportunityCustomers.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Customers with multiple open opportunities on the same model ({oppReport.multiOpportunityCustomers.length})
                  </p>
                  <div className="space-y-1.5">
                    {oppReport.multiOpportunityCustomers.map((c) => (
                      <div key={`${c.mobile}-${c.model}`} className="text-xs rounded border border-border/50 bg-secondary/20 px-2 py-1.5">
                        <p className="font-medium text-foreground">{c.name || "Customer"} · {c.mobile} · {c.model}</p>
                        <p className="text-muted-foreground">
                          {c.opportunities.map((o) => `${o.opportunityId || o.leadId || "—"} (${o.status || "—"})`).join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <BookTestDriveDialog
        open={showBookTestDrive}
        onOpenChange={setShowBookTestDrive}
        customer={
          detail?.lead
            ? {
                leadId: detail.lead._id,
                name: detail.lead.name,
                mobile: detail.lead.mobile,
                email: detail.lead.email,
                city: detail.lead.city,
                model: parseStoredModelLine(detail.lead.model ?? "").model,
              }
            : null
        }
        onBooked={() => {
          if (selected) void refreshDetail(selected._id);
        }}
      />

      {showAddLead ? (
        <AddPvLeadDialog
          open={showAddLead}
          onOpenChange={setShowAddLead}
          isExecutive={isExecutive}
          canAssignToExecutive={canAssignLeads}
          executives={staffUsers}
          onCreated={() => void loadLeads()}
        />
      ) : null}

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete selected leads?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You are about to permanently delete{" "}
              <strong className="text-foreground">{selectedIds.size}</strong> junk lead(s).
              This also removes all follow-up history and stage history for those leads.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="destructive"
                className="flex-1"
                disabled={saving || selectedIds.size === 0}
                onClick={() => void handleBulkDeleteLeads()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Delete forever
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setBulkDeleteOpen(false)}>
                Keep
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modelMapOpen}
        onOpenChange={(o) => {
          if (!o) closeModelMap();
        }}
      >
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Map ambiguous models
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              These rows use &quot;Both&quot; or multi-model values (slash/comma). Choose a single model
              for each, then import. Valid rows import together in the same pass.
              {importSummary?.dryRun ? (
                <>
                  {" "}
                  Preview of the other rows:{" "}
                  <strong className="text-foreground">{importSummary.created}</strong> will create,{" "}
                  <strong className="text-foreground">{importSummary.updated}</strong> will update
                  existing leads (same mobile + model).
                </>
              ) : null}
            </p>
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {modelMapRows.map((row) => (
                <div
                  key={String(row.row)}
                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 space-y-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      Row {row.row}
                      {row.name ? ` · ${row.name}` : ""}
                      {row.mobile ? (
                        <span className="ml-1 font-mono text-xs text-muted-foreground">{row.mobile}</span>
                      ) : null}
                    </p>
                    <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                      {row.modelRaw || row.model || "Both"}
                    </Badge>
                  </div>
                  <Select
                    value={modelCorrections[String(row.row)] || "VF 7"}
                    onValueChange={(v) =>
                      setModelCorrections((prev) => ({ ...prev, [String(row.row)]: v }))
                    }
                  >
                    <SelectTrigger className="bg-secondary/50">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRM_IMPORT_MODEL_OPTIONS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={closeModelMap} disabled={committingImport}>
                Cancel
              </Button>
              <Button
                disabled={committingImport || importing}
                onClick={() => void commitImportWithCorrections()}
              >
                {committingImport ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Import with mapped models
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importResultOpen}
        onOpenChange={(o) => {
          if (!o) closeImportResult();
        }}
      >
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {(importSummary?.failed ?? 0) > 0 ? (
                <ShieldAlert className="w-5 h-5 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
              Bulk upload results
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  {
                    key: "all" as const,
                    label: "Uploaded",
                    value: importSummary?.total ?? 0,
                    active: "border-foreground/40 bg-muted/40 ring-1 ring-foreground/10",
                    idle: "border-border/60 bg-muted/20",
                    valueClass: "text-foreground",
                  },
                  {
                    key: "created" as const,
                    label: importSummary?.dryRun ? "Will create" : "Created",
                    value: importSummary?.created ?? 0,
                    active: "border-emerald-500/50 bg-emerald-500/15 ring-1 ring-emerald-500/30",
                    idle: "border-border/60 bg-emerald-500/10",
                    valueClass: "text-emerald-700 dark:text-emerald-400",
                  },
                  {
                    key: "updated" as const,
                    label: importSummary?.dryRun ? "Will update" : "Updated",
                    value: importSummary?.updated ?? 0,
                    active: "border-sky-500/50 bg-sky-500/15 ring-1 ring-sky-500/30",
                    idle: "border-border/60 bg-sky-500/10",
                    valueClass: "text-sky-700 dark:text-sky-400",
                  },
                  {
                    key: "failed" as const,
                    label: "Failed",
                    value: importSummary?.failed ?? 0,
                    active: "border-destructive/50 bg-destructive/15 ring-1 ring-destructive/30",
                    idle: "border-border/60 bg-destructive/10",
                    valueClass: "text-destructive",
                  },
                ] as const
              ).map((card) => {
                const selected = importListFilter === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setImportListFilter(card.key)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-center transition-colors",
                      selected ? card.active : card.idle,
                    )}
                  >
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className={cn("text-lg font-semibold tabular-nums", card.valueClass)}>
                      {card.value}
                    </p>
                  </button>
                );
              })}
            </div>

            {(importSummary?.followUps ?? 0) > 0 ? (
              <p className="text-sm text-muted-foreground">
                Also created <strong className="text-foreground">{importSummary?.followUps}</strong> follow-up
                record(s).
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <strong className="text-foreground">{filteredImportRows.length}</strong>{" "}
                {importListFilter === "all"
                  ? "row(s)"
                  : `${importListFilter} row(s)`}
                . Click a summary card to filter.
              </p>
              {(importSummary?.failed ?? 0) > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadCrmImportErrors(importFailures, "xlsx")}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Errors Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadCrmImportErrors(importFailures, "csv")}
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Errors CSV
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="max-h-[22rem] overflow-y-auto rounded-md border border-border/50 text-xs">
              <table className="w-full">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Row</th>
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Name</th>
                    <th className="p-2 font-medium">Mobile</th>
                    <th className="p-2 font-medium">Model</th>
                    <th className="p-2 font-medium">Lead ID</th>
                    <th className="p-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredImportRows.length ? (
                    filteredImportRows.map((r, i) => (
                      <tr key={`${r.status}-${r.row}-${i}`} className="border-t border-border/40">
                        <td className="p-2 align-top whitespace-nowrap">{r.row}</td>
                        <td className="p-2 align-top">
                          <Badge
                            variant="outline"
                            className={cn(
                              "capitalize",
                              (r.status === "created" || r.status === "would_create") &&
                                "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
                              (r.status === "updated" || r.status === "would_update") &&
                                "border-sky-500/40 text-sky-700 dark:text-sky-400",
                              r.status === "failed" && "border-destructive/40 text-destructive",
                            )}
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="p-2 align-top">{r.name || "—"}</td>
                        <td className="p-2 align-top font-mono">{r.mobile || "—"}</td>
                        <td className="p-2 align-top">{r.model || "—"}</td>
                        <td className="p-2 align-top font-mono">{r.leadId || "—"}</td>
                        <td
                          className={cn(
                            "p-2 align-top",
                            r.status === "failed" ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {r.message || "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-muted-foreground">
                        No rows in this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {(importSummary?.failed ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                All rows in the file were processed successfully.
              </p>
            ) : null}

            <Button variant="outline" className="w-full" onClick={closeImportResult}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
