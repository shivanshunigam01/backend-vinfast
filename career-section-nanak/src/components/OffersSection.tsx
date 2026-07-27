import { useMemo } from "react";
import { motion } from "framer-motion";
import { Gift, Repeat, Sparkles, Tag, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { hasApi } from "@/lib/apiConfig";
import { useRefetchWhenVisible } from "@/hooks/useRefetchWhenVisible";
import { usePublicOffers } from "@/hooks/usePublicOffers";

const ICONS: LucideIcon[] = [Sparkles, Repeat, Tag, Gift];

type OfferCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  badge: string | null;
};

function mapOffersFromApi(raw: Record<string, unknown>[]): OfferCard[] {
  return raw.map((o, i) => ({
    icon: ICONS[i % ICONS.length],
    title: String(o.title ?? "Offer"),
    description: String(o.description ?? ""),
    badge: o.type ? String(o.type) : null,
  }));
}

const OffersSection = () => {
  const { offers: rawOffers, loaded, hasOffers, reload } = usePublicOffers();

  useRefetchWhenVisible(reload, hasApi());

  const list = useMemo(() => mapOffersFromApi(rawOffers), [rawOffers]);

  return (
    <section id="offers" className="py-16 sm:py-24 lg:py-32 section-dark scroll-mt-20">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 sm:mb-16"
        >
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
            Limited Time
          </p>
          <h2 className="font-display font-bold text-3xl md:text-5xl">
            Exclusive Offers
          </h2>
        </motion.div>

        {loaded && hasOffers && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {list.map((offer, i) => {
              const Icon = offer.icon;
              return (
                <motion.div
                  key={`${offer.title}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card-sm p-6 relative group hover:bg-foreground/[0.04] transition-colors"
                >
                  {offer.badge && (
                    <span className="absolute top-4 right-4 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                      {offer.badge}
                    </span>
                  )}
                  <Icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="font-display font-semibold text-lg mb-2">{offer.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{offer.description}</p>
                </motion.div>
              );
            })}
          </div>
        )}

        {loaded && !hasOffers && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-xl mx-auto text-center rounded-2xl border border-border/60 bg-foreground/[0.03] px-6 py-10"
          >
            <p className="text-muted-foreground text-sm leading-relaxed">
              There are no published offers at the moment. Contact us for the latest pricing, exchange benefits, and finance options.
            </p>
          </motion.div>
        )}

        {!loaded && hasApi() && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 animate-pulse">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="glass-card-sm p-6 h-48 rounded-2xl bg-foreground/[0.06]" />
            ))}
          </div>
        )}

        {!loaded && !hasApi() && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-xl mx-auto text-center rounded-2xl border border-border/60 bg-foreground/[0.03] px-6 py-10"
          >
            <p className="text-muted-foreground text-sm leading-relaxed">
              Connect the site to the dealer API to show live offers, or use the form below to reach our team.
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          {!loaded && hasApi() ? (
            <p className="text-muted-foreground text-sm">Loading offers…</p>
          ) : loaded && hasOffers ? (
            <Button variant="hero" size="lg" asChild>
              <Link to={{ pathname: "/", hash: "offers" }}>View offers</Link>
            </Button>
          ) : (
            <Button variant="hero" size="lg" asChild>
              <Link to={{ pathname: "/contact", hash: "contact-form" }}>Know more</Link>
            </Button>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default OffersSection;
