import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import FaqSection from "@/components/FaqSection";
import { Award, Users, Target, Globe } from "lucide-react";
import patliputraVinfastHero from "@/assets/patliputra-vinfast-about-hero.png";
import vf8Convoy from "@/assets/vf8-convoy.jpg";
import { usePublicSite } from "@/context/PublicSiteContext";

const AboutPage = () => {
  const { dealer } = usePublicSite();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== "/about") return;
    const id = location.hash?.replace(/^#/, "");
    if (id !== "privacy" && id !== "terms") return;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.hash]);

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-[52vh] sm:min-h-[60vh] flex items-end pb-10 sm:pb-14 pt-[4.25rem] lg:pt-20">
        <div className="absolute inset-0">
          <img
            src={patliputraVinfastHero}
            alt={dealer.dealerName}
            className="image-high-quality h-full w-full object-cover object-center"
            sizes="100vw"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        </div>
        <div className="relative container mx-auto px-4 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <p className="text-on-image font-display font-semibold text-sm uppercase tracking-[0.25em] mb-3">About Us</p>
            <h1 className="text-on-image-lg font-display font-bold text-4xl md:text-6xl lg:text-7xl leading-tight mb-3">
              {dealer.dealerName}
            </h1>
            <p className="text-on-image-soft text-base md:text-lg max-w-xl">
              Bihar&apos;s first authorized {dealer.brand} dealer — bringing electric excellence to your doorstep.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="py-14 sm:py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="text-foreground/60 text-base sm:text-lg leading-relaxed max-w-3xl mx-auto text-center mb-12 sm:mb-20 px-1">
            Bihar&apos;s first and authorized {dealer.brand} dealer — {dealer.dealerName}. Backed by Patliputra Group&apos;s legacy of trust, we bring Vietnam&apos;s leading electric vehicle brand to the heart of India.
          </motion.p>

          {/* Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-12 sm:mb-20">
            {[
              { icon: Award, value: "25+", label: "Years of Trust" },
              { icon: Users, value: "5,000+", label: "Happy Customers" },
              { icon: Globe, value: "Bihar", label: "State Coverage" },
              { icon: Target, value: "#1", label: "EV Dealer in Bihar" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                  className="glass-card-sm p-5 sm:p-8 text-center">
                  <Icon className="w-8 h-8 text-primary mx-auto mb-4" />
                  <p className="font-display font-bold text-3xl mb-1">{stat.value}</p>
                  <p className="text-muted-foreground text-sm">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Image + Text */}
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center mb-12 sm:mb-20">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="rounded-3xl overflow-hidden shadow-luxury">
              <img
                src={vf8Convoy}
                alt="VinFast Fleet"
                className="image-high-quality aspect-[4/3] w-full object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                loading="lazy"
                decoding="async"
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="space-y-6">
              <div>
                <h2 className="font-display font-bold text-2xl mb-4">About VinFast</h2>
                <p className="text-muted-foreground leading-relaxed">
                  VinFast is Vietnam&apos;s leading automotive manufacturer, part of Vingroup — one of Southeast Asia&apos;s largest conglomerates. With a mission to make electric vehicles accessible to everyone, VinFast combines cutting-edge technology, world-class safety, and premium design at competitive prices.
                </p>
              </div>
              <div>
                <h2 className="font-display font-bold text-2xl mb-4">About {dealer.dealerName}</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {dealer.dealerName} builds on the Patliputra Group legacy — Bihar&apos;s trusted automotive partner for 25+ years with brands like JCB, Ashok Leyland, and Switch EV. As {dealer.brand}&apos;s authorized dealer for Bihar, we bring the same commitment to excellence and after-sales support.
                </p>
              </div>
              <div>
                <h2 className="font-display font-bold text-2xl mb-4">Our Mission</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To make Bihar&apos;s electric vehicle transition seamless, premium, and accessible. Every family deserves safe, intelligent, and sustainable mobility.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <section className="border-t border-border/40 bg-background">
        <div className="container mx-auto px-4 lg:px-8 py-12 sm:py-16 max-w-3xl space-y-12 sm:space-y-16">
          <article id="privacy" className="scroll-mt-[5.5rem]">
            <h2 className="font-display font-bold text-2xl mb-4">Privacy Policy</h2>
            <div className="text-muted-foreground text-sm leading-relaxed space-y-4">
              <p>
                {dealer.dealerName} respects your privacy. Information you submit through our website (for example test drive, booking, or contact forms) is used only to respond to your enquiry and to improve our services, unless you agree otherwise.
              </p>
              <p>
                We do not sell your personal data. Technical data such as device and browser type may be processed as needed to run and secure this site. For questions about how we handle your information, contact us using the details in the footer.
              </p>
            </div>
          </article>
          <article id="terms" className="scroll-mt-[5.5rem]">
            <h2 className="font-display font-bold text-2xl mb-4">Terms of Service</h2>
            <div className="text-muted-foreground text-sm leading-relaxed space-y-4">
              <p>
                This website is provided for general information about {dealer.brand} vehicles and {dealer.dealerName}. Specifications, features, colours, and pricing may change; offers and on-road prices are confirmed only at the dealership.
              </p>
              <p>
                Nothing on this site constitutes a binding sale until you complete official documentation with us. Trademarks and images belong to their respective owners. Use of this site is subject to applicable law in India.
              </p>
            </div>
          </article>
        </div>
      </section>

      <FaqSection className="section-surface border-t border-border/40" />

      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default AboutPage;
