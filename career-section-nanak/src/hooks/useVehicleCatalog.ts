import { useEffect, useMemo, useState } from "react";
import { CAR_MODELS, trimsForModel } from "@/data/vinfastModels";
import { fetchPublicVehicleCatalog, type CatalogModel } from "@/lib/vehicleCatalogApi";

/** Hardcoded lineup used until the server catalog loads (and when the API is unreachable). */
const STATIC_CATALOG: CatalogModel[] = CAR_MODELS.map((name) => ({
  name,
  variants: trimsForModel(name),
}));

let cachedCatalog: CatalogModel[] | null = null;
let inflight: Promise<CatalogModel[]> | null = null;

async function loadCatalog(): Promise<CatalogModel[]> {
  if (cachedCatalog) return cachedCatalog;
  if (!inflight) {
    inflight = fetchPublicVehicleCatalog()
      .then((data) => {
        cachedCatalog = data && data.length ? data : STATIC_CATALOG;
        return cachedCatalog;
      })
      .catch(() => STATIC_CATALOG)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Call after admin edits to the model master so open pages refetch. */
export function invalidateVehicleCatalog() {
  cachedCatalog = null;
}

export type VehicleCatalog = {
  /** Active models with their variant (trim) names, in display order. */
  catalog: CatalogModel[];
  /** Base model names. */
  models: string[];
  /** Plain trim names for a model (empty when the model has a single lineup). */
  trimsFor: (model: string) => string[];
  /** Full "model + trim" labels (falls back to the model name for single-lineup models). */
  variantOptionsFor: (model: string) => string[];
  /** First full variant label for a model. */
  defaultVariantFor: (model: string) => string;
  loaded: boolean;
};

export function useVehicleCatalog(): VehicleCatalog {
  const [catalog, setCatalog] = useState<CatalogModel[]>(cachedCatalog ?? STATIC_CATALOG);
  const [loaded, setLoaded] = useState(Boolean(cachedCatalog));

  useEffect(() => {
    let cancelled = false;
    void loadCatalog().then((data) => {
      if (!cancelled) {
        setCatalog(data);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const trimsFor = (model: string) => catalog.find((m) => m.name === model)?.variants ?? [];
    const variantOptionsFor = (model: string) => {
      const trims = trimsFor(model);
      return trims.length ? trims.map((t) => `${model} ${t}`) : [model];
    };
    return {
      catalog,
      models: catalog.map((m) => m.name),
      trimsFor,
      variantOptionsFor,
      defaultVariantFor: (model: string) => variantOptionsFor(model)[0] ?? model,
      loaded,
    };
  }, [catalog, loaded]);
}
