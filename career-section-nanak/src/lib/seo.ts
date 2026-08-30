/** Canonical public site origin used in meta, OG, and JSON-LD. */
export const SITE_URL = "https://patliputravinfast.in";

export const DEFAULT_OG_IMAGE = `${SITE_URL}/preview.jpg`;

export type SeoPayload = {
  title: string;
  description: string;
  /** Path starting with `/`, or absolute URL */
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
  schemas?: unknown[];
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function absoluteCanonical(canonical?: string): string {
  if (!canonical) return `${SITE_URL}/`;
  if (canonical.startsWith("http")) return canonical;
  return `${SITE_URL}${canonical.startsWith("/") ? canonical : `/${canonical}`}`;
}

const SCHEMA_ATTR = "data-seo-jsonld";

function clearSchemas() {
  document.head.querySelectorAll(`script[${SCHEMA_ATTR}]`).forEach((n) => n.remove());
}

function injectSchemas(schemas?: unknown[]) {
  clearSchemas();
  if (!schemas?.length) return;
  for (const schema of schemas) {
    if (!schema) continue;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute(SCHEMA_ATTR, "true");
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
  }
}

/** Apply document head SEO for the current route (SPA). */
export function applyPageSeo(seo: SeoPayload) {
  const title = seo.title.trim();
  const description = seo.description.trim();
  const canonical = absoluteCanonical(seo.canonical);
  const ogImage = seo.ogImage || DEFAULT_OG_IMAGE;

  document.title = title;
  upsertMeta("name", "description", description);
  document.head.querySelector('meta[name="keywords"]')?.remove();
  upsertLink("canonical", canonical);

  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", canonical);
  upsertMeta("property", "og:image", ogImage);
  upsertMeta("property", "og:type", seo.ogType || "website");

  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", ogImage);

  if (seo.noIndex) {
    upsertMeta("name", "robots", "noindex, nofollow");
  } else {
    upsertMeta("name", "robots", "index, follow");
  }

  injectSchemas(seo.schemas);
}

export function clearDynamicSchemas() {
  clearSchemas();
}
