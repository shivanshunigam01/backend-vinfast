import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hasApi } from "@/lib/apiConfig";
import { publicGet } from "@/lib/api";

export type DealerInfo = {
  dealerName: string;
  /** Vehicle brand from Settings (e.g. VinFast) */
  brand: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  showroomHours: string;
  gstNo?: string;
  /** Optional iframe HTML or embed URL from admin Settings */
  mapEmbedUrl?: string;
};

export type SiteConfigPublic = {
  whatsappNumber: string;
  phoneNumber: string;
  heroTagline: string;
  leadStripTitle: string;
  leadStripSubtitle: string;
  vf7Price: string;
  vf6Price: string;
  mpv7Price: string;
  limoGreenPrice: string;
  vf7Range: string;
  vf6Range: string;
  /** Set by API from env when WhatsApp OTP is enabled on the server. */
  features?: { whatsappOtp?: boolean };
};

const DEFAULT_DEALER: DealerInfo = {
  dealerName: "Patliputra VinFast",
  brand: "VinFast",
  phone: "+91 9231445060",
  whatsapp: "919231445060",
  email: "info@patliputravinfast.com",
  address: "Near Deedarganj Check Post, NH-30, Patna, Bihar - 800009",
  showroomHours: "10 AM – 8 PM, Mon–Sat",
  gstNo: "",
};

const DEFAULT_SITE: SiteConfigPublic = {
  whatsappNumber: "919231445060",
  phoneNumber: "+91 9231445060",
  heroTagline: "Bihar's First VinFast Dealer",
  leadStripTitle: "Ready to Go Electric?",
  leadStripSubtitle: "Leave your details and our EV advisor will reach out in 10 minutes.",
  vf7Price: "₹22.99L*",
  vf6Price: "₹18.19L*",
  mpv7Price: "₹24.49L*",
  limoGreenPrice: "₹22.99L*",
  vf7Range: "532 km",
  vf6Range: "468 km",
  features: { whatsappOtp: false },
};

type PublicSiteContextValue = {
  dealer: DealerInfo;
  siteConfig: SiteConfigPublic;
  /** True after an API attempt finished (success or fail). */
  cmsTried: boolean;
  /** Re-fetch dealer + site config from the API (e.g. after tab focus). */
  refreshPublicSite: () => Promise<void>;
};

const PublicSiteContext = createContext<PublicSiteContextValue | null>(null);

/** Use API value when non-empty; otherwise defaults (Mongo docs often omit keys). */
function coalesceStr(v: unknown, fallback: string): string {
  const s = v == null ? "" : String(v).trim();
  return s || fallback;
}

/** Normalize legacy dealer name variants from CMS for public display. */
function normalizeDealerName(name: string): string {
  return name
    .trim()
    .replace(/\bpatliputra\s+autos?\b/gi, "Patliputra VinFast")
    .replace(/\bpatliputraautos?\b/gi, "Patliputra VinFast");
}

function mergeDealer(doc: Record<string, unknown> | null): DealerInfo {
  if (!doc) return DEFAULT_DEALER;
  const mapRaw = doc.mapEmbedUrl;
  const gst = doc.gstNo != null ? String(doc.gstNo).trim() : "";
  return {
    dealerName: normalizeDealerName(coalesceStr(doc.dealerName, DEFAULT_DEALER.dealerName)),
    brand: coalesceStr(doc.brand, DEFAULT_DEALER.brand),
    phone: coalesceStr(doc.phone, DEFAULT_DEALER.phone),
    whatsapp: coalesceStr(doc.whatsapp, DEFAULT_DEALER.whatsapp),
    email: coalesceStr(doc.email, DEFAULT_DEALER.email),
    address: coalesceStr(doc.address, DEFAULT_DEALER.address),
    showroomHours: coalesceStr(doc.showroomHours, DEFAULT_DEALER.showroomHours),
    gstNo: gst || DEFAULT_DEALER.gstNo,
    mapEmbedUrl: mapRaw != null && String(mapRaw).trim() ? String(mapRaw).trim() : undefined,
  };
}

function mergeSite(doc: Record<string, unknown> | null): SiteConfigPublic {
  if (!doc) return DEFAULT_SITE;
  const feat = doc.features;
  const featObj = feat && typeof feat === "object" ? (feat as Record<string, unknown>) : null;
  return {
    whatsappNumber: coalesceStr(doc.whatsappNumber, DEFAULT_SITE.whatsappNumber),
    phoneNumber: coalesceStr(doc.phoneNumber, DEFAULT_SITE.phoneNumber),
    heroTagline: coalesceStr(doc.heroTagline, DEFAULT_SITE.heroTagline),
    leadStripTitle: coalesceStr(doc.leadStripTitle, DEFAULT_SITE.leadStripTitle),
    leadStripSubtitle: coalesceStr(doc.leadStripSubtitle, DEFAULT_SITE.leadStripSubtitle),
    vf7Price: coalesceStr(doc.vf7Price, DEFAULT_SITE.vf7Price),
    vf6Price: coalesceStr(doc.vf6Price, DEFAULT_SITE.vf6Price),
    mpv7Price: coalesceStr(doc.mpv7Price, DEFAULT_SITE.mpv7Price),
    limoGreenPrice: coalesceStr(doc.limoGreenPrice, DEFAULT_SITE.limoGreenPrice),
    vf7Range: coalesceStr(doc.vf7Range, DEFAULT_SITE.vf7Range),
    vf6Range: coalesceStr(doc.vf6Range, DEFAULT_SITE.vf6Range),
    features: {
      whatsappOtp: Boolean(featObj?.whatsappOtp),
    },
  };
}

export function PublicSiteProvider({ children }: { children: ReactNode }) {
  const [dealer, setDealer] = useState<DealerInfo>(DEFAULT_DEALER);
  const [siteConfig, setSiteConfig] = useState<SiteConfigPublic>(DEFAULT_SITE);
  const [cmsTried, setCmsTried] = useState(false);

  const refreshPublicSite = useCallback(async () => {
    if (!hasApi()) return;
    const [dRaw, sRaw] = await Promise.all([
      publicGet<Record<string, unknown>>("/public/dealer-settings"),
      publicGet<Record<string, unknown>>("/public/site-config"),
    ]);
    setDealer(mergeDealer(dRaw));
    setSiteConfig(mergeSite(sRaw));
  }, []);

  useEffect(() => {
    if (!hasApi()) {
      setCmsTried(true);
      return;
    }
    let cancelled = false;
    (async () => {
      await refreshPublicSite();
      if (!cancelled) setCmsTried(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPublicSite]);

  useEffect(() => {
    if (!hasApi()) return;
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshPublicSite();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshPublicSite]);

  const value = useMemo(
    () => ({ dealer, siteConfig, cmsTried, refreshPublicSite }),
    [dealer, siteConfig, cmsTried, refreshPublicSite],
  );

  return <PublicSiteContext.Provider value={value}>{children}</PublicSiteContext.Provider>;
}

export function usePublicSite(): PublicSiteContextValue {
  const ctx = useContext(PublicSiteContext);
  if (!ctx) {
    return {
      dealer: { ...DEFAULT_DEALER },
      siteConfig: { ...DEFAULT_SITE },
      cmsTried: true,
      refreshPublicSite: async () => {},
    };
  }
  return ctx;
}
