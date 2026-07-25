import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Copy, Check, Search, ImageIcon, Upload } from "lucide-react";
import CloudinaryUpload from "@/components/admin/CloudinaryUpload";
import { getStoredState, setStoredState } from "@/lib/vfLocalStorage";
import { hasApi } from "@/lib/apiConfig";
import { adminDeleteJson, adminGetData, adminPostJson, formatApiErrors } from "@/lib/api";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  url: string;
  name: string;
  tag: string;
  uploadedAt: string;
}

const initialMedia: MediaItem[] = [
  { id: "M1", url: "", name: "VF7 Hero Banner", tag: "VF 7", uploadedAt: "2026-03-31" },
  { id: "M2", url: "", name: "VF6 Hero Banner", tag: "VF 6", uploadedAt: "2026-03-31" },
];

const TAGS = ["All", "VF 7", "VF 6", "VF MPV 7", "Limo Green", "Banner", "Interior", "Exterior", "Colour", "Other"];

function mediaFromApi(doc: Record<string, unknown>): MediaItem {
  const created = doc.createdAt ? new Date(String(doc.createdAt)).toISOString().slice(0, 10) : "";
  return {
    id: String(doc._id ?? ""),
    url: String(doc.url ?? ""),
    name: String(doc.name ?? ""),
    tag: String(doc.tag ?? "Other"),
    uploadedAt: created,
  };
}

const AdminMedia = () => {
  const useRemote = hasApi();
  const [hydrated, setHydrated] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>(() => (hasApi() ? [] : initialMedia));
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newTag, setNewTag] = useState("Other");
  const STORAGE_KEY = "vf_admin_media";

  const refreshFromApi = useCallback(async () => {
    const raw = await adminGetData<unknown[]>("/admin/media?limit=200&page=1");
    setMedia((raw as Record<string, unknown>[]).map(mediaFromApi));
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
    const stored = getStoredState<MediaItem[] | null>(STORAGE_KEY, null);
    if (stored && stored.length > 0) setMedia(stored);
    setHydrated(true);
  }, [useRemote, refreshFromApi]);

  useEffect(() => {
    if (!hydrated || useRemote) return;
    setStoredState(STORAGE_KEY, media);
  }, [media, hydrated, useRemote]);

  const filtered = media.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    const matchTag = activeTag === "All" || m.tag === activeTag;
    return matchSearch && matchTag && m.url;
  });

  const handleUpload = async (url: string) => {
    if (!url) return;
    const name = newName || `Image ${media.length + 1}`;
    if (useRemote) {
      try {
        const created = await adminPostJson<Record<string, unknown>>("/admin/media", {
          name,
          url,
          tag: newTag,
          resourceType: "image",
        });
        setMedia((prev) => [mediaFromApi(created), ...prev]);
        toast.success("Uploaded to library");
      } catch (e) {
        toast.error(formatApiErrors(e));
      }
      setNewName("");
      return;
    }
    const item: MediaItem = {
      id: `M${Date.now()}`,
      url,
      name,
      tag: newTag,
      uploadedAt: new Date().toISOString().split("T")[0],
    };
    setMedia((prev) => [item, ...prev]);
    setNewName("");
  };

  const handleDelete = async (id: string) => {
    if (useRemote) {
      try {
        await adminDeleteJson(`/admin/media/${id}`);
        setMedia((prev) => prev.filter((m) => m.id !== id));
        toast.success("Removed");
      } catch (e) {
        toast.error(formatApiErrors(e));
      }
      return;
    }
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-primary" /> Media Library
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload and manage images via Cloudinary{useRemote ? " · records synced to API" : ""}
        </p>
      </div>

      {/* Upload New */}
      <Card className="bg-card border-border/50 p-5">
        <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" /> Upload New Image
        </h3>
        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Image Name / Label</p>
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. VF7 Crimson Red" className="bg-secondary/50" />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Tag / Category</p>
            <select
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              className="h-10 w-full px-3 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {TAGS.filter(t => t !== "All").map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <CloudinaryUpload value="" onUpload={handleUpload} label="Click to upload to Cloudinary" aspectRatio="21/9" />
      </Card>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search images..." className="pl-10 bg-secondary/50" />
        </div>
        <div className="flex flex-wrap gap-2">
          {TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeTag === tag ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ImageIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No images yet. Upload your first image above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <Card key={item.id} className="bg-card border-border/50 overflow-hidden group">
              <div className="aspect-[4/3] bg-secondary/30 relative overflow-hidden">
                <img src={item.url} alt={item.name} className="w-full h-full object-cover transition-[filter] duration-300 group-hover:brightness-[1.05]" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => copyUrl(item.id, item.url)}
                    title="Copy URL"
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    {copiedId === item.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Remove from library"
                    className="w-8 h-8 bg-destructive/80 hover:bg-destructive rounded-full flex items-center justify-center text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">{item.tag}</span>
                  <span className="text-[10px] text-muted-foreground">{item.uploadedAt}</span>
                </div>
                <button
                  onClick={() => copyUrl(item.id, item.url)}
                  className="mt-2 w-full text-[10px] text-primary hover:underline flex items-center justify-center gap-1"
                >
                  {copiedId === item.id ? <><Check className="w-2.5 h-2.5" /> Copied!</> : <><Copy className="w-2.5 h-2.5" /> Copy URL</>}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMedia;
