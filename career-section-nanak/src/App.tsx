import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicSiteProvider } from "@/context/PublicSiteContext";
import { PublicRecaptchaProvider } from "@/context/PublicRecaptchaContext";
import Index from "./pages/Index";
import ModelVF7 from "./pages/ModelVF7";
import ModelVF6 from "./pages/ModelVF6";
import ModelMPV7 from "./pages/ModelMPV7";
import ModelLimoGreen from "./pages/ModelLimoGreen";
import TestDrive from "./pages/TestDrive";
import BookNow from "./pages/BookNow";
import EMICalculator from "./pages/EMICalculator";
import ChargingCalculator from "./pages/ChargingCalculator";
import RunningCostCalculator from "./pages/RunningCostCalculator";
import ComparePage from "./pages/Compare";
import AboutPage from "./pages/About";
import ContactPage from "./pages/Contact";
import PrivacyPolicyPage from "./pages/PrivacyPolicy";
import TermsOfServicePage from "./pages/TermsOfService";
import PaymentRefundPolicyPage from "./pages/PaymentRefundPolicy";
import TermsAndConditionsPage from "./pages/TermsAndConditions";
import PostDeliveryFeedback from "./pages/PostDeliveryFeedback";
import TestDriveFeedback from "./pages/TestDriveFeedback";
import NotFound from "./pages/NotFound";
import SeoMarketingPage from "./pages/seo/SeoMarketingPage";
import BiharDistrictsPage from "./pages/seo/BiharDistrictsPage";
import DistrictLandingPage from "./pages/seo/DistrictLandingPage";
import GlobalSeoBootstrap from "./components/GlobalSeoBootstrap";
import ScrollToTop from "./components/ScrollToTop";
import { COMPARE_SEO_PAGES, SEO_ARTICLES } from "./pages/seo/seoPageContent";
import AdminLogin from "./pages/admin/AdminLogin";
import StaffLogin from "./pages/staff/StaffLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminTestDrives from "./pages/admin/AdminTestDrives";
import AdminEnquiries from "./pages/admin/AdminEnquiries";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOffers from "./pages/admin/AdminOffers";
import AdminContent from "./pages/admin/AdminContent";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminHomepage from "./pages/admin/AdminHomepage";
import AdminMedia from "./pages/admin/AdminMedia";
import AdminMetaLeadCRM from "./pages/admin/AdminMetaLeadCRM";
import AdminTDBookings from "./pages/admin/AdminTDBookings";
import AdminTDDemoVehicles from "./pages/admin/AdminTDDemoVehicles";
import AdminVehicleModels from "./pages/admin/AdminVehicleModels";
import AdminVehicleStock from "./pages/admin/AdminVehicleStock";
import AdminTDReports from "./pages/admin/AdminTDReports";
import AdminTDSlotConfig from "./pages/admin/AdminTDSlotConfig";
import AdminTDUsers from "./pages/admin/AdminTDUsers";
import AdminTDRoles from "./pages/admin/AdminTDRoles";
import AdminFeedbackSubmissions from "./pages/admin/AdminFeedbackSubmissions";
import AdminCrmLeads from "./pages/admin/AdminCrmLeads";
import AdminLeadStages from "./pages/admin/AdminLeadStages";
import AdminPricing from "./pages/admin/AdminPricing";
import AdminDeliveryReports from "./pages/admin/AdminDeliveryReports";
import AdminExecutiveDashboard from "./pages/admin/AdminExecutiveDashboard";
import AdminTDMyBookings from "./pages/admin/AdminTDMyBookings";
import AdminTDLeads from "./pages/admin/AdminTDLeads";
import AdminTDLeadReports from "./pages/admin/AdminTDLeadReports";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerLayout from "./pages/customer/CustomerLayout";
import CustomerBookings from "./pages/customer/CustomerBookings";
import AdminCalendar from "./pages/admin/AdminCalendar";
import AdminRescheduleHistory from "./pages/admin/AdminRescheduleHistory";
import AdminFleetHealth from "./pages/admin/AdminFleetHealth";

const queryClient = new QueryClient();

