import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { usePageSeo } from "@/hooks/usePageSeo";
import { fetchSeoDistricts, fetchSeoModels, type SeoDistrict, type SeoModel } from "@/lib/seoApi";
import { SEO_PAGE_BY_PATH } from "@/pages/seo/seoPageContent";

const FALLBACK_DISTRICTS: SeoDistrict[] = [
  { name: "Patna", slug: "patna" },
  { name: "Gaya", slug: "gaya" },
  { name: "Muzaffarpur", slug: "muzaffarpur" },
  { name: "Bhagalpur", slug: "bhagalpur" },
  { name: "Darbhanga", slug: "darbhanga" },
  { name: "Nalanda", slug: "nalanda" },
];

const FALLBACK_MODELS: SeoModel[] = [
  { key: "vf6", slug: "vinfast-vf6", name: "VinFast VF6", shortName: "VF6", bodyType: "Electric SUV", seats: 5, variants: [] },
  { key: "vf7", slug: "vinfast-vf7", name: "VinFast VF7", shortName: "VF7", bodyType: "Premium Electric SUV", seats: 5, variants: [] },
  { key: "mpv7", slug: "vinfast-mpv7", name: "VinFast VF MPV7", shortName: "MPV7", bodyType: "Electric MPV", seats: 7, variants: [] },
  { key: "limo-green", slug: "vinfast-limo-green", name: "VinFast Limo Green", shortName: "Limo Green", bodyType: "Electric MPV", seats: 7, variants: [] },
];

export default function BiharDistrictsPage() {
  const meta = SEO_PAGE_BY_PATH.get("/bihar")!;
  const [districts, setDistricts] = useState<SeoDistrict[]>(FALLBACK_DISTRICTS);
  const [models, setModels] = useState<SeoModel[]>(FALLBACK_MODELS);

  usePageSeo({
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    canonical: "/bihar",
  });

  useEffect(() => {
    (async () => {
      const [d, m] = await Promise.all([fetchSeoDistricts(), fetchSeoModels()]);
      if (d?.length) setDistricts(d);
      if (m?.length) setModels(m);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <section className="pt-24 lg:pt-32 pb-10 bg-gradient-to-b from-secondary/40 to-background">
        <div className="container mx-auto px-4 lg:px-8 max-w-5xl">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display font-bold text-3xl md:text-5xl leading-tight mb-4"
          >
            {meta.h1}
          </motion.h1>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-3xl">{meta.intro}</p>
        </div>
      </section>

      <div className="container mx-auto px-4 lg:px-8 max-w-5xl py-12 space-y-12">
        {districts.map((district) => (
          <section key={district.slug}>
            <h2 className="font-display font-semibold text-xl mb-3">{district.name}</h2>
            <div className="flex flex-wrap gap-2">
              {models.map((model) => (
                <Link
                  key={`${district.slug}-${model.slug}`}
                  to={`/${district.slug}/${model.slug}`}
                  className="text-sm px-3 py-1.5 rounded-md border border-border/70 hover:border-primary hover:text-primary transition-colors"
                >
                  {model.shortName}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
