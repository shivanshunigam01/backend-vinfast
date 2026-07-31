import { useEffect, useId, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Camera, CheckCircle2, Loader2, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { endTestDriveLog, updateCompletionMedia, type TDLogRecord } from "@/lib/tdLogApi";
import { submitTDFeedback } from "@/lib/tdFeedbackApi";
import { formatApiErrors } from "@/lib/api";
import {
  RATING_FIELDS,
  RatingRow,
  useFeedbackVariantChoices,
  type RatingKey,
} from "@/components/admin/TDFeedbackForm";

type GeoFix = { lat: number; lng: number; accuracy?: number };

type PhotoPick = { file: File | null; preview: string | null };

/** Parse lat/lng from Google Maps share/pin URLs or plain "lat,lng" text. */
export function parseGoogleMapsLocation(raw: string): GeoFix | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  const atMatch = text.match(/@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const qMatch = text.match(/[?&](?:q|query|ll)=(-?\d+\.?\d*)[,+\s]+(-?\d+\.?\d*)/i);
  if (qMatch) {
    const lat = Number(qMatch[1]);
    const lng = Number(qMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const placeMatch = text.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (placeMatch) {
    const lat = Number(placeMatch[1]);
    const lng = Number(placeMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  const plain = text.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (plain) {
    const lat = Number(plain[1]);
    const lng = Number(plain[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingMongoId: string;
  bookingCode?: string;
  customerName?: string;
  customerId?: string;
  preferredModel?: string;
  dlVerified: boolean;
  log: TDLogRecord | null;
  vehicleBattery?: number;
  initialClosingOdometer?: string;
  /** Called after the drive is completed (feedback may still have failed — shown via toast). */
  onCompleted: () => void | Promise<void>;
};

function PhotoField({
  id,
  label,
  required,
  photo,
  onPick,
  disabled,
}: {
  id: string;
  label: string;
  required?: boolean;
  photo: PhotoPick;
  onPick: (p: PhotoPick) => void;
  disabled?: boolean;
}) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    onPick({ file: picked, preview: URL.createObjectURL(picked) });
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label} {required ? "*" : <span className="text-muted-foreground font-normal">(optional)</span>}
      </Label>
      {photo.preview ? (
        <div className="rounded-lg border border-border/50 overflow-hidden bg-muted/20">
          <img src={photo.preview} alt={label} className="w-full max-h-32 object-contain" />
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border/50 bg-secondary/20 py-5 px-3 cursor-pointer hover:bg-secondary/30 transition-colors"
        >
          <Camera className="w-4 h-4 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground text-center">Take / choose photo</span>
        </label>
      )}
      <div className="flex gap-2">
        <label
          htmlFor={id}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-2.5 py-1 text-[11px] font-medium cursor-pointer hover:bg-accent"
        >
          {photo.file ? "Change photo" : "Select photo"}
        </label>
        {photo.file ? (
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-destructive"
            onClick={() => onPick({ file: null, preview: null })}
            disabled={disabled}
          >
            Remove
          </button>
        ) : null}
      </div>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={handleChange}
      />
    </div>
  );
}

/** Read-only card showing everything captured at completion (photos, GPS, remarks, timestamp). */
export function TestDriveCompletionSummary({ log }: { log: TDLogRecord }) {
  const photos = [
    { label: "Customer photo", url: log.customerPhotoUrl },
    { label: "Vehicle photo", url: log.vehiclePhotoUrl },
    { label: "Driving licence", url: log.dlImageUrl },
  ].filter((p) => p.url);

  const endLat = log.endLocation?.lat;
  const endLng = log.endLocation?.lng;
  const hasLocation = endLat != null && endLng != null;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Completion capture</p>
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground">Completed at</p>
          <p className="font-medium text-foreground mt-0.5">
            {log.endTime
              ? new Date(log.endTime).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Location (lat, lng)</p>
          {hasLocation ? (
            <a
              href={`https://www.google.com/maps?q=${endLat},${endLng}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
            >
              <MapPin className="w-3 h-3" />
              {endLat.toFixed(6)}, {endLng.toFixed(6)}
            </a>
          ) : (
            <p className="font-medium text-foreground mt-0.5">—</p>
          )}
        </div>
        {log.dlNumber ? (
          <div>
            <p className="text-muted-foreground">DL number</p>
            <p className="font-medium text-foreground mt-0.5">{log.dlNumber}</p>
          </div>
        ) : null}
        {log.executiveRemarks ? (
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Executive remarks</p>
            <p className="text-foreground leading-relaxed mt-0.5">{log.executiveRemarks}</p>
          </div>
        ) : null}
      </div>
      {photos.length ? (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <a key={p.label} href={p.url} target="_blank" rel="noreferrer" className="block group">
              <div className="rounded-md border border-border/50 overflow-hidden bg-background/40">
                <img src={p.url} alt={p.label} className="w-full h-20 object-cover group-hover:opacity-90" />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-center">{p.label}</p>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CompleteTestDriveDialog({
  open,
  onOpenChange,
  bookingMongoId,
  bookingCode,
  customerName,
  customerId,
  preferredModel,
  dlVerified,
  log,
  vehicleBattery,
  initialClosingOdometer,
  onCompleted,
}: Props) {
  const idBase = useId();
  const variantChoices = useFeedbackVariantChoices(preferredModel);
  const [closingOdometer, setClosingOdometer] = useState("");
  const [customerPhoto, setCustomerPhoto] = useState<PhotoPick>({ file: null, preview: null });
  const [vehiclePhoto, setVehiclePhoto] = useState<PhotoPick>({ file: null, preview: null });
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [geoError, setGeoError] = useState("");
  const [executiveRemarks, setExecutiveRemarks] = useState("");
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    drivingExperience: 4,
    vehicleComfort: 4,
    batteryConfidence: 4,
    executiveBehaviour: 5,
    purchaseIntention: 4,
  });
  const [preferredVariant, setPreferredVariant] = useState("");
  const [feedbackRemarks, setFeedbackRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const captureLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      setGeoError("Geolocation is not supported on this device/browser.");
      return;
    }
    setGeoStatus("loading");
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGeoStatus("ok");
      },
      (err) => {
        setGeo(null);
        setGeoStatus("error");
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow location access and retry."
            : "Could not get the current location. Retry near a window / outdoors.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  // Reset per booking and auto-capture location when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setClosingOdometer(initialClosingOdometer ?? "");
    setCustomerPhoto({ file: null, preview: null });
    setVehiclePhoto({ file: null, preview: null });
    setExecutiveRemarks("");
    setRatings({
      drivingExperience: 4,
      vehicleComfort: 4,
      batteryConfidence: 4,
      executiveBehaviour: 5,
      purchaseIntention: 4,
    });
    setPreferredVariant("");
    setFeedbackRemarks("");
    captureLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingMongoId]);

  const handleSubmit = async () => {
    if (!log?._id) {
      toast.error("No active test drive log found. Start the drive first.");
      return;
    }
    const closing = Number(closingOdometer);
    if (!closingOdometer.trim() || Number.isNaN(closing) || closing < 0) {
      toast.error("Enter the closing odometer reading (km).");
      return;
    }
    if (log.openingOdometer != null && closing < log.openingOdometer) {
      toast.error("Closing odometer cannot be less than opening odometer.");
      return;
    }
    if (!dlVerified) {
      toast.error("Verify the customer's driving licence before completing the test drive.");
      return;
    }
    if (!customerPhoto.file) {
      toast.error("Capture the customer photo — it is required at completion.");
      return;
    }

    setSaving(true);
    try {
      const updated = await endTestDriveLog(log._id, {
        closingOdometer: closing,
        closingBattery: vehicleBattery,
        executiveRemarks: executiveRemarks.trim() || undefined,
        customerPhoto: customerPhoto.file,
        vehiclePhoto: vehiclePhoto.file,
        endLat: geo?.lat,
        endLng: geo?.lng,
        endAccuracy: geo?.accuracy,
      });
      toast.success(
        updated.totalKM != null
          ? `Test drive completed — ${updated.totalKM} km driven`
          : "Test drive completed",
      );

      try {
        await submitTDFeedback({
          bookingId: bookingMongoId,
          customerId,
          ...ratings,
          preferredVariant: preferredVariant || undefined,
          remarks: feedbackRemarks.trim() || undefined,
        });
        toast.success("Customer feedback saved");
      } catch (feedbackErr) {
        toast.error(
          `Drive completed, but feedback could not be saved: ${formatApiErrors(feedbackErr)}. You can record it from the booking.`,
        );
      }

      onOpenChange(false);
      await onCompleted();
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Complete test drive</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-xs text-muted-foreground">
            {bookingCode ? <span className="font-mono">{bookingCode}</span> : null}
            {customerName ? <> · {customerName}</> : null}
            {preferredModel ? <> · {preferredModel}</> : null}
          </p>

          {!dlVerified ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Driving licence is not verified. Verify the customer&apos;s DL in the booking first — completion is
                blocked until then.
              </span>
            </div>
          ) : null}

          {/* Odometer */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Closing odometer (km) *</Label>
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={closingOdometer}
                onChange={(e) => setClosingOdometer(e.target.value)}
                className="bg-secondary/50"
                placeholder="After test drive"
                disabled={saving}
              />
              {log?.openingOdometer != null ? (
                <p className="text-[10px] text-muted-foreground">Opening reading: {log.openingOdometer} km</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Completion location</Label>
              <div className="rounded-md border border-border/50 bg-secondary/30 px-3 py-2 text-xs flex items-center gap-2 min-h-10">
                {geoStatus === "loading" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                    <span className="text-muted-foreground">Getting GPS location…</span>
                  </>
                ) : geoStatus === "ok" && geo ? (
                  <>
                    <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span className="font-mono text-[11px]">
                      {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-muted-foreground flex-1">{geoError || "Location not captured yet."}</span>
                    <button
                      type="button"
                      className="text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                      onClick={captureLocation}
                      disabled={saving}
                    >
                      <RefreshCw className="w-3 h-3" /> Retry
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Photos */}
          <div className="grid sm:grid-cols-2 gap-3">
            <PhotoField
              id={`${idBase}-customer-photo`}
              label="Customer photo"
              required
              photo={customerPhoto}
              onPick={setCustomerPhoto}
              disabled={saving}
            />
            <PhotoField
              id={`${idBase}-vehicle-photo`}
              label="Vehicle photo"
              photo={vehiclePhoto}
              onPick={setVehiclePhoto}
              disabled={saving}
            />
          </div>

          {/* Ratings & feedback */}
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Customer ratings & feedback</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {RATING_FIELDS.map(({ key, label }) => (
                <RatingRow
                  key={key}
                  label={label}
                  value={ratings[key]}
                  onChange={(v) => setRatings((prev) => ({ ...prev, [key]: v }))}
                />
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Preferred variant</Label>
                <Select
                  value={preferredVariant || "none"}
                  onValueChange={(v) => setPreferredVariant(v === "none" ? "" : v)}
                >
                  <SelectTrigger className="bg-secondary/50 h-9">
                    <SelectValue placeholder={preferredModel ? `Trim for ${preferredModel}` : "Select trim"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Not specified —</SelectItem>
                    {variantChoices.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Customer feedback / comments</Label>
                <Textarea
                  value={feedbackRemarks}
                  onChange={(e) => setFeedbackRemarks(e.target.value)}
                  className="bg-secondary/50"
                  rows={2}
                  placeholder="What the customer said…"
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* Executive remarks */}
          <div className="space-y-1.5">
            <Label className="text-xs">Executive remarks</Label>
            <Textarea
              value={executiveRemarks}
              onChange={(e) => setExecutiveRemarks(e.target.value)}
              className="bg-secondary/50"
              rows={2}
              placeholder="Vehicle condition, incidents, next steps…"
              disabled={saving}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={saving || !dlVerified || !customerPhoto.file || !closingOdometer.trim()}
              onClick={() => void handleSubmit()}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Complete test drive
            </Button>
            <Button variant="outline" className="flex-1" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The completion timestamp, GPS location, photos, DL data, ratings, and remarks are stored on the test
            drive record.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type UpdateMediaProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: TDLogRecord | null;
  onSaved: (log: TDLogRecord) => void | Promise<void>;
};

/** Post-completion: upload/replace customer photo and Google-pinned location. */
export function UpdateCompletionMediaDialog({ open, onOpenChange, log, onSaved }: UpdateMediaProps) {
  const idBase = useId();
  const [customerPhoto, setCustomerPhoto] = useState<PhotoPick>({ file: null, preview: null });
  const [vehiclePhoto, setVehiclePhoto] = useState<PhotoPick>({ file: null, preview: null });
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [geoError, setGeoError] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const hasExistingPhoto = Boolean(log?.customerPhotoUrl);
  const hasExistingLocation = log?.endLocation?.lat != null && log?.endLocation?.lng != null;

  const captureLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      setGeoError("Geolocation is not supported on this device/browser.");
      return;
    }
    setGeoStatus("loading");
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGeoStatus("ok");
        setMapsUrl("");
      },
      (err) => {
        setGeoStatus("error");
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow location access and retry."
            : "Could not get the current location. Retry near a window / outdoors.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  useEffect(() => {
    if (!open) return;
    setCustomerPhoto({
      file: null,
      preview: log?.customerPhotoUrl || null,
    });
    setVehiclePhoto({
      file: null,
      preview: log?.vehiclePhotoUrl || null,
    });
    if (log?.endLocation?.lat != null && log?.endLocation?.lng != null) {
      setGeo({
        lat: log.endLocation.lat,
        lng: log.endLocation.lng,
        accuracy: log.endLocation.accuracy,
      });
      setGeoStatus("ok");
    } else {
      setGeo(null);
      setGeoStatus("idle");
      captureLocation();
    }
    setMapsUrl("");
    setGeoError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, log?._id]);

  const applyMapsUrl = () => {
    const parsed = parseGoogleMapsLocation(mapsUrl);
    if (!parsed) {
      toast.error("Could not read coordinates from that Google Maps link. Paste a pin URL or lat,lng.");
      return;
    }
    setGeo(parsed);
    setGeoStatus("ok");
    setGeoError("");
    toast.success("Location set from Google Maps pin");
  };

  const handleSave = async () => {
    if (!log?._id) {
      toast.error("No completion log found for this booking.");
      return;
    }
    if (!hasExistingPhoto && !customerPhoto.file) {
      toast.error("Customer photo is required.");
      return;
    }
    if (!geo && !hasExistingLocation) {
      toast.error("Capture GPS or paste a Google Maps pin for the test drive location.");
      return;
    }
    if (!customerPhoto.file && !vehiclePhoto.file && !geo) {
      toast.error("Choose a new photo or update the location.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCompletionMedia(log._id, {
        customerPhoto: customerPhoto.file,
        vehiclePhoto: vehiclePhoto.file,
        endLat: geo?.lat,
        endLng: geo?.lng,
        endAccuracy: geo?.accuracy,
      });
      toast.success("Photo / location updated");
      await onSaved(updated);
      onOpenChange(false);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Update photo / location</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Add or replace the customer photo and the Google-pinned location where the test drive was conducted.
          </p>

          <PhotoField
            id={`${idBase}-upd-customer`}
            label="Customer photo"
            required={!hasExistingPhoto}
            photo={customerPhoto}
            onPick={setCustomerPhoto}
            disabled={saving}
          />
          <PhotoField
            id={`${idBase}-upd-vehicle`}
            label="Vehicle photo"
            photo={vehiclePhoto}
            onPick={setVehiclePhoto}
            disabled={saving}
          />

          <div className="space-y-2 rounded-lg border border-border/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Test drive location
              </Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={captureLocation} disabled={saving}>
                <RefreshCw className={`w-3 h-3 mr-1 ${geoStatus === "loading" ? "animate-spin" : ""}`} />
                Use GPS
              </Button>
            </div>
            {geo ? (
              <a
                href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-mono text-primary hover:underline block"
              >
                {geo.lat.toFixed(6)}, {geo.lng.toFixed(6)} — open in Google Maps
              </a>
            ) : (
              <p className="text-[11px] text-muted-foreground">No location yet</p>
            )}
            {geoError ? <p className="text-[11px] text-destructive">{geoError}</p> : null}
            <div className="space-y-1.5 pt-1">
              <Label className="text-[11px] text-muted-foreground">Or paste Google Maps pin / share URL</Label>
              <div className="flex gap-2">
                <Input
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/… or 25.61, 85.14"
                  className="bg-secondary/50 text-xs"
                  disabled={saving}
                />
                <Button type="button" variant="outline" size="sm" onClick={applyMapsUrl} disabled={saving || !mapsUrl.trim()}>
                  Apply
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              Save
            </Button>
            <Button variant="outline" className="flex-1" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
