import { useCallback, useEffect, useState } from "react";
import { hasApi } from "@/lib/apiConfig";
import { publicGet } from "@/lib/api";

export type PublicPricingVariant = {
  id: string;
  label: string;
  price: string;
  order?: number;
  active?: boolean;
};

export type PublicVehiclePricing = {
  slug: string;
  name: string;
  priceFrom: string;
  range?: string;
  variants: PublicPricingVariant[];
};

let cache: PublicVehiclePricing[] | null = null;
let cacheAt = 0;
const CACHE_MS = 60_000;

export function usePublicPricing() {
  const [pricing, setPricing] = useState<PublicVehiclePricing[]>(cache || []);
  const [loading, setLoading] = useState(!cache);

  const refresh = useCallback(async (force = false) => {
    if (!hasApi()) {
      setLoading(false);
      return;
    }
    if (!force && cache && Date.now() - cacheAt < CACHE_MS) {
      setPricing(cache);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await publicGet<PublicVehiclePricing[]>("/public/pricing");
      const list = Array.isArray(data) ? data : [];
      cache = list;
      cacheAt = Date.now();
      setPricing(list);
    } catch {
      setPricing(cache || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const bySlug = useCallback(
    (slug: string) => pricing.find((p) => p.slug === slug),
    [pricing],
  );

  const variantPrice = useCallback(
    (slug: string, variantId: string, fallback?: string) => {
      const row = bySlug(slug);
      const v = row?.variants?.find((x) => x.id === variantId || x.id === mapVariantAlias(variantId));
      return v?.price || row?.priceFrom || fallback || "";
    },
    [bySlug],
  );

  return { pricing, loading, refresh, bySlug, variantPrice };
}

function mapVariantAlias(id: string) {
  if (id === "windInfinity") return "infinity";
  if (id === "infinity") return "windInfinity";
  return id;
}

export function priceFromSlugMap(
  pricing: PublicVehiclePricing[],
  slug: string,
  fallback: string,
): string {
  return pricing.find((p) => p.slug === slug)?.priceFrom || fallback;
}
