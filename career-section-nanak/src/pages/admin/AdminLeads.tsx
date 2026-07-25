import { useCallback, useEffect, useState } from "react";
import { mockLeads, LEAD_STATUSES, type Lead, type LeadStatus } from "@/data/mockData";
import {
  getLeads,
  setLeads as setLeadsToStorage,
  getLeadsAdminInitial,
  subscribeVfStorage,
  VF_STORAGE_KEYS,
} from "@/lib/vfLocalStorage";
import { hasApi } from "@/lib/apiConfig";
import { adminDeleteJson, adminPostJson, adminPutJson, formatApiErrors } from "@/lib/api";
import { formatLeadSubmittedAt, leadFromApi, leadToApiPayload } from "@/lib/apiMappers";
import { ADMIN_LEADS_PATH, fetchAllAdminRows, fetchLeadsPage } from "@/lib/adminFetchAll";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { leadModelLabel, parseStoredModelLine } from "@/data/vinfastModels";
import { ModelTrimSelect } from "@/components/ModelTrimSelect";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Edit2, Trash2, Phone, Mail, Download, FileText, MessageCircle } from "lucide-react";

const CRM_LEAD_SOURCES = ["Website", "Google Ads", "Meta Ads", "WhatsApp", "Walk-in", "Referral"] as const;

