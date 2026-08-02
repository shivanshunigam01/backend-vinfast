import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IndianRupee, Plus, Trash2, Save } from "lucide-react";
import { hasApi } from "@/lib/apiConfig";
import { adminGetData, adminPutJson, formatApiErrors } from "@/lib/api";
import { getAdminUser, canPerformAction } from "@/lib/adminAuth";
import { toast } from "sonner";

export type PricingVariant = {
  id: string;
  label: string;
  price: string;
  order: number;
  active: boolean;
};

export type VehiclePricingRow = {
  _id?: string;
  slug: string;
  name: string;
  priceFrom: string;
  range: string;
  active: boolean;
  variants: PricingVariant[];
};

const AdminPricing = () => {
  const adminUser = getAdminUser();
  const canUpdate = canPerformAction(adminUser, "pricing", "update");
  const [rows, setRows] = useState<VehiclePricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasApi()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await adminGetData<VehiclePricingRow[]>("/admin/pricing");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRow = (slug: string, patch: Partial<VehiclePricingRow>) => {
    setRows((prev) => prev.map((r) => (r.slug === slug ? { ...r, ...patch } : r)));
  };

  const updateVariant = (slug: string, index: number, patch: Partial<PricingVariant>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.slug !== slug) return r;
        const variants = r.variants.map((v, i) => (i === index ? { ...v, ...patch } : v));
        return { ...r, variants };
      }),
    );
  };

  const addVariant = (slug: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.slug !== slug) return r;
        const id = `trim_${r.variants.length + 1}`;
        return {
          ...r,
          variants: [
            ...r.variants,
            { id, label: "New trim", price: r.priceFrom || "", order: r.variants.length, active: true },
          ],
        };
      }),
    );
  };

  const removeVariant = (slug: string, index: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.slug !== slug) return r;
        return { ...r, variants: r.variants.filter((_, i) => i !== index) };
      }),
    );
  };

  const save = async (row: VehiclePricingRow) => {
    setSavingSlug(row.slug);
    try {
      const updated = await adminPutJson<VehiclePricingRow>(`/admin/pricing/${row.slug}`, {
        name: row.name,
        priceFrom: row.priceFrom,
        range: row.range,
        active: row.active,
        variants: row.variants,
      });
      setRows((prev) => prev.map((r) => (r.slug === row.slug ? { ...r, ...updated } : r)));
      toast.success(`${row.name} pricing saved`);
    } catch (e) {
      toast.error(formatApiErrors(e));
    } finally {
      setSavingSlug(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <IndianRupee className="h-6 w-6" /> Vehicle Pricing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage model “from” prices and full trim matrix. Changes sync to homepage, model pages, Compare, and Site Config.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <div className="space-y-4">
        {rows.map((row) => (
          <Card key={row.slug} className="p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[140px]">
                <Label className="text-xs">Model</Label>
                <p className="font-medium">{row.name}</p>
                <p className="text-xs text-muted-foreground">{row.slug}</p>
              </div>
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs">Price from</Label>
                <Input
                  value={row.priceFrom}
                  disabled={!canUpdate}
                  onChange={(e) => updateRow(row.slug, { priceFrom: e.target.value })}
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <Label className="text-xs">Range</Label>
                <Input
                  value={row.range || ""}
                  disabled={!canUpdate}
                  onChange={(e) => updateRow(row.slug, { range: e.target.value })}
                />
              </div>
              {canUpdate && (
                <Button onClick={() => void save(row)} disabled={savingSlug === row.slug}>
                  <Save className="h-4 w-4 mr-1" />
                  {savingSlug === row.slug ? "Saving…" : "Save"}
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Trim / variant prices</Label>
                {canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => addVariant(row.slug)}>
                    <Plus className="h-3 w-3 mr-1" /> Add trim
                  </Button>
                )}
              </div>
              {row.variants.map((v, i) => (
                <div key={`${row.slug}-${v.id}-${i}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <Input
                    className="sm:col-span-2"
                    placeholder="id"
                    value={v.id}
                    disabled={!canUpdate}
                    onChange={(e) => updateVariant(row.slug, i, { id: e.target.value })}
                  />
                  <Input
                    className="sm:col-span-3"
                    placeholder="Label"
                    value={v.label}
                    disabled={!canUpdate}
                    onChange={(e) => updateVariant(row.slug, i, { label: e.target.value })}
                  />
                  <Input
                    className="sm:col-span-5"
                    placeholder="Price"
                    value={v.price}
                    disabled={!canUpdate}
                    onChange={(e) => updateVariant(row.slug, i, { price: e.target.value })}
                  />
                  {canUpdate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="sm:col-span-1"
                      onClick={() => removeVariant(row.slug, i)}
                      disabled={row.variants.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminPricing;
