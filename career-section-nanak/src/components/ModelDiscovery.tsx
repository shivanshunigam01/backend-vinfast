import { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Battery, Gauge, Shield, Users, Zap } from "lucide-react";
import vf7FrontHero from "@/assets/vf7-model-discovery-upload.png";
import vf6DiscoveryHero from "@/assets/vf6-model-discovery-upload.png";
import mpv7Card from "@/assets/mpv7-gallery/mpv7-new.png";
import limoGreenCard from "@/assets/limo-green/modal-car.webp";
import { usePublicSite } from "@/context/PublicSiteContext";
import { hasApi } from "@/lib/apiConfig";
import { publicGet } from "@/lib/api";
import { useRefetchWhenVisible } from "@/hooks/useRefetchWhenVisible";

type Spec = { icon: typeof Battery | typeof Users; label: string; value: string };

type ModelCard = {
  name: string;
  tagline: string;
  price: string;
  image: string;
  href: string;
  specs: Spec[];
};

const BASE_MODELS: Omit<ModelCard, "price">[] = [
  {
    name: "VF 7",
    tagline: "Bold. Intelligent. Unstoppable.",
    image: vf7FrontHero,
    href: "/models/vf7",
    specs: [
      { icon: Battery, label: "Battery", value: "70 kWh" },
      { icon: Gauge, label: "Range", value: "532 km" },
      { icon: Zap, label: "0–100", value: "5.8s" },
      { icon: Shield, label: "Safety", value: "5-Star" },
    ],
  },
  {
    name: "VF 6",
    tagline: "Compact. Smart. Electrifying.",
    image: vf6DiscoveryHero,
    href: "/models/vf6",
    specs: [
      { icon: Battery, label: "Battery", value: "59.6 kWh" },
      { icon: Gauge, label: "Range", value: "468 km" },
      { icon: Zap, label: "0–100", value: "10.4s" },
      { icon: Shield, label: "Safety", value: "5-Star" },
    ],
  },
  {
    name: "VF MPV 7",
    tagline: "Space. Seven seats. Electric.",
    image: mpv7Card,
    href: "/models/mpv7",
    specs: [
      { icon: Battery, label: "Battery", value: "60.13 kWh" },
      { icon: Gauge, label: "Range", value: "517 km (ARAI)" },
      { icon: Zap, label: "0–100", value: "<10 sec" },
      { icon: Users, label: "Seats", value: "7" },
    ],
  },
  {
    name: "Limo Green",
    tagline: "Built for your business.",
    image: limoGreenCard,
    href: "/models/limo-green",
    specs: [
      { icon: Battery, label: "Battery", value: "60.13 kWh" },
      { icon: Gauge, label: "Range", value: "450 km" },
      { icon: Zap, label: "Max. power", value: "150 kW" },
      { icon: Users, label: "Seats", value: "7" },
    ],
  },
];

function slugMatchesHref(href: string, slug: string): boolean {
  const s = slug.toLowerCase();
  if (href.includes("limo-green")) return s.includes("limo");
  if (href.includes("mpv7")) return s.includes("mpv7") || s.includes("mpv") || s === "vf-mpv-7" || s.endsWith("mpv7");
  if (href.includes("vf7")) return s.includes("vf7") || s === "vf-7" || s.endsWith("vf7");
  if (href.includes("vf6")) return s.includes("vf6") || s === "vf-6" || s.endsWith("vf6");
  return false;
}

