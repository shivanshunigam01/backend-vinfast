import { publicGet } from "@/lib/api";

export type GlobalSeo = {
  siteUrl: string;
  defaultMetaTitle: string;
  defaultMetaDescription: string;
  googleSiteVerification: string | null;
  schemas: unknown[];
};

export type SeoDistrict = { name: string; slug: string; headquarters?: string; aTier?: boolean };

export type SeoModel = {
  key: string;
  slug: string;
  name: string;
  shortName: string;
  bodyType: string;
  seats: number;
  variants: string[];
};

export type DistrictPageFaq = { question: string; answer: string };
export type DistrictPageSection = { heading?: string; body?: string };

export type DistrictModelRow = {
  key: string;
  slug: string;
  name: string;
  shortName: string;
  bodyType: string;
  seats: number;
  variants: string[];
  price: string | null;
  range: string | null;
};

export type DistrictLanding = {
  pageType?: "hub" | "model-a";
  districtSlug: string;
  districtName: string;
  modelKey: string;
  modelName: string;
  path: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  answerBlock?: string;
  methodology?: string;
  sections: DistrictPageSection[];
  keywords?: string[];
  faqs: DistrictPageFaq[];
  modelsTable?: DistrictModelRow[];
  lastUpdated?: string;
  canonicalUrl: string;
  schemas: unknown[];
};

export type DistrictPageListItem = {
  path: string;
  districtSlug: string;
  districtName: string;
  modelKey: string;
  modelName: string;
  metaTitle: string;
  pageType?: string;
};

export function fetchGlobalSeo() {
  return publicGet<GlobalSeo>("/public/seo/global");
}

export function fetchSeoDistricts() {
  return publicGet<SeoDistrict[]>("/public/seo/districts");
}

export function fetchSeoModels() {
  return publicGet<SeoModel[]>("/public/seo/models");
}

export function fetchDistrictPageList(params?: { district?: string; model?: string; pageType?: string }) {
  const q = new URLSearchParams();
  if (params?.district) q.set("district", params.district);
  if (params?.model) q.set("model", params.model);
  if (params?.pageType) q.set("pageType", params.pageType);
  const qs = q.toString();
  return publicGet<DistrictPageListItem[]>(`/public/seo/district-pages${qs ? `?${qs}` : ""}`);
}

export function fetchDistrictHub(districtSlug: string) {
  return publicGet<DistrictLanding>(
    `/public/seo/district-pages/${encodeURIComponent(districtSlug)}`,
  );
}

export function fetchDistrictLanding(districtSlug: string, modelSlug: string) {
  return publicGet<DistrictLanding>(
    `/public/seo/district-pages/${encodeURIComponent(districtSlug)}/${encodeURIComponent(modelSlug)}`,
  );
}
