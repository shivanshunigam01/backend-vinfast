import { adminGet } from "@/lib/api";

/** Paginated leads — GET /admin/leads (JWT). Meta Lead page uses separate axios URL in metaLeadsApi.ts. */
export const ADMIN_LEADS_PATH = "/admin/leads";

export type AdminLeadsPageParams = {
  page?: number;
  limit?: number;
  status?: string;
  model?: string;
  source?: string;
  search?: string;
  from?: string;
  to?: string;
};

/** First page (or custom page) from the paginated leads API. */
export async function fetchLeadsPage<T>(
  mapper: (doc: Record<string, unknown>) => T,
  params: AdminLeadsPageParams = {},
): Promise<{ rows: T[]; meta?: { page: number; limit: number; total: number } }> {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 500),
  });
  if (params.status) qs.set("status", params.status);
  if (params.model) qs.set("model", params.model);
  if (params.source) qs.set("source", params.source);
  if (params.search) qs.set("search", params.search);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);

  const { data, meta } = await adminGet<unknown[]>(`${ADMIN_LEADS_PATH}?${qs}`);
  const batch = (data ?? []) as Record<string, unknown>[];
  return { rows: batch.map(mapper), meta };
}

const PAGE_LIMIT = 2500;
const MAX_PAGES = 500;

/**
 * Loads every row from a paginated admin list endpoint (`meta.total` + paging)
 * into a single array for CSV/PDF export.
 */
export async function fetchAllAdminRows<T>(
  resourcePath: string,
  mapper: (doc: Record<string, unknown>) => T,
): Promise<T[]> {
  const base = resourcePath.split("?")[0];
  const results: T[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const { data, meta } = await adminGet<unknown[]>(`${base}?page=${page}&limit=${PAGE_LIMIT}`);
    const batch = (data ?? []) as Record<string, unknown>[];
    for (const doc of batch) {
      results.push(mapper(doc));
    }
    const total = meta?.total;
    if (batch.length === 0) break;
    if (batch.length < PAGE_LIMIT) break;
    if (typeof total === "number" && results.length >= total) break;
    page += 1;
  }

  return results;
}
