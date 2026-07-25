import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit2, Trash2, Plus, Palette, X } from "lucide-react";
import CloudinaryUpload from "@/components/admin/CloudinaryUpload";
import { getStoredState, setStoredState } from "@/lib/vfLocalStorage";
import { hasApi } from "@/lib/apiConfig";
import { adminDeleteJson, adminGetData, adminPostJson, adminPutJson, formatApiErrors } from "@/lib/api";
import {
  adminProductFromApi,
  adminProductToApiPayload,
  slugifyFromName,
  isMongoId,
  type AdminProductRow,
} from "@/lib/adminCmsMappers";
import { toast } from "sonner";

type Product = AdminProductRow;
type ColorVariant = Product["colorVariants"][number];

const initialProducts: Product[] = [
  {
    id: "P1", slug: "vf-7", name: "VinFast VF 7", tagline: "Bold. Intelligent. Unstoppable.",
    priceFrom: "₹21,89,000*", range: "532 km", battery: "70 kWh", power: "349 HP",
    torque: "500 Nm", topSpeed: "200 km/h", driveType: "AWD", fastCharge: "10-70% in 24 min",
    homeCharge: "0-100% in 11 hrs", safety: "5-Star NCAP", airbags: "6 Airbags",
    adas: "Level 2+", touchscreen: '15.6"', variants: "Plus, Max",
    heroImage: "", galleryImages: [], brochureUrl: "/brochures/VF7-Brochure.pdf", active: true,
    colorVariants: [
      { name: "Infinity Blanc", hex: "#E6E6E2", image: "" },
      { name: "Crimson Red", hex: "#C80F1E", image: "" },
      { name: "Jet Black", hex: "#18191D", image: "" },
      { name: "Desat Silver", hex: "#D8D9D4", image: "" },
      { name: "Zenith Grey", hex: "#61656B", image: "" },
      { name: "Urban Mint", hex: "#727A67", image: "" },
    ],
  },
  {
    id: "P2", slug: "vf-6", name: "VinFast VF 6", tagline: "Urban. Smart. Agile.",
    priceFrom: "₹17,29,000*", range: "468 km", battery: "59.6 kWh", power: "201 HP",
    torque: "310 Nm", topSpeed: "175 km/h", driveType: "FWD", fastCharge: "10-70% in 26 min",
    homeCharge: "0-100% in 9 hrs", safety: "5-Star NCAP", airbags: "6 Airbags",
    adas: "Level 2", touchscreen: '12.9"', variants: "Plus, Max",
    heroImage: "", galleryImages: [], brochureUrl: "/brochures/VF6-Brochure.pdf", active: true,
    colorVariants: [
      { name: "Infinity Blanc", hex: "#E6E6E2", image: "" },
      { name: "Crimson Red", hex: "#C80F1E", image: "" },
      { name: "Jet Black", hex: "#18191D", image: "" },
      { name: "Desat Silver", hex: "#D8D9D4", image: "" },
      { name: "Zenith Grey", hex: "#61656B", image: "" },
      { name: "Urban Mint", hex: "#727A67", image: "" },
    ],
  },
  {
    id: "P3", slug: "limo-green", name: "VinFast Limo Green", tagline: "Built for your business.",
    priceFrom: "₹22,99,000*", range: "450 km", battery: "60.13 kWh", power: "201 HP",
    torque: "280 Nm", topSpeed: "—", driveType: "FWD", fastCharge: "10-70% in 30 min",
    homeCharge: "—", safety: "ABS, EBD, ESC", airbags: "—",
    adas: "—", touchscreen: '10.1"', variants: "Single lineup",
    heroImage: "", galleryImages: [], brochureUrl: "", active: true,
    colorVariants: [
      { name: "Desat Silver", hex: "#D8D9D4", image: "" },
    ],
  },
];

const emptyProduct: Product = {
  id: "", slug: "", name: "", tagline: "", priceFrom: "", range: "", battery: "", power: "",
  torque: "", topSpeed: "", driveType: "", fastCharge: "", homeCharge: "",
  safety: "5-Star NCAP", airbags: "6 Airbags", adas: "", touchscreen: "",
  variants: "", heroImage: "", galleryImages: [], colorVariants: [], brochureUrl: "", active: true,
};

