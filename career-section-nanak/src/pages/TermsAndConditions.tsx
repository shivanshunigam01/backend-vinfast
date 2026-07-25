import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { usePublicSite } from "@/context/PublicSiteContext";

const TermsAndConditionsPage = () => {
  const { dealer } = usePublicSite();

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <main className="pt-24 pb-16 lg:pt-32 lg:pb-24">
        <section className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
            Legal
          </p>
          <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">Terms and Conditions</h1>
          <div className="text-muted-foreground text-sm leading-relaxed space-y-4">
            <p>
              By accessing and using this website, you agree to the terms and conditions of {dealer.dealerName}.
              If you do not agree, please discontinue use of this site.
            </p>
            <p>
              Vehicle features, specifications, colours, pricing, and offers shown on this website are indicative
              and may be changed without prior notice. Final details are confirmed at the dealership.
            </p>
            <p>
              Enquiry or booking requests submitted through this site do not create a binding sale agreement.
              Any purchase is subject to official dealer documentation and applicable policies.
            </p>
            <p>
              This website content is for informational purposes only and is governed by applicable laws of India.
              All trademarks, logos, and brand assets belong to their respective owners.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default TermsAndConditionsPage;
