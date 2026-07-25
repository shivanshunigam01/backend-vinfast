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

const Index = () => {
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
