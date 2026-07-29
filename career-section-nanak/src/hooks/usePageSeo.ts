import { useEffect } from "react";
import { applyPageSeo, clearDynamicSchemas, type SeoPayload } from "@/lib/seo";

/** Sets title, description, canonical, OG/Twitter, and JSON-LD for the current page. */
export function usePageSeo(seo: SeoPayload | null | undefined) {
  useEffect(() => {
    if (!seo?.title || !seo?.description) return;
    applyPageSeo(seo);
    return () => {
      clearDynamicSchemas();
    };
  }, [
    seo?.title,
    seo?.description,
    seo?.canonical,
    seo?.ogImage,
    seo?.ogType,
    seo?.noIndex,
    Array.isArray(seo?.keywords) ? seo.keywords.join("|") : seo?.keywords,
    seo?.schemas ? JSON.stringify(seo.schemas) : "",
  ]);
}
