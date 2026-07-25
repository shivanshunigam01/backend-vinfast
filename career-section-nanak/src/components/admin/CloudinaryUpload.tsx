import { useRef, useEffect, useState, useId, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Link as LinkIcon, Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    cloudinary?: {
      createUploadWidget: (opts: Record<string, unknown>, cb: (error: unknown, result: unknown) => void) => {
        open: () => void;
        close?: () => void;
        destroy?: () => void;
      };
    };
  }
}

interface CloudinaryUploadProps {
  value?: string;
  onUpload: (url: string) => void;
  label?: string;
  aspectRatio?: string;
}

const CLOUDINARY_FOLDER = "patliputra-vinfast";

const CloudinaryUpload = ({ value, onUpload, label = "Upload Image", aspectRatio = "16/9" }: CloudinaryUploadProps) => {
  const fileInputId = useId();
  const widgetRef = useRef<ReturnType<NonNullable<Window["cloudinary"]>["createUploadWidget"]> | null>(null);
  const onUploadRef = useRef(onUpload);
  onUploadRef.current = onUpload;

  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(typeof window !== "undefined" && !!window.cloudinary);
  const [uploading, setUploading] = useState(false);

  const cloudName = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined)?.trim() || "demo";
  const uploadPreset = (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined)?.trim() || "ml_default";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.cloudinary) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, []);

  /** Pre-build widget so open() runs in one step on click; z_index above Radix Dialog (z-50). */
  useEffect(() => {
    if (!scriptLoaded || !window.cloudinary) return;

    const w = window.cloudinary.createUploadWidget(
      {
        cloudName,
        uploadPreset,
        sources: ["local", "url", "camera"],
        multiple: false,
        cropping: false,
        resourceType: "image",
        folder: CLOUDINARY_FOLDER,
        z_index: 999999,
        styles: {
          palette: { action: "#C80F1E", link: "#C80F1E" },
        },
      },
      (error: unknown, result: unknown) => {
        const r = result as { event?: string; info?: { secure_url?: string } } | undefined;
        if (!error && r?.event === "success" && r.info?.secure_url) {
          onUploadRef.current(r.info.secure_url);
          w.close?.();
        }
      },
    );
    widgetRef.current = w;
    return () => {
      try {
        w.destroy?.();
      } catch {
        /* ignore */
      }
      widgetRef.current = null;
    };
  }, [scriptLoaded, cloudName, uploadPreset]);

  const openWidget = useCallback(() => {
    if (!widgetRef.current) {
      toast.error("Upload widget is still loading. Try “Choose from computer” or wait a second.");
      return;
    }
    widgetRef.current.open();
  }, []);

  /** Direct browser file picker + unsigned Cloudinary upload — works inside Radix Dialog (no iframe picker). */
  const handleNativeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (cloudName === "demo" || uploadPreset === "ml_default") {
      toast.error("Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET in .env (unsigned preset).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", uploadPreset);
      fd.append("folder", CLOUDINARY_FOLDER);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
      if (!res.ok) {
        throw new Error(data.error?.message || `Upload failed (${res.status})`);
      }
      if (!data.secure_url) throw new Error("No image URL returned");
      onUpload(data.secure_url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onUpload(urlInput.trim());
      setUrlInput("");
      setShowUrlInput(false);
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative rounded-xl overflow-hidden bg-secondary/30 border border-border/50" style={{ aspectRatio }}>
          <img src={value} alt="Uploaded" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onUpload("")}
            className="absolute top-2 right-2 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-destructive transition-colors"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "rounded-xl border-2 border-dashed border-border/50 bg-secondary/20 flex flex-col items-center justify-center gap-3 py-6 px-4",
            uploading && "opacity-70 pointer-events-none",
          )}
          style={{ aspectRatio }}
        >
          <Upload className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">{label}</p>
          <label
            htmlFor={fileInputId}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow cursor-pointer hover:bg-primary/90",
              uploading && "pointer-events-none",
            )}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Choose from computer"}
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleNativeFile}
            disabled={uploading}
          />
          <p className="text-[10px] text-muted-foreground/70 text-center max-w-[14rem]">
            Opens your system file picker (works in admin popups). Or use Cloudinary / URL below.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {value ? (
          <>
            <label
              htmlFor={`${fileInputId}-change`}
              className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-accent"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />}
              Replace image
            </label>
            <input
              id={`${fileInputId}-change`}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleNativeFile}
              disabled={uploading}
            />
          </>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={openWidget} className="flex-1 min-w-[8rem] gap-1.5 text-xs" disabled={!scriptLoaded || uploading}>
          <Upload className="w-3 h-3" /> Cloudinary widget
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowUrlInput(!showUrlInput)} className="gap-1.5 text-xs">
          <LinkIcon className="w-3 h-3" /> URL
        </Button>
      </div>

      {showUrlInput && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste image URL..."
            className="bg-secondary/50 text-xs h-9"
            onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
          />
          <Button type="button" size="sm" onClick={handleUrlSubmit} className="bg-primary text-primary-foreground text-xs px-3">
            Set
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setShowUrlInput(false)} className="text-xs px-2">
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default CloudinaryUpload;