const App = () => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = globalThis.matchMedia("(max-width: 768px), (prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <Sonner />
          <PublicRecaptchaProvider>
            <PublicSiteProvider>
              <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <ScrollToTop />
                  <GlobalSeoBootstrap />
                  <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/models/vf7" element={<ModelVF7 />} />
          <Route path="/models/vf6" element={<ModelVF6 />} />
          <Route path="/models/mpv7" element={<ModelMPV7 />} />
          <Route path="/models/limo-green" element={<ModelLimoGreen />} />
          <Route path="/vinfast-vf7" element={<ModelVF7 />} />
          <Route path="/vinfast-vf6" element={<ModelVF6 />} />
          <Route path="/vinfast-mpv7" element={<ModelMPV7 />} />
          <Route path="/vinfast-limo-green" element={<ModelLimoGreen />} />
          <Route path="/book-now" element={<BookNow />} />
          <Route path="/test-drive" element={<TestDrive />} />
          <Route path="/emi-calculator" element={<EMICalculator />} />
          <Route path="/charging-calculator" element={<ChargingCalculator />} />
          <Route path="/running-cost-calculator" element={<RunningCostCalculator />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
          <Route path="/payment-refund-policy" element={<PaymentRefundPolicyPage />} />
          <Route path="/bihar" element={<BiharDistrictsPage />} />
          {SEO_ARTICLES.filter((a) => a.path !== "/bihar").map((article) => (
            <Route key={article.path} path={article.path} element={<SeoMarketingPage path={article.path} />} />
          ))}
          {COMPARE_SEO_PAGES.map((article) => (
            <Route key={article.path} path={article.path} element={<SeoMarketingPage path={article.path} />} />
          ))}
          {/* URL-only pages (QR code) — intentionally not linked from any menu or footer */}
          <Route path="/post-delivery-feedback" element={<PostDeliveryFeedback />} />
          <Route path="/test-drive-feedback" element={<TestDriveFeedback />} />

          {/* Auth portals — chooser lives in the navbar Login hover menu */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route path="/customer" element={<CustomerLayout />}>
            <Route index element={<Navigate to="bookings" replace />} />
            <Route path="bookings" element={<CustomerBookings />} />
          </Route>

          {/* Admin routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="calendar" element={<AdminCalendar />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="meta-lead" element={<AdminMetaLeadCRM />} />
            <Route path="test-drives" element={<AdminTestDrives />} />
            <Route path="enquiries" element={<AdminEnquiries />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="offers" element={<AdminOffers />} />
            <Route path="content" element={<AdminContent />} />
            <Route path="homepage" element={<AdminHomepage />} />
            <Route path="media" element={<AdminMedia />} />
            <Route path="settings" element={<AdminSettings />} />

            {/* Lead CRM module */}
            <Route path="my-dashboard" element={<AdminExecutiveDashboard />} />
            <Route path="crm/leads" element={<AdminCrmLeads />} />
            <Route path="crm/lead-stages" element={<AdminLeadStages />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="reports/deliveries" element={<AdminDeliveryReports />} />

            {/* Customer feedback form submissions (QR pages) */}
            <Route path="feedback/test-drive" element={<AdminFeedbackSubmissions kind="testDrive" />} />
            <Route path="feedback/post-delivery" element={<AdminFeedbackSubmissions kind="postDelivery" />} />

            {/* Test Drive Management Module */}
            <Route path="td/bookings" element={<AdminTDBookings />} />
            <Route path="td/my-bookings" element={<AdminTDMyBookings />} />
            <Route path="td/reschedule-history" element={<AdminRescheduleHistory />} />
            <Route path="td/fleet-health" element={<AdminFleetHealth />} />
            <Route path="td/leads" element={<AdminTDLeads />} />
            <Route path="td/leads/reports" element={<AdminTDLeadReports />} />
            <Route path="td/vehicles" element={<AdminTDDemoVehicles />} />
            <Route path="td/models" element={<AdminVehicleModels />} />
            <Route path="stock" element={<AdminVehicleStock />} />
            <Route path="td/reports" element={<AdminTDReports />} />
            <Route path="td/config" element={<AdminTDSlotConfig />} />
            <Route path="td/users" element={<AdminTDUsers />} />
            <Route path="td/roles" element={<AdminTDRoles />} />
          </Route>

          {/* Hyperlocal SEO: /{district}/{model} e.g. /patna/vinfast-vf6 */}
          <Route path="/:districtSlug/:modelSlug" element={<DistrictLandingPage />} />
          <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </MotionConfig>
            </PublicSiteProvider>
          </PublicRecaptchaProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
