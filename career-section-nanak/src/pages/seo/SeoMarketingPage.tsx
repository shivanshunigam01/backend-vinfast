import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/hooks/usePageSeo";
import { SEO_ARTICLES, SEO_PAGE_BY_PATH } from "@/pages/seo/seoPageContent";
import NotFound from "@/pages/NotFound";

type Props = { path?: string };

export default function SeoMarketingPage({ path }: Props) {
  const location = useLocation();
  const articlePath = path || location.pathname;
  const article = SEO_PAGE_BY_PATH.get(articlePath);

  usePageSeo(
    article
      ? {
          title: article.title,
          description: article.description,
          keywords: article.keywords,
          canonical: article.path,
        }
      : null,
  );

  if (!article) return <NotFound />;

  const relatedBlogs =
    article.path === "/blogs"
      ? SEO_ARTICLES.filter((a) => a.path.startsWith("/blogs/"))
      : [];

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <section className="pt-24 lg:pt-32 pb-10 bg-gradient-to-b from-secondary/40 to-background">
        <div className="container mx-auto px-4 lg:px-8 max-w-4xl">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display font-bold text-3xl md:text-5xl leading-tight mb-4"
          >
            {article.h1}
          </motion.h1>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">{article.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/test-drive">Book test drive</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/compare">Compare models</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 lg:px-8 max-w-4xl py-12 space-y-10">
        {article.sections.map((section) => (
          <article key={section.heading}>
            <h2 className="font-display font-semibold text-2xl mb-3">{section.heading}</h2>
            <p className="text-foreground/80 leading-relaxed whitespace-pre-line">{section.body}</p>
          </article>
        ))}

        {relatedBlogs.length > 0 ? (
          <section>
            <h2 className="font-display font-semibold text-2xl mb-4">All articles</h2>
            <ul className="space-y-3">
              {relatedBlogs.map((b) => (
                <li key={b.path}>
                  <Link className="text-primary hover:underline underline-offset-2" to={b.path}>
                    {b.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {article.path.startsWith("/compare/") ? (
          <p className="text-sm text-muted-foreground">
            Want a live side-by-side of VinFast variants?{" "}
            <Link to="/compare" className="text-primary hover:underline">
              Open the compare tool
            </Link>
            .
          </p>
        ) : null}
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
