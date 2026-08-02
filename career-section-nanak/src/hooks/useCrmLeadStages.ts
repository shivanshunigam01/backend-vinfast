import { useCallback, useEffect, useState } from "react";
import { hasApi } from "@/lib/apiConfig";
import { adminGet } from "@/lib/api";
import {
  CRM_LEAD_STAGES,
  getCachedStageLabels,
  setCachedStages,
  stagesCacheFresh,
  type LeadStageDoc,
} from "@/lib/leadStages";

type MetaEnvelope = { data?: string[] } | string[];

function unwrapStages(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    if (raw.every((x) => typeof x === "string")) return raw as string[];
    if (raw.every((x) => x && typeof x === "object" && "label" in (x as object))) {
      return (raw as LeadStageDoc[]).map((d) => d.label);
    }
  }
  if (raw && typeof raw === "object" && Array.isArray((raw as MetaEnvelope & { data?: unknown }).data)) {
    return unwrapStages((raw as { data: unknown }).data);
  }
  return [...CRM_LEAD_STAGES];
}

/** Loads active CRM stage labels for pickers; falls back to seeded defaults. */
export function useCrmLeadStages() {
  const [stages, setStages] = useState<string[]>(() => getCachedStageLabels());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (force = false) => {
    if (!hasApi()) {
      setStages([...CRM_LEAD_STAGES]);
      return;
    }
    if (!force && stagesCacheFresh()) {
      setStages(getCachedStageLabels());
      return;
    }
    setLoading(true);
    try {
      const { data } = await adminGet<string[] | LeadStageDoc[]>("/admin/crm/leads/meta/stages");
      const labels = unwrapStages(data);
      setCachedStages(labels);
      setStages(labels);
    } catch {
      setStages(getCachedStageLabels());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { stages, loading, refresh };
}
