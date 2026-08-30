import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { usePageSeo } from "@/hooks/usePageSeo";
import { fetchSeoDistricts, type SeoDistrict } from "@/lib/seoApi";
import { SEO_DISTRICTS } from "@/data/seoDistricts";
import { SEO_PAGE_BY_PATH } from "@/pages/seo/seoPageContent";

export default function BiharDistrictsPage() {
  const meta = SEO_PAGE_BY_PATH.get("/bihar")!;
  const [districts, setDistricts] = useState<SeoDistrict[]>(
    SEO_DISTRICTS.map((d) => ({ name: d.name, slug: d.slug, aTier: d.aTier })),
  );

  usePageSeo({
    title: meta.title,
    description: meta.description,
    canonical: "/bihar",
  });

  useEffect(() => {
    (async () => {
      const d = await fetchSeoDistricts();
      if (d?.length) setDistricts(d);
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

      <div className="container mx-auto px-4 lg:px-8 max-w-5xl py-12">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {districts.map((district) => (
            <li key={district.slug}>
              <Link
                to={`/${district.slug}`}
                className="block rounded-lg border border-border/70 px-4 py-3 hover:border-primary hover:text-primary transition-colors"
              >
                <span className="font-medium">{district.name}</span>
                {district.aTier ? (
                  <span className="ml-2 text-xs text-muted-foreground">VF 6 / VF 7 pages</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
