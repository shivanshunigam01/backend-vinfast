import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import PipelineDeleteButton from "@/components/admin/PipelineDeleteButton";
import StockPrintButton from "@/components/admin/StockPrintButton";
import { deleteRectification, fetchRectifications, updateRectification } from "@/lib/stockPipelineApi";

type RectRow = {
  _id: string;
  rectificationNo?: string;
  vin?: string;
  issueDescription?: string;
  status?: string;
  actionTaken?: string;
  severity?: string;
};

export default function AdminRectifications() {
  const admin = getAdminUser();
  const canUpdate =
    canPerformAction(admin, "stock_rectification", "update") ||
    canPerformAction(admin, "stock_delivery", "update");
  const canDelete =
    canPerformAction(admin, "stock_rectification", "delete") ||
    canPerformAction(admin, "stock_delivery", "delete");

  const [rows, setRows] = useState<RectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<RectRow | null>(null);
  const [form, setForm] = useState({ issueDescription: "", actionTaken: "", severity: "MAJOR" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await fetchRectifications()) as RectRow[]);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const complete = async (id: string) => {
    try {
      await updateRectification(id, { status: "COMPLETED", actionTaken: "Rectification completed" });
      toast.success("Marked complete — re-PDI queued if required");
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  const openEdit = (row: RectRow) => {
    setEditing(row);
    setForm({
      issueDescription: row.issueDescription ?? "",
      actionTaken: row.actionTaken ?? "",
      severity: row.severity ?? "MAJOR",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await updateRectification(editing._id, form);
      toast.success("Rectification updated");
      setEditOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrors(e));
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6" /> Rectifications</h1>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading ? <Loader2 className="animate-spin mx-auto" /> : rows.map((r) => (
        <Card key={r._id} className="p-4 flex justify-between items-start gap-4">
          <div>
            <p className="font-medium">{r.rectificationNo} — {r.vin}</p>
            <p className="text-sm text-muted-foreground">{r.issueDescription}</p>
            <Badge className="mt-2">{r.status}</Badge>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <StockPrintButton
              getPrintOptions={() => ({
                title: "Rectification",
                documentNo: r.rectificationNo || r._id,
                vendor: { name: "VinFast" },
                meta: [
                  { label: "VIN", value: r.vin || "—" },
                  { label: "Status", value: r.status || "—" },
                  { label: "Severity", value: r.severity || "—" },
                ],
                bodyHtml: `<p>${r.issueDescription || "Rectification issue"}</p>`,
              })}
            />
            {canUpdate && r.status !== "CLOSED" && r.status !== "RE_PDI_PENDING" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button size="sm" onClick={() => complete(r._id)}>Complete</Button>
              </>
            ) : null}
            {canDelete && (r.status === "OPEN" || r.status === "IN_PROGRESS") ? (
              <PipelineDeleteButton
                label="Delete"
                title={`Delete ${r.rectificationNo}?`}
                description="Only open rectifications can be removed."
                onConfirm={async () => {
                  try {
                    await deleteRectification(r._id);
                    toast.success("Rectification deleted");
                    void load();
                  } catch (e) {
                    toast.error(formatApiErrors(e));
                    throw e;
                  }
                }}
              />
            ) : null}
          </div>
        </Card>
      ))}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit rectification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Severity</Label>
              <Input value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} />
            </div>
            <div>
              <Label>Issue description</Label>
              <Textarea value={form.issueDescription} onChange={(e) => setForm({ ...form, issueDescription: e.target.value })} />
            </div>
            <div>
              <Label>Action taken</Label>
              <Textarea value={form.actionTaken} onChange={(e) => setForm({ ...form, actionTaken: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveEdit()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
