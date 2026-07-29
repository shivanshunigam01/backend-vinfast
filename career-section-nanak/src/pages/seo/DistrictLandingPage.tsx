import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/hooks/usePageSeo";
import { fetchDistrictLanding, type DistrictLanding } from "@/lib/seoApi";
import NotFound from "@/pages/NotFound";

const modelKeyToRoute: Record<string, string> = {
  vf6: "/models/vf6",
  vf7: "/models/vf7",
  mpv7: "/models/mpv7",
  "limo-green": "/models/limo-green",
};

/** First URL segment reserved for app routes — never treat as a district. */
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
  const [page, setPage] = useState<DistrictLanding | null | undefined>(reserved ? null : undefined);

  useEffect(() => {
    if (reserved) return;
    let cancelled = false;
    setPage(undefined);
    (async () => {
      const data = await fetchDistrictLanding(districtSlug, modelSlug);
      if (!cancelled) setPage(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [districtSlug, modelSlug, reserved]);

  usePageSeo(
    page
      ? {
          title: page.metaTitle,
          description: page.metaDescription,
          keywords: page.keywords,
          canonical: page.canonicalUrl || page.path,
          schemas: page.schemas,
        }
      : null,
  );

  if (page === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!page) return <NotFound />;

  const modelPath = modelKeyToRoute[page.modelKey] || "/models/vf6";

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <section className="pt-24 lg:pt-32 pb-10 bg-gradient-to-b from-secondary/40 to-background">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
            {page.districtName} · Bihar
          </p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display font-bold text-3xl md:text-5xl leading-tight mb-4"
          >
            {page.h1}
          </motion.h1>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">{page.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/test-drive">Book test drive</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={modelPath}>View {page.modelName}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/book-now">Book now</Link>
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

        <p className="text-sm text-muted-foreground">
          Serving customers from {page.districtName} at Patliputra VinFast, Patna.{" "}
          <Link className="text-primary underline-offset-2 hover:underline" to="/contact">
            Contact us
          </Link>{" "}
          or explore{" "}
          <Link className="text-primary underline-offset-2 hover:underline" to="/bihar">
            all Bihar district pages
          </Link>
          .
        </p>
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
