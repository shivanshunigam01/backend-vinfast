import { useCallback, useEffect, useState } from "react";
import { hasApi } from "@/lib/apiConfig";
import { publicGet } from "@/lib/api";

export type PublicOfferRecord = Record<string, unknown>;

/**
 * Loads active public offers from the API. When the API is off or returns nothing, `offers` is empty (no static fallback).
 */
export function usePublicOffers() {
  const [offers, setOffers] = useState<PublicOfferRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!hasApi()) {
      setOffers([]);
      setLoaded(true);
      return;
    }
    const data = await publicGet<unknown[]>("/public/offers");
    if (Array.isArray(data) && data.length > 0) {
      setOffers(data as PublicOfferRecord[]);
    } else {
      setOffers([]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    offers,
    loaded,
    hasOffers: offers.length > 0,
    reload,
  };
}