const AdminProducts = () => {
  const [hydrated, setHydrated] = useState(false);
  const [products, setProducts] = useState<Product[]>(() => (hasApi() ? [] : initialProducts));
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const STORAGE_KEY = "vf_admin_products";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (hasApi()) {
        try {
          const data = await adminGetData<unknown[]>("/admin/products?limit=200&page=1");
          if (!cancelled && Array.isArray(data)) {
            setProducts(data.map((doc) => adminProductFromApi(doc as Record<string, unknown>)));
            setHydrated(true);
            return;
          }
        } catch {
          /* leave empty — do not flash localStorage when API is configured */
        }
        if (!cancelled) setProducts([]);
      } else {
        const stored = getStoredState<Product[] | null>(STORAGE_KEY, null);
        if (!cancelled && stored && stored.length > 0) setProducts(stored);
      }
      if (!cancelled) setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (hasApi()) return;
    setStoredState(STORAGE_KEY, products);
  }, [products, hydrated]);

  const handleSave = async (product: Product) => {
    const row: Product = {
      ...product,
      slug: (product.slug?.trim() || slugifyFromName(product.name)).toLowerCase(),
    };
    if (hasApi()) {
      try {
        const payload = adminProductToApiPayload(row);
        if (isMongoId(row.id)) {
          const raw = await adminPutJson<Record<string, unknown>>(`/admin/products/${row.id}`, payload);
          const mapped = adminProductFromApi(raw);
          setProducts((prev) => prev.map((p) => (p.id === row.id ? mapped : p)));
        } else {
          const raw = await adminPostJson<Record<string, unknown>>("/admin/products", payload);
          const mapped = adminProductFromApi(raw);
          setProducts((prev) => {
            const filtered = row.id ? prev.filter((p) => p.id !== row.id) : prev;
            return [...filtered, mapped];
          });
        }
        toast.success("Product saved");
      } catch (e) {
        toast.error(formatApiErrors(e));
        return;
      }
    } else if (row.id) {
      setProducts((prev) => prev.map((p) => (p.id === row.id ? row : p)));
    } else {
      setProducts((prev) => [...prev, { ...row, id: `P${prev.length + 1}` }]);
    }
    setShowForm(false);
    setEditProduct(null);
  };

  const handleDelete = async (id: string) => {
    if (hasApi() && isMongoId(id)) {
      try {
        await adminDeleteJson(`/admin/products/${id}`);
        setProducts((prev) => prev.filter((p) => p.id !== id));
        toast.success("Product removed");
      } catch (e) {
        toast.error(formatApiErrors(e));
      }
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground text-sm">Manage car models, specs, images & colour variants</p>
        </div>
        <Button onClick={() => { setEditProduct(emptyProduct); setShowForm(true); }} className="bg-primary text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {products.map((p) => (
          <Card key={p.id} className="bg-card border-border/50 overflow-hidden">
            <div className="aspect-[16/9] bg-secondary/20 relative">
              {p.heroImage
                ? <img src={p.heroImage} alt={p.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-sm">No hero image</div>
              }
              <div className="absolute top-2 right-2 flex gap-1">
                <button onClick={() => { setEditProduct(p); setShowForm(true); }} className="p-1.5 rounded bg-white/80 hover:bg-white text-foreground shadow"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded bg-white/80 hover:bg-red-50 text-destructive shadow"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <h3 className="font-display font-bold text-lg text-foreground">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-secondary/30 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-semibold text-foreground">{p.priceFrom}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Range</p>
                  <p className="font-semibold text-foreground">{p.range}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-2 text-center">
                  <p className="text-muted-foreground">Power</p>
                  <p className="font-semibold text-foreground">{p.power}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{p.colorVariants.length} colour variants</span>
                <div className="flex gap-1 ml-1">
                  {p.colorVariants.slice(0, 6).map(c => (
                    <div key={c.name} className="w-4 h-4 rounded-full border border-border/50" style={{ backgroundColor: c.hex }} title={c.name} />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditProduct(null); }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editProduct?.id ? `Edit — ${editProduct.name}` : "Add Product"}</DialogTitle>
          </DialogHeader>
          {editProduct && (
            <ProductForm product={editProduct} onSave={handleSave} onCancel={() => { setShowForm(false); setEditProduct(null); }} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ProductForm = ({ product, onSave, onCancel }: { product: Product; onSave: (p: Product) => void | Promise<void>; onCancel: () => void }) => {
  const [form, setForm] = useState<Product>(product);
  useEffect(() => {
    setForm(product);
  }, [product]);
  const update = <K extends keyof Product>(key: K, value: Product[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const updateColor = (index: number, field: keyof ColorVariant, value: string) => {
    const updated = form.colorVariants.map((c, i) => i === index ? { ...c, [field]: value } : c);
    update("colorVariants", updated);
  };

  const addColor = () => update("colorVariants", [...form.colorVariants, { name: "", hex: "#000000", image: "" }]);
  const removeColor = (index: number) => update("colorVariants", form.colorVariants.filter((_, i) => i !== index));

  const addGalleryImage = (url: string) => { if (url) update("galleryImages", [...form.galleryImages, url]); };
  const removeGalleryImage = (index: number) => update("galleryImages", form.galleryImages.filter((_, i) => i !== index));

  return (
    <Tabs defaultValue="basic" className="space-y-4">
      <TabsList className="bg-secondary/50">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="specs">Specifications</TabsTrigger>
        <TabsTrigger value="images">Images</TabsTrigger>
        <TabsTrigger value="colours">Colours</TabsTrigger>
      </TabsList>

      {/* Basic Info */}
      <TabsContent value="basic" className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Model Name</Label>
            <Input value={form.name} onChange={e => update("name", e.target.value)} className="bg-secondary/50" placeholder="VinFast VF 7" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">URL slug</Label>
            <Input value={form.slug} onChange={e => update("slug", e.target.value)} className="bg-secondary/50 font-mono text-xs" placeholder="vf-7 (auto from name if empty)" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Tagline</Label>
            <Input value={form.tagline} onChange={e => update("tagline", e.target.value)} className="bg-secondary/50" placeholder="Bold. Intelligent. Unstoppable." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ex-Showroom Price</Label>
            <Input value={form.priceFrom} onChange={e => update("priceFrom", e.target.value)} className="bg-secondary/50" placeholder="₹21,89,000*" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Variants</Label>
            <Input value={form.variants} onChange={e => update("variants", e.target.value)} className="bg-secondary/50" placeholder="Plus, Max" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Brochure PDF URL</Label>
            <Input value={form.brochureUrl} onChange={e => update("brochureUrl", e.target.value)} className="bg-secondary/50" placeholder="/brochures/VF7-Brochure.pdf" />
          </div>
        </div>
      </TabsContent>

      {/* Specifications */}
      <TabsContent value="specs" className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "range" as const, label: "Range (WLTP)", placeholder: "532 km" },
            { key: "battery" as const, label: "Battery Capacity", placeholder: "70 kWh" },
            { key: "power" as const, label: "Motor Power", placeholder: "349 HP" },
            { key: "torque" as const, label: "Torque", placeholder: "500 Nm" },
            { key: "topSpeed" as const, label: "Top Speed", placeholder: "200 km/h" },
            { key: "driveType" as const, label: "Drive Type", placeholder: "AWD" },
            { key: "fastCharge" as const, label: "Fast Charge", placeholder: "10-70% in 24 min" },
            { key: "homeCharge" as const, label: "Home Charge", placeholder: "0-100% in 11 hrs" },
            { key: "safety" as const, label: "Safety Rating", placeholder: "5-Star NCAP" },
            { key: "airbags" as const, label: "Airbags", placeholder: "6 Airbags" },
            { key: "adas" as const, label: "ADAS Level", placeholder: "Level 2+" },
            { key: "touchscreen" as const, label: "Touchscreen Size", placeholder: '15.6"' },
          ].map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input value={form[key] as string} onChange={e => update(key, e.target.value)} className="bg-secondary/50" placeholder={placeholder} />
            </div>
          ))}
        </div>
      </TabsContent>

      {/* Images */}
      <TabsContent value="images" className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Hero Image (main product page banner)</Label>
          <CloudinaryUpload value={form.heroImage} onUpload={(url) => update("heroImage", url)} label="Upload Hero Image" aspectRatio="16/9" />
        </div>
        <div className="space-y-3">
          <Label className="text-xs font-semibold">Gallery Images</Label>
          <div className="grid grid-cols-3 gap-3">
            {form.galleryImages.map((img, i) => (
              <div key={i} className="relative rounded-lg overflow-hidden aspect-[4/3] bg-secondary/30">
                <img src={img} alt={`gallery-${i}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeGalleryImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center hover:bg-destructive"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            ))}
            <div className="aspect-[4/3]">
              <CloudinaryUpload value="" onUpload={addGalleryImage} label="+ Add" aspectRatio="4/3" />
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Colours */}
      <TabsContent value="colours" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{form.colorVariants.length} colour variants</p>
          <Button type="button" size="sm" variant="outline" onClick={addColor} className="gap-1.5 text-xs">
            <Plus className="w-3 h-3" /> Add Colour
          </Button>
        </div>
        <div className="space-y-4">
          {form.colorVariants.map((color, i) => (
            <Card key={i} className="bg-secondary/20 border-border/30 p-4">
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Colour Name</Label>
                      <Input value={color.name} onChange={e => updateColor(i, "name", e.target.value)} className="bg-background/50" placeholder="Crimson Red" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Hex Code</Label>
                      <div className="flex gap-2">
                        <input type="color" value={color.hex} onChange={e => updateColor(i, "hex", e.target.value)} className="w-10 h-10 rounded cursor-pointer border border-border" />
                        <Input value={color.hex} onChange={e => updateColor(i, "hex", e.target.value)} className="bg-background/50 font-mono text-xs" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Car Image for this colour</Label>
                    <CloudinaryUpload value={color.image} onUpload={(url) => updateColor(i, "image", url)} label="Upload colour render" aspectRatio="16/9" />
                  </div>
                </div>
                <button type="button" onClick={() => removeColor(i)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0 mt-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </TabsContent>

      <div className="flex gap-3 pt-2 border-t border-border/30">
        <Button onClick={() => onSave(form)} className="bg-primary text-primary-foreground flex-1">Save Product</Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
      </div>
    </Tabs>
  );
};

export default AdminProducts;