function mergeModels(
  base: Omit<ModelCard, "price">[],
  apiList: Record<string, unknown>[] | null,
  site: {
    vf7Price: string;
    vf6Price: string;
    mpv7Price: string;
    limoGreenPrice: string;
    vf7Range: string;
    vf6Range: string;
    mpv7Range: string;
    limoGreenRange: string;
  },
): ModelCard[] {
  return base.map((m) => {
    const api = apiList?.find((p) => slugMatchesHref(m.href, String(p.slug ?? "")));
    const sitePrice = m.href.includes("vf7")
      ? site.vf7Price
      : m.href.includes("mpv7")
        ? site.mpv7Price
        : m.href.includes("limo-green")
          ? site.limoGreenPrice
          : site.vf6Price;
    const siteRange = m.href.includes("mpv7")
      ? site.mpv7Range
      : m.href.includes("limo-green")
        ? site.limoGreenRange
        : m.href.includes("vf7")
          ? site.vf7Range
          : site.vf6Range;
    const price = api?.priceFrom ? String(api.priceFrom) : sitePrice;
    const image =
      api?.heroImage && String(api.heroImage).trim() ? String(api.heroImage) : m.image;
    const tagline = api?.tagline ? String(api.tagline) : m.tagline;
    const displayName = api?.name
      ? String(api.name).replace(/^VinFast\s*/i, "").trim() || m.name
      : m.name;
    const specs = m.specs.map((spec) => {
      if (spec.label !== "Range") return spec;
      /** VF 6 / VF 7 cards use fixed headline MIDC from BASE_MODELS; ignore CMS vf6Range / vf7Range so wrong admin values (e.g. 381 / 431 km) never override. */
      if (m.href.includes("/models/vf6") || m.href.includes("/models/vf7")) return spec;
      /** MPV 7 / Limo Green show CMS ranges when set (Homepage → Display Prices & Stats). */
      return { ...spec, value: siteRange || spec.value };
    });
    return {
      ...m,
      name: displayName,
      tagline,
      price,
      image,
      specs,
    };
  });
}

const ModelDiscovery = () => {
  const { siteConfig } = usePublicSite();
  const [apiProducts, setApiProducts] = useState<Record<string, unknown>[] | null>(null);

  const loadProducts = useCallback(async () => {
    if (!hasApi()) return;
    const data = await publicGet<unknown[]>("/public/products");
    if (Array.isArray(data) && data.length > 0) {
      setApiProducts(data as Record<string, unknown>[]);
    }
  }, []);

  useEffect(() => {
    if (!hasApi()) return;
    void loadProducts();
  }, [loadProducts]);

  useRefetchWhenVisible(loadProducts, hasApi());

  const models = useMemo(
    () => mergeModels(BASE_MODELS, apiProducts, siteConfig),
    [apiProducts, siteConfig],
  );

  return (
    <section className="py-16 sm:py-24 lg:py-32 section-dark">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-16"
        >
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
            Our Models
          </p>
          <h2 className="font-display font-bold text-3xl md:text-5xl">
            Choose Your Electric Future
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8 lg:gap-10">
          {models.map((model, i) => (
            <motion.div
              key={model.href}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="group relative rounded-3xl overflow-hidden border border-foreground/[0.06] bg-card hover:border-foreground/[0.12] transition-all duration-500"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={model.image}
                  alt={`VinFast ${model.name}`}
                  className={`w-full h-full object-cover transition-[filter] duration-500 group-hover:brightness-[1.06]${
                    model.href.includes("mpv7") ? " object-[48%_top]" : ""
                  }`}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </div>
              <div className="p-5 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-display font-bold text-xl sm:text-2xl lg:text-3xl">
                      {model.href.includes("mpv7") ? model.name : `VinFast ${model.name}`}
                    </h3>
                    <p className="text-muted-foreground text-sm mt-1">{model.tagline}</p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">From</p>
                    <p className="font-display font-bold text-base sm:text-lg text-primary tabular-nums">{model.price}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6">
                  {model.specs.map((spec) => {
                    const Icon = spec.icon;
                    return (
                      <div
                        key={spec.label}
                        className="text-center p-2.5 sm:p-3 rounded-xl bg-background/50 border border-foreground/[0.04] min-w-0"
                      >
                        <Icon className="w-4 h-4 text-primary mx-auto mb-1 sm:mb-1.5 shrink-0" />
                        <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">{spec.label}</p>
                        <p className="text-xs sm:text-sm font-semibold font-display tabular-nums mt-0.5 break-words">{spec.value}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to={model.href} className="flex-1 min-w-0">
                    <Button variant="hero" className="w-full">
                      Explore {model.name}
                    </Button>
                  </Link>
                  <Link to="/compare" className="shrink-0">
                    <Button variant="outline" className="h-10 w-full sm:w-auto min-w-[7rem]">
                      Compare
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ModelDiscovery;
