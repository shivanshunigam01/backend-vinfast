import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { usePublicSite } from "@/context/PublicSiteContext";

const TermsOfServicePage = () => {
  const { dealer } = usePublicSite();

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <main className="pt-24 pb-16 lg:pt-32 lg:pb-24">
        <section className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
            Legal
          </p>
          <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">Terms of Service</h1>
          <div className="text-muted-foreground text-sm leading-relaxed space-y-4">
            <p>
              This website is provided for general information about {dealer.brand} vehicles and{" "}
              {dealer.dealerName}. Specifications, features, colours, and pricing may change at any time.
              Offers and on-road pricing are confirmed at the dealership.
            </p>
            <p>
              Content on this website does not constitute a binding sale contract until official booking and
              dealership documentation are completed.
            </p>
            <p>
              Use of this website is subject to applicable laws in India. Brand names, trademarks, and
              images belong to their respective owners.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default TermsOfServicePage;
