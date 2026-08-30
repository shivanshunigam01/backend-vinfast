import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/hooks/usePageSeo";
import { fetchDistrictHub, type DistrictLanding } from "@/lib/seoApi";
import { buildCtaPath } from "@/lib/seoAttribution";
import { getSeoDistrict, PATNA_SHOWROOM_LINE } from "@/data/seoDistricts";
import NotFound from "@/pages/NotFound";

export default function DistrictHubPage() {
  const { districtSlug = "" } = useParams();
  const meta = getSeoDistrict(districtSlug);
  const [page, setPage] = useState<DistrictLanding | null | undefined>(meta ? undefined : null);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    setPage(undefined);
    (async () => {
      const data = await fetchDistrictHub(districtSlug);
      if (!cancelled) setPage(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [districtSlug, meta]);

  const display: DistrictLanding | null = page
    ? page
    : meta
      ? {
          districtSlug: meta.slug,
          districtName: meta.name,
          modelKey: "hub",
          modelName: "VinFast lineup",
          path: `/${meta.slug}`,
          metaTitle: `VinFast Electric Cars in ${meta.name} | Price & Test Drive Assistance`,
          metaDescription: `VinFast price, EMI and test drive assistance for ${meta.name} via Patliputra VinFast, Patna.`,
          h1: `VinFast Electric Cars in ${meta.name} - Price, Test Drive & Offers`,
          intro: `Patliputra VinFast is Bihar’s authorised VinFast dealer. Customers in ${meta.name} get VF 6, VF 7, MPV 7 and Limo Green assistance from the Patna showroom at Paijawa — we do not operate a separate ${meta.name} branch. Book online and the team confirms the next step on WhatsApp.`,
          answerBlock: `Patliputra VinFast is Bihar’s authorised VinFast dealer. Customers in ${meta.name} get VF 6, VF 7, MPV 7 and Limo Green assistance from the Patna showroom at Paijawa — we do not operate a separate ${meta.name} branch. Book online and the team confirms the next step on WhatsApp.`,
          methodology:
            "About this information: prices and range come from the live model master when the API is available. Ex-showroom figures can change.",
          sections: [
            {
              heading: `How we serve ${meta.name}`,
              body: `Sales, test-drive and finance assistance for ${meta.name}. Nearest real facility: ${PATNA_SHOWROOM_LINE}`,
            },
            {
              heading: `Local use`,
              body: `Typical ${meta.name} use includes ${meta.useCase}. Charge overnight at home when possible.`,
            },
          ],
          faqs: [],
          canonicalUrl: `/${meta.slug}`,
          schemas: [],
        }
      : null;

  usePageSeo(
    display
      ? {
          title: display.metaTitle,
          description: display.metaDescription,
          canonical: display.canonicalUrl || display.path,
          schemas: display.schemas,
        }
      : null,
  );

  if (!meta) return <NotFound />;
  if (page === undefined && !display) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (!display) return <NotFound />;

  const pagePath = display.path || `/${districtSlug}`;
  const cta = (base: string, intent: string, model?: string) =>
    buildCtaPath(base, { district: districtSlug, model, intent, page: pagePath });

  const updated = display.lastUpdated
    ? new Date(display.lastUpdated).toLocaleDateString("en-IN")
    : new Date().toLocaleDateString("en-IN");

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <section className="pt-24 lg:pt-32 pb-10 bg-gradient-to-b from-secondary/40 to-background">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <p className="text-sm uppercase tracking-[0.2em] text-primary font-semibold mb-3">
            {display.districtName} · Bihar assistance
          </p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display font-bold text-3xl md:text-5xl leading-tight mb-4"
          >
            {display.h1}
          </motion.h1>
          <p className="text-foreground text-base md:text-lg leading-relaxed">
            {display.answerBlock || display.intro}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to={cta("/test-drive", "test-drive")}>Book test drive</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={cta("/book-now", "get-price")}>Get price</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to={cta("/emi-calculator", "emi")}>EMI / finance</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={cta("/book-now", "exchange")}>Exchange</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 lg:px-8 max-w-4xl py-12 space-y-10">
        {(display.modelsTable || []).length > 0 ? (
          <section>
            <h2 className="font-display font-semibold text-2xl mb-4">Current lineup</h2>
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-left">
                  <tr>
                    <th className="p-3">Model</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Ex-showroom</th>
                    <th className="p-3">Certified range</th>
                    <th className="p-3"> </th>
                  </tr>
                </thead>
                <tbody>
                  {display.modelsTable!.map((row) => (
                    <tr key={row.key} className="border-t border-border/50">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3">{row.bodyType}</td>
                      <td className="p-3">{row.price || "Ask for live price"}</td>
                      <td className="p-3">{row.range || "See model page"}</td>
                      <td className="p-3">
                        <Link
                          className="text-primary underline-offset-2 hover:underline"
                          to={cta("/test-drive", "test-drive", row.slug)}
                        >
                          Test drive
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {(display.sections || []).map((section) => (
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

        {(display.faqs || []).length > 0 ? (
          <section>
            <h2 className="font-display font-semibold text-2xl mb-6">
              FAQs — VinFast in {display.districtName}
            </h2>
            <div className="space-y-4">
              {display.faqs.map((faq) => (
                <details key={faq.question} className="rounded-lg border border-border/60 p-4 bg-card/40">
                  <summary className="font-medium cursor-pointer">{faq.question}</summary>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <p className="text-sm text-muted-foreground">{display.methodology}</p>
        <p className="text-sm text-muted-foreground">Last updated {updated}.</p>
        <p className="text-sm text-muted-foreground">
          <Link className="text-primary underline-offset-2 hover:underline" to="/bihar">
            All Bihar district hubs
          </Link>
        </p>
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
