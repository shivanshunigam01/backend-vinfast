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
    title: "VinFast Cars in Bihar | VF 6, VF 7, MPV 7 & Limo Green | Patliputra VinFast",
    description:
      "Authorised VinFast dealer in Bihar. Explore VF 6, VF 7, MPV 7 and Limo Green — price, range, EMI and test drive assistance from Patliputra VinFast, Patna.",
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
