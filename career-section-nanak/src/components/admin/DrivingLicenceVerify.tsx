import { useId, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, CheckCircle2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { verifyTdBookingDrivingLicence } from "@/lib/tdBookingApi";

type DrivingLicenceVerifyProps = {
  bookingId: string;
  dlVerified: boolean;
  dlImageUrl?: string | null;
  dlNumber?: string | null;
  dlValidUntil?: string | null;
  disabled?: boolean;
  onVerified: () => void | Promise<void>;
};

function formatValidUntil(iso?: string | null) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy");
  } catch {
    return "—";
  }
}

function toDateInputValue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DrivingLicenceVerify({
  bookingId,
  dlVerified,
  dlImageUrl,
  dlNumber,
  dlValidUntil,
  disabled,
  onVerified,
}: DrivingLicenceVerifyProps) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [numberDraft, setNumberDraft] = useState("");
  const [validUntilDraft, setValidUntilDraft] = useState("");

  const showForm = !dlVerified || editing;

  const startEditing = () => {
    setNumberDraft(dlNumber ?? "");
    setValidUntilDraft(toDateInputValue(dlValidUntil));
    setFile(null);
    setPreview(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setFile(null);
    setPreview(null);
    setNumberDraft("");
    setValidUntilDraft("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const handleVerify = async () => {
    const dlNum = numberDraft.trim();
    if (!dlNum) {
      toast.error("Enter the driving licence number.");
      return;
    }
    if (!validUntilDraft) {
      toast.error("Enter the licence validity date.");
      return;
    }
    // On first verification a photo is mandatory; when editing, keeping the existing one is fine.
    if (!file && !dlVerified) {
      toast.error("Upload a driving licence photo first.");
      return;
    }
    setUploading(true);
    try {
      await verifyTdBookingDrivingLicence(bookingId, {
        file,
        dlNumber: dlNum,
        dlValidUntil: validUntilDraft,
      });
      toast.success(dlVerified ? "Driving licence details updated" : "Driving licence verified and saved");
      cancelEditing();
      await onVerified();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const imageToShow = preview ?? (dlVerified && dlImageUrl ? dlImageUrl : null);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-xs">
            Driving licence <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            {showForm
              ? "Enter licence number, validity date, and photo — then verify and save."
              : "Verified — use Edit to correct the licence details."}
          </p>
        </div>
        {dlVerified && !editing ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            disabled={disabled || uploading}
            onClick={startEditing}
          >
            <Pencil className="w-3 h-3 mr-1.5" /> Edit
          </Button>
        ) : null}
      </div>

      {showForm ? (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${inputId}-dl-number`} className="text-xs">
              Licence number *
            </Label>
            <Input
              id={`${inputId}-dl-number`}
              value={numberDraft}
              onChange={(e) => setNumberDraft(e.target.value.toUpperCase())}
              placeholder="e.g. BR-0120230012345"
              className="bg-secondary/50 uppercase"
              disabled={disabled || uploading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${inputId}-dl-valid`} className="text-xs">
              Valid until *
            </Label>
            <Input
              id={`${inputId}-dl-valid`}
              type="date"
              value={validUntilDraft}
              onChange={(e) => setValidUntilDraft(e.target.value)}
              className="bg-secondary/50"
              disabled={disabled || uploading}
            />
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-md border border-border/50 bg-background/50 px-3 py-2">
            <p className="text-muted-foreground">Licence number</p>
            <p className="font-medium text-foreground mt-0.5">{dlNumber || "—"}</p>
          </div>
          <div className="rounded-md border border-border/50 bg-background/50 px-3 py-2">
            <p className="text-muted-foreground">Valid until</p>
            <p className="font-medium text-foreground mt-0.5">{formatValidUntil(dlValidUntil)}</p>
          </div>
        </div>
      )}

      {imageToShow ? (
        <div className="rounded-lg border border-border/50 overflow-hidden bg-muted/20 max-w-xs">
          <img src={imageToShow} alt="Driving licence" className="w-full max-h-40 object-contain" />
        </div>
      ) : showForm ? (
        <label
          htmlFor={inputId}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-secondary/20 py-6 px-4 cursor-pointer hover:bg-secondary/30 transition-colors"
        >
          <Upload className="w-5 h-5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Choose licence image {dlVerified ? "" : "*"}</span>
        </label>
      ) : null}

      {showForm ? (
        <div className="flex flex-wrap gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-accent"
          >
            {file ? "Change image" : dlVerified ? "Replace image (optional)" : "Select image"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            className="bg-primary text-primary-foreground"
            disabled={disabled || uploading || (!file && !dlVerified) || !numberDraft.trim() || !validUntilDraft}
            onClick={() => void handleVerify()}
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {dlVerified ? "Save changes" : "Verify & save"}
          </Button>
          {editing ? (
            <Button size="sm" variant="outline" disabled={uploading} onClick={cancelEditing}>
              Cancel
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-green-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> DL verified
        </p>
      )}
    </div>
  );
}
