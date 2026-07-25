import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { usePublicSite } from "@/context/PublicSiteContext";

const PaymentRefundPolicyPage = () => {
  const { dealer } = usePublicSite();

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <main className="pt-24 pb-16 lg:pt-32 lg:pb-24">
        <section className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
            Legal
          </p>
          <h1 className="font-display font-bold text-3xl md:text-4xl mb-6">Payment &amp; Refund Policy</h1>
          <div className="text-muted-foreground text-sm leading-relaxed space-y-4">
            <p>
              Payments made through this website (including pre-booking enquiries or related requests)
              are processed for {dealer.dealerName}. Exact payable amounts, methods, and confirmation
              details are finalized by the dealership team.
            </p>
            <p>
              Any booking amount, advance, or offer-related payment is subject to applicable dealership
              terms, vehicle availability, and official VinFast guidelines at the time of confirmation.
            </p>
            <p>
              Refund requests, if applicable, are reviewed as per dealership policy and the specific
              booking terms shared with you. Processing timelines can vary depending on bank/payment
              partner cycles.
            </p>
            <p>
              For payment support, cancellation, or refund status, please contact {dealer.dealerName}
              using the phone/email details listed in the footer.
            </p>
          </div>
        </section>
      </main>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default PaymentRefundPolicyPage;
