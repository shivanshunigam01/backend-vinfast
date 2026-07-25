import { useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, Headphones, CreditCard, ArrowLeftRight, MapPin, Award } from "lucide-react";
import { usePublicSite } from "@/context/PublicSiteContext";

const WhyVinFast = () => {
  const { dealer } = usePublicSite();

  const trustItems = useMemo(
    () => [
      {
        icon: Award,
        title: "Authorized Dealer",
        description: `Bihar's first and only authorized ${dealer.brand} dealer — ${dealer.dealerName}.`,
      },
      {
        icon: Shield,
        title: "5-Star Safety",
        description: "Bharat NCAP 5-star rated with advanced ADAS for ultimate protection.",
      },
      {
        icon: CreditCard,
        title: "Easy EV Finance",
        description: "Tailored finance solutions with leading banks. Low EMIs, quick approval.",
      },
      {
        icon: Headphones,
        title: "24/7 Support",
        description: "Roadside assistance, service support, and dedicated EV advisors.",
      },
      {
        icon: ArrowLeftRight,
        title: "Exchange Assist",
        description: `Trade in your old car for the best exchange value on a new ${dealer.brand}.`,
      },
      {
        icon: MapPin,
        title: "Bihar Presence",
        description: "Showrooms in Patna with expanding service network across Bihar.",
      },
    ],
    [dealer.brand, dealer.dealerName],
  );

  return (
    <section className="py-16 sm:py-24 lg:py-32 section-surface">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
            Why Choose Us
          </p>
          <h2 className="font-display font-bold text-3xl md:text-5xl">
            The Patliputra Group Advantage
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {trustItems.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-card-sm p-6 hover:bg-foreground/[0.04] transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyVinFast;
