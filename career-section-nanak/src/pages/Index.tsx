import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import QuickActionBar from "@/components/QuickActionBar";
import ModelDiscovery from "@/components/ModelDiscovery";
import WhyVinFast from "@/components/WhyVinFast";
import VirtualShowroom from "@/components/VirtualShowroom";
import OwnershipSection from "@/components/OwnershipSection";
import OffersSection from "@/components/OffersSection";
import LeadCaptureStrip from "@/components/LeadCaptureStrip";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { usePageSeo } from "@/hooks/usePageSeo";

const Index = () => {
  usePageSeo({
    title: "Patliputra VinFast — Authorized VinFast Dealer in Bihar | VF 6 & VF 7 Electric SUVs",
    description:
      "Explore VinFast electric vehicles with Patliputra VinFast. Book your test drive today.",
    keywords:
      "VinFast Bihar, VinFast Patna, VF 7 price Bihar, VF 6 price Patna, electric SUV Bihar, Patliputra VinFast, VinFast dealer Bihar, EV test drive Patna",
    canonical: "/",
  });

  return (
    <div className="min-h-screen w-full max-w-[100%] overflow-x-clip bg-background pb-36 lg:pb-0">
      <Navbar />
      <HeroSection />
      <QuickActionBar />
      <ModelDiscovery />
      <WhyVinFast />
      <VirtualShowroom />
      <OwnershipSection />
      <OffersSection />
      <LeadCaptureStrip />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default Index;
