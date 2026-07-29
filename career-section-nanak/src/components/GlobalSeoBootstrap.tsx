import { useEffect } from "react";
import { fetchGlobalSeo } from "@/lib/seoApi";
import { SITE_URL } from "@/lib/seo";

/**
 * Loads site-wide SEO once: Google verification meta + Organization JSON-LD fallbacks.
 * Per-route pages still override title/description via usePageSeo.
 */
export default function GlobalSeoBootstrap() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const global = await fetchGlobalSeo();
      if (cancelled || !global) return;

      if (global.googleSiteVerification) {
        let el = document.head.querySelector('meta[name="google-site-verification"]');
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute("name", "google-site-verification");
          document.head.appendChild(el);
        }
        el.setAttribute("content", global.googleSiteVerification);
      }

      // Keep a stable organization schema node for pages that don't inject their own full set.
      const id = "global-seo-org-jsonld";
      let script = document.getElementById(id) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(global.schemas || []);

      // Ensure OG URL base aligns with API site URL when available.
      if (global.siteUrl && !document.querySelector('meta[property="og:site_name"]')) {
        const siteName = document.createElement("meta");
        siteName.setAttribute("property", "og:site_name");
        siteName.setAttribute("content", "Patliputra VinFast");
        document.head.appendChild(siteName);
      }

      void SITE_URL;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
