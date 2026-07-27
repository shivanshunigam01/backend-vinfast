import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { usePublicSite } from "@/context/PublicSiteContext";

const PrivacyPolicyPage = () => {
  const { dealer } = usePublicSite();

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <main className="pt-24 pb-16 lg:pt-32 lg:pb-24">
        <section className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
            Legal
          </p>
          <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">Privacy Policy</h1>
          <div className="text-muted-foreground text-sm leading-relaxed space-y-4">
            <p>
              {dealer.dealerName} respects your privacy. Information you submit through this website
              (for example test drive, booking, or contact forms) is used only to respond to your enquiry
              and improve our services, unless you agree otherwise.
            </p>
            <p>
              We do not sell your personal data. Technical information such as browser/device details may
              be processed as needed to operate and secure this website.
            </p>
            <p>
              For any privacy-related query, please contact us using the phone/email details listed in the
              footer.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default PrivacyPolicyPage;
