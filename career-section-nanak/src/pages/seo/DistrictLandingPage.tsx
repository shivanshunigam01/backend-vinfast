import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/hooks/usePageSeo";
import { fetchDistrictLanding, type DistrictLanding } from "@/lib/seoApi";
import { buildCtaPath } from "@/lib/seoAttribution";
import { getSeoDistrict, isATierCombo, PATNA_SHOWROOM_LINE } from "@/data/seoDistricts";
import NotFound from "@/pages/NotFound";

const modelKeyToRoute: Record<string, string> = {
  vf6: "/models/vf6",
  vf7: "/models/vf7",
  mpv7: "/models/mpv7",
  "limo-green": "/models/limo-green",
};

const RESERVED_DISTRICT_SEGMENTS = new Set([
  "admin",
  "staff",
  "customer",
  "models",
  "blogs",
  "compare",
  "api",
  "assets",
]);

export default function DistrictLandingPage() {
  const { districtSlug = "", modelSlug = "" } = useParams();
  const reserved = RESERVED_DISTRICT_SEGMENTS.has(districtSlug.toLowerCase());
  const known = Boolean(getSeoDistrict(districtSlug));
  const indexable = isATierCombo(districtSlug, modelSlug);
  const [page, setPage] = useState<DistrictLanding | null | undefined>(
    reserved || !known || !indexable ? null : undefined,
  );

  useEffect(() => {
    if (reserved || !known || !indexable) return;
    let cancelled = false;
    setPage(undefined);
    (async () => {
      const data = await fetchDistrictLanding(districtSlug, modelSlug);
      if (!cancelled) setPage(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [districtSlug, modelSlug, reserved, known, indexable]);

  usePageSeo(
    page
      ? {
          title: page.metaTitle,
          description: page.metaDescription,
          canonical: page.canonicalUrl || page.path,
          schemas: page.schemas,
        }
      : null,
  );

  if (reserved) return <NotFound />;
  if (known && !indexable) return <Navigate to={`/${districtSlug}`} replace />;
  if (!known) return <NotFound />;

  if (page === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!page) return <Navigate to={`/${districtSlug}`} replace />;

  const modelPath = modelKeyToRoute[page.modelKey] || "/models/vf6";
  const pagePath = page.path || `/${districtSlug}/${modelSlug}`;
  const cta = (base: string, intent: string) =>
    buildCtaPath(base, { district: districtSlug, model: modelSlug, intent, page: pagePath });
  const updated = page.lastUpdated
    ? new Date(page.lastUpdated).toLocaleDateString("en-IN")
    : new Date().toLocaleDateString("en-IN");

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <section className="pt-24 lg:pt-32 pb-10 bg-gradient-to-b from-secondary/40 to-background">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
            {page.districtName} · {page.modelName}
          </p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display font-bold text-3xl md:text-5xl leading-tight mb-4"
          >
            {page.h1}
          </motion.h1>
          <p className="text-foreground text-base md:text-lg leading-relaxed">
            {page.answerBlock || page.intro}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to={cta("/test-drive", "test-drive")}>Book test drive</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={modelPath}>View {page.modelName}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to={cta("/book-now", "get-price")}>Get price</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={cta("/emi-calculator", "emi")}>EMI</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 lg:px-8 max-w-4xl py-12 space-y-10">
        {(page.sections || []).map((section) => (
          <article key={section.heading || section.body}>
            {section.heading ? (
              <h2 className="font-display font-semibold text-2xl mb-3">{section.heading}</h2>
            ) : null}
            {section.body ? (
              <p className="text-foreground/80 leading-relaxed whitespace-pre-line">{section.body}</p>
            ) : null}
          </article>
        ))}

        <section>
          <h2 className="font-display font-semibold text-2xl mb-3">Nearest real showroom</h2>
          <p className="text-foreground/80 leading-relaxed">{PATNA_SHOWROOM_LINE}</p>
        </section>

        {(page.faqs || []).length > 0 ? (
          <section>
            <h2 className="font-display font-semibold text-2xl mb-6">
              FAQs — {page.modelName} in {page.districtName}
            </h2>
            <div className="space-y-4">
              {page.faqs.map((faq) => (
                <details key={faq.question} className="rounded-lg border border-border/60 p-4 bg-card/40">
                  <summary className="font-medium cursor-pointer">{faq.question}</summary>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <p className="text-sm text-muted-foreground">{page.methodology}</p>
        <p className="text-sm text-muted-foreground">Last updated {updated}.</p>
        <p className="text-sm text-muted-foreground">
          Serving {page.districtName} from Patliputra VinFast, Patna.{" "}
          <Link className="text-primary underline-offset-2 hover:underline" to={`/${districtSlug}`}>
            {page.districtName} hub
          </Link>{" "}
          ·{" "}
          <Link className="text-primary underline-offset-2 hover:underline" to="/bihar">
            all districts
          </Link>
        </p>
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
