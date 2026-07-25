import { useCallback, useEffect, useState } from "react";
import { adminDeleteJson, adminGet, formatApiErrors } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MessageSquareHeart, Search, RefreshCw, Loader2, Star, Eye, Trash2,
  ChevronLeft, ChevronRight, CarFront, PackageCheck, Inbox
} from "lucide-react";
import { toast } from "sonner";

type FeedbackRow = {
  _id: string;
  name: string;
  mobile: string;
  model?: string;
  colour?: string;
  city?: string;
  deliveryDate?: string;
  testDriveDate?: string;
  salesConsultant?: string;
  leadSource?: string;
  purchaseIntent?: string;
  mainConcern?: string;
  likedFeatures?: string[];
  dislikedAboutProduct?: string;
  dealerSuggestions?: string;
  comment?: string;
  reference?: string;
  ratings?: Record<string, number>;
  createdAt?: string;
};

type FeedbackMeta = {
  page: number;
  limit: number;
  total: number;
  summary?: { total: number; avgOverall: number | null; avgRecommend: number | null };
};

type DetailField = { key: keyof FeedbackRow; label: string; date?: boolean };

type FeedbackConfig = {
  title: string;
  description: string;
  endpoint: string;
  formPath: string;
  icon: React.ElementType;
  overallKey: string;
  /** Rating keys in form order with the question text shown to the customer. */
  ratingLabels: [string, string][];
  detailFields: DetailField[];
};

const CONFIGS: Record<"testDrive" | "postDelivery", FeedbackConfig> = {
  testDrive: {
    title: "Test Drive Feedback",
    description: "Customer submissions from the QR test-drive feedback form",
    endpoint: "/admin/feedback/test-drive",
    formPath: "/test-drive-feedback",
    icon: CarFront,
    overallKey: "overallTestDrive",
    ratingLabels: [
      ["designComfort", "Design and cabin comfort"],
      ["rideQuietness", "Ride quality and cabin quietness"],
      ["performanceHandling", "Performance, steering and braking"],
      ["featuresTechnology", "Features and technology"],
      ["productGuidance", "Product and EV guidance"],
      ["consultantExperience", "Consultant professionalism and hospitality"],
      ["overallTestDrive", "Overall test-drive experience"],
      ["recommend", "Likelihood to recommend Patliputra VinFast"],
    ],
    detailFields: [
      { key: "city", label: "City" },
      { key: "model", label: "Model" },
      { key: "testDriveDate", label: "Test drive date", date: true },
      { key: "salesConsultant", label: "Sales consultant" },
      { key: "leadSource", label: "Lead source" },
      { key: "purchaseIntent", label: "Purchase intent" },
      { key: "mainConcern", label: "Main concern" },
    ],
  },
  postDelivery: {
    title: "Post Delivery Feedback",
    description: "Customer submissions from the QR post-delivery experience form",
    endpoint: "/admin/feedback/post-delivery",
    formPath: "/post-delivery-feedback",
    icon: PackageCheck,
    overallKey: "overallJourney",
    ratingLabels: [
      ["firstResponse", "Speed and quality of our first response"],
      ["consultation", "Understanding your needs and explaining the vehicle"],
      ["testDrive", "Test-drive and EV guidance"],
      ["booking", "Price clarity, booking and status updates"],
      ["deliveryReadiness", "Vehicle condition and on-time delivery"],
      ["handover", "Features, documents, charging and app explanation"],
      ["overallJourney", "End-to-end buying experience"],
      ["recommend", "Likelihood to recommend us"],
    ],
    detailFields: [
      { key: "model", label: "Model" },
      { key: "colour", label: "Colour" },
      { key: "deliveryDate", label: "Delivery date", date: true },
      { key: "leadSource", label: "Lead source" },
    ],
  },
};

const PAGE_SIZE = 20;