const AdminLeads = () => {
  const useRemote = hasApi();
  const [hydrated, setHydrated] = useState(false);
  const [leads, setLeads] = useState<Lead[]>(() => (hasApi() ? [] : mockLeads));
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [showForm, setShowForm] = useState(false);

  const emptyLead: Lead = {
    id: "",
    name: "",
    mobile: "",
    email: "",
    city: "",
    otherCity: "",
    model: "VF 7",
    source: "Website",
    status: "New Lead",
    assignedTo: "",
    createdAt: new Date().toISOString().split("T")[0],
    nextFollowUp: "",
    remarks: "",
    financeNeeded: false,
    exchangeNeeded: false,
  };

  const refreshFromApi = useCallback(async () => {
    const { rows, meta } = await fetchLeadsPage((d) => leadFromApi(d), { page: 1, limit: 20 });
    setLeads(rows);
    setLeadsTotal(meta?.total ?? rows.length);
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
    const { seedMock, leads: initial } = getLeadsAdminInitial();
    setLeads(seedMock ? mockLeads : initial);
    setHydrated(true);
    return subscribeVfStorage(VF_STORAGE_KEYS.leads, () => setLeads(getLeads()));
  }, [useRemote, refreshFromApi]);

  useEffect(() => {
    if (!hydrated || useRemote) return;
    setLeadsToStorage(leads);
  }, [leads, hydrated, useRemote]);

  const filtered = leads.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.mobile.includes(search) || l.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const escapeCsv = (value: unknown) => {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const loadAllLeadsForExport = async (): Promise<Lead[]> => {
    if (useRemote) {
      return fetchAllAdminRows(ADMIN_LEADS_PATH, (d) => leadFromApi(d));
    }
    return leads;
  };

  const exportCsv = async () => {
    const t = toast.loading("Preparing CSV…");
    try {
      const rowsToExport = await loadAllLeadsForExport();
      toast.dismiss(t);
      if (rowsToExport.length === 0) {
        toast.message("No leads to export.");
        return;
      }
      const headers: (keyof Lead)[] = ["id", "name", "mobile", "email", "city", "model", "source", "status", "createdAt", "nextFollowUp", "remarks", "financeNeeded", "exchangeNeeded"];
      const rows = rowsToExport.map((l) => headers.map((h) => escapeCsv(l[h])).join(","));
      const csv = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patliputra-group-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rowsToExport.length} lead(s).`);
    } catch (e) {
      toast.dismiss(t);
      toast.error(formatApiErrors(e));
    }
  };

  const exportPdf = async () => {
    const t = toast.loading("Preparing PDF…");
    try {
      const rowsToExport = await loadAllLeadsForExport();
      toast.dismiss(t);
      if (rowsToExport.length === 0) {
        toast.message("No leads to export.");
        return;
      }
      const htmlRows = rowsToExport
        .map(
          (l) => `<tr>
          <td>${l.name}</td>
          <td>${l.mobile}</td>
          <td>${l.email}</td>
          <td>${l.model}</td>
          <td>${l.city}</td>
          <td>${l.source}</td>
          <td>${l.status}</td>
          <td>${formatLeadSubmittedAt(l.createdAt)}</td>
          <td>${l.nextFollowUp || "-"}</td>
        </tr>`,
        )
        .join("");

      const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Leads Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h2>Patliputra Group Leads Export (${rowsToExport.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Mobile</th><th>Email</th><th>Model</th><th>City</th><th>Source</th><th>Status</th><th>Submitted</th><th>Next Follow-up</th>
              </tr>
            </thead>
            <tbody>${htmlRows}</tbody>
          </table>
          <p style="margin-top:12px;color:#666;">Tip: Use your browser's print dialog to save as PDF.</p>
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
      toast.success(`Opened print view (${rowsToExport.length} lead(s)).`);
    } catch (e) {
      toast.dismiss(t);
      toast.error(formatApiErrors(e));
    }
  };

  const shareWhatsApp = async () => {
    const t = toast.loading("Loading leads…");
    try {
      const rowsToExport = await loadAllLeadsForExport();
      toast.dismiss(t);
      const preview = rowsToExport.slice(0, 10).map((l) => `• ${l.name} (${l.mobile}) - ${l.model} - ${l.status}`).join("\n");
      const suffix = rowsToExport.length > 10 ? `\n...and ${rowsToExport.length - 10} more` : "";
      const msg = `Patliputra Group Leads (${rowsToExport.length})\n${preview}${suffix}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    } catch (e) {
      toast.dismiss(t);
      toast.error(formatApiErrors(e));
    }
  };

  const handleSave = async (lead: Lead) => {
    if (useRemote) {
      try {
        const payload = leadToApiPayload(lead);
        if (lead.id) {
          await adminPutJson<Record<string, unknown>>(`/admin/leads/${lead.id}`, payload);
        } else {
          await adminPostJson<Record<string, unknown>>("/admin/leads", payload);
        }
        await refreshFromApi();
        toast.success("Lead saved");
        setShowForm(false);
        setEditLead(null);
      } catch (e) {
        toast.error(formatApiErrors(e));
      }
      return;
    }
    if (lead.id) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? lead : l)));
    } else {
      setLeads((prev) => [...prev, { ...lead, id: `L${String(prev.length + 1).padStart(3, "0")}` }]);
    }
    setShowForm(false);
    setEditLead(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete lead "${name || id}"? This cannot be undone.`)) return;

    if (useRemote) {
      try {
        await adminDeleteJson(`/admin/leads/${id}`);
        await refreshFromApi();
        toast.success("Lead deleted");
      } catch (e) {
        toast.error(formatApiErrors(e));
      }
      return;
    }
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground text-sm">
            {useRemote
              ? `Showing ${leads.length} of ${leadsTotal} leads`
              : `${leads.length} total leads`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => { setEditLead(emptyLead); setShowForm(true); }} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Add Lead
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, mobile, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-secondary/50" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-48 bg-secondary/50"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-card border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Name</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium hidden sm:table-cell">Contact</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Model</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Source</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium hidden md:table-cell whitespace-nowrap">Submitted</th>
                <th className="text-left p-3 text-xs text-muted-foreground font-medium hidden lg:table-cell">Follow-up</th>
                <th className="text-right p-3 text-xs text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="p-3">
                    <p className="font-medium text-foreground">{lead.name}</p>
                    <p className="text-xs text-muted-foreground sm:hidden">{lead.mobile}</p>
                    <p className="text-[10px] text-muted-foreground md:hidden mt-0.5 whitespace-nowrap">{formatLeadSubmittedAt(lead.createdAt)}</p>
                  </td>
                  <td className="p-3 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <a href={`tel:${lead.mobile}`} className="text-muted-foreground hover:text-foreground"><Phone className="w-3.5 h-3.5" /></a>
                      <a href={`mailto:${lead.email}`} className="text-muted-foreground hover:text-foreground"><Mail className="w-3.5 h-3.5" /></a>
                      <span className="text-xs text-muted-foreground">{lead.mobile}</span>
                    </div>
                  </td>
                  <td className="p-3 text-foreground">{lead.model}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{lead.source}</td>
                  <td className="p-3">
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                      lead.status === "New Lead" ? "bg-blue-400/10 text-blue-400" :
                      lead.status === "Interested" ? "bg-green-400/10 text-green-400" :
                      lead.status === "Booked" ? "bg-primary/10 text-primary" :
                      lead.status === "Lost" ? "bg-destructive/10 text-destructive" :
                      lead.status === "Negotiation" ? "bg-amber-400/10 text-amber-400" :
                      "bg-secondary text-muted-foreground"
                    }`}>{lead.status}</span>
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground text-xs whitespace-nowrap">{formatLeadSubmittedAt(lead.createdAt)}</td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">{lead.nextFollowUp || "—"}</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditLead(lead); setShowForm(true); }} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(lead.id, lead.name)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No leads found</p>}
        </div>
      </Card>

      {/* Lead Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditLead(null); }}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editLead?.id ? "Edit Lead" : "Add Lead"}</DialogTitle>
          </DialogHeader>
          {editLead && <LeadForm lead={editLead} onSave={(l) => void handleSave(l)} onCancel={() => { setShowForm(false); setEditLead(null); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LeadForm = ({ lead, onSave, onCancel }: { lead: Lead; onSave: (l: Lead) => void | Promise<void>; onCancel: () => void }) => {
  const [form, setForm] = useState(lead);
  const update = (key: keyof Lead, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));

  const sourceChoices: string[] = [...CRM_LEAD_SOURCES];
  if (form.source && !sourceChoices.includes(form.source)) {
    sourceChoices.push(form.source);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => update("name", e.target.value)} className="bg-secondary/50" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Mobile</Label><Input value={form.mobile} onChange={e => update("mobile", e.target.value)} className="bg-secondary/50" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => update("email", e.target.value)} className="bg-secondary/50" /></div>
        <div className="space-y-1.5"><Label className="text-xs">City</Label><Input value={form.city} onChange={e => update("city", e.target.value)} className="bg-secondary/50" /></div>
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
          <Label className="text-xs">Source</Label>
          <Select value={form.source || "Website"} onValueChange={v => update("source", v)}>
            <SelectTrigger className="bg-secondary/50">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              {sourceChoices.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={v => update("status", v as LeadStatus)}><SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger><SelectContent>{LEAD_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="space-y-1.5 col-span-2"><Label className="text-xs">Next Follow-up</Label><Input type="date" value={form.nextFollowUp} onChange={e => update("nextFollowUp", e.target.value)} className="bg-secondary/50" /></div>
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Remarks</Label><Textarea value={form.remarks} onChange={e => update("remarks", e.target.value)} className="bg-secondary/50" rows={2} /></div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.financeNeeded} onChange={e => update("financeNeeded", e.target.checked)} className="rounded" /> Finance Needed</label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.exchangeNeeded} onChange={e => update("exchangeNeeded", e.target.checked)} className="rounded" /> Exchange Needed</label>
      </div>
      <div className="flex gap-3 pt-2">
        <Button onClick={() => onSave(form)} className="bg-primary text-primary-foreground flex-1">Save</Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
      </div>
    </div>
  );
};

export default AdminLeads;