function formatDate(value?: string, withTime = false) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function Stars({ value, size = "h-3.5 w-3.5" }: { value?: number; size?: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${size} ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

export default function AdminFeedbackSubmissions({ kind }: { kind: "testDrive" | "postDelivery" }) {
  const config = CONFIGS[kind];

  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [meta, setMeta] = useState<FeedbackMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [viewRow, setViewRow] = useState<FeedbackRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<FeedbackRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set("search", search.trim());
      const res = await adminGet<FeedbackRow[]>(`${config.endpoint}?${params}`);
      setRows(res.data ?? []);
      setMeta((res.meta as FeedbackMeta) ?? null);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, page, search]);

  useEffect(() => {
    const t = window.setTimeout(() => void fetchRows(), search ? 350 : 0);
    return () => window.clearTimeout(t);
  }, [fetchRows, search]);

  // Reset to first page when the search text or module changes.
  useEffect(() => {
    setPage(1);
  }, [search, kind]);

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await adminDeleteJson(`${config.endpoint}/${deleteRow._id}`);
      toast.success(`Feedback from ${deleteRow.name} deleted`);
      setDeleteRow(null);
      void fetchRows();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setDeleting(false);
    }
  };

  const total = meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = meta?.summary;
  const HeaderIcon = config.icon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <HeaderIcon className="w-6 h-6 text-primary" /> {config.title}
          </h1>
          <p className="text-muted-foreground text-sm">
            {config.description} (<span className="font-mono">{config.formPath}</span>)
          </p>
        </div>
        <Button onClick={() => void fetchRows()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 border-border/50 bg-card/50">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <MessageSquareHeart className="w-3.5 h-3.5" /> Total submissions
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">{summary?.total ?? total}</p>
        </Card>
        <Card className="p-4 border-border/50 bg-card/50">
          <p className="text-xs text-muted-foreground">Average overall rating</p>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-2xl font-bold text-foreground">{summary?.avgOverall ?? "—"}</p>
            <Stars value={summary?.avgOverall ? Math.round(summary.avgOverall) : undefined} size="h-4 w-4" />
          </div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/50">
          <p className="text-xs text-muted-foreground">Average recommendation</p>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-2xl font-bold text-foreground">{summary?.avgRecommend ?? "—"}</p>
            <Stars value={summary?.avgRecommend ? Math.round(summary.avgRecommend) : undefined} size="h-4 w-4" />
          </div>
        </Card>
      </div>

      <Card className="p-4 border-border/50 bg-card/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, mobile, reference or model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary/30"
          />
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>No feedback submissions yet.</p>
          <p className="text-xs mt-1">
            Customers submit via the QR form at <span className="font-mono">{config.formPath}</span>.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <Card key={row._id} className="p-4 border-border/50 bg-card/50">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {(row.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{row.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {row.mobile}
                      {row.reference ? <span className="ml-2 font-mono text-xs">{row.reference}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(row.createdAt, true)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {row.model && (
                    <Badge variant="outline" className="border-blue-400/30 text-blue-400">{row.model}</Badge>
                  )}
                  {kind === "testDrive" && row.purchaseIntent && (
                    <Badge variant="outline" className="border-green-400/30 text-green-400">{row.purchaseIntent}</Badge>
                  )}
                  <Stars value={row.ratings?.[config.overallKey]} />
                  <Button variant="outline" size="sm" onClick={() => setViewRow(row)}>
                    <Eye className="w-4 h-4 mr-1" /> View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteRow(row)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="w-4 h-4" /> Prev
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <Dialog open={Boolean(viewRow)} onOpenChange={(open) => { if (!open) setViewRow(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeaderIcon className="w-5 h-5 text-primary" /> {viewRow?.name}
            </DialogTitle>
          </DialogHeader>
          {viewRow && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Mobile</p>
                  <p className="text-foreground">{viewRow.mobile || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reference</p>
                  <p className="font-mono text-foreground">{viewRow.reference || "—"}</p>
                </div>
                {config.detailFields.map((f) => (
                  <div key={String(f.key)}>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="text-foreground">
                      {f.date ? formatDate(viewRow[f.key] as string | undefined) : ((viewRow[f.key] as string) || "—")}
                    </p>
                  </div>
                ))}
                <div>
                  <p className="text-xs text-muted-foreground">Submitted</p>
                  <p className="text-foreground">{formatDate(viewRow.createdAt, true)}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border/50 p-3 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ratings</p>
                {config.ratingLabels.map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <p className="text-sm text-foreground min-w-0 flex-1">{label}</p>
                    <Stars value={viewRow.ratings?.[key]} />
                  </div>
                ))}
              </div>

              {Boolean(viewRow.likedFeatures?.length) && (
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Liked about the product
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewRow.likedFeatures!.map((item) => (
                      <Badge key={item} variant="outline" className="border-primary/30 text-primary">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {viewRow.dislikedAboutProduct && (
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Did not like about the product
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewRow.dislikedAboutProduct}</p>
                </div>
              )}

              {viewRow.dealerSuggestions && (
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Suggestions for Patliputra VinFast
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewRow.dealerSuggestions}</p>
                </div>
              )}

              {viewRow.comment && (
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Comment</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{viewRow.comment}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteRow)} onOpenChange={(open) => { if (!open) setDeleteRow(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this feedback?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the submission from{" "}
              <span className="font-medium text-foreground">{deleteRow?.name}</span>
              {deleteRow?.reference ? <> (ref <span className="font-mono">{deleteRow.reference}</span>)</> : null}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
