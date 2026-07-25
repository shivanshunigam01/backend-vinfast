import { motion } from "framer-motion";
import { Check, Plug, Home, Wrench, ShieldCheck } from "lucide-react";
import vf7Street from "@/assets/vf7-street.jpg";

/** Offer messaging as text cards — no promotional bitmap tiles. */
const valueProgramCards: { title: string; body: string; footnote?: string; className?: string }[] = [
  {
    title: "Free Maintenance upto 3 years",
    body: "Enjoy hassle-free ownership with complimentary periodic maintenance for up to 3 years.",
    footnote: "*As per programme terms at Patliputra VinFast.",
    className: "bg-gradient-to-br from-red-950/40 via-card/80 to-card/60",
  },
  {
    title: "Up to ₹1.54 Lakhs* ICE to EV savings",
    body: "See how switching from petrol or diesel to electric can reduce your cost of ownership.",
    footnote: "*Indicative; subject to programme rules.",
    className: "bg-gradient-to-br from-sky-950/35 via-card/80 to-card/60",
  },
  {
    title: "Value Assured — up to 75%* buyback",
    body: "Plan your upgrade path with confidence through VinFast’s value programme.",
    footnote: "*Confirm eligibility and terms with Patliputra VinFast.",
    className: "bg-gradient-to-br from-emerald-950/35 via-card/80 to-card/60",
  },
  {
    title: "Power your journeys worry-free",
    body: "Get free charging till 31st March 2029* when you qualify under the current campaign.",
    footnote: "*Campaign terms apply — ask our Patna team.",
    className: "bg-gradient-to-br from-slate-800/80 via-card/80 to-primary/10",
  },
];

const ownershipItems = [
  {
    icon: Plug,
    title: "Charging Made Simple",
    description: "Access to India's growing fast-charging network. Charge 10-70% in just 24 minutes.",
  },
  {
    icon: Home,
    title: "Home Charging",
    description: "Get a complimentary home charger installed. Charge overnight, wake up to 100%.",
  },
  {
    icon: Wrench,
    title: "Service & Support",
    description: "Dedicated service center in Patna with trained EV technicians and genuine parts.",
  },
  {
    icon: ShieldCheck,
    title: "Warranty & Value Assured",
    description: "Free Maintenance upto 3 years, up to 1.54 Lakhs* ICE to EV savings, and Value Assured buyback up to 75%*.",
  },
];

const OwnershipSection = () => {
  return (
    <section className="py-16 sm:py-24 lg:py-32 section-dark overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
              Ownership Confidence
            </p>
            <h2 className="font-display font-bold text-3xl md:text-4xl lg:text-5xl mb-8">
              Own the Future,
              <br />
              <span className="text-muted-foreground">Worry-Free</span>
            </h2>
            <div className="space-y-6">
              {ownershipItems.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex gap-4"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold mb-1">{item.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-8 sm:mt-10">
              {valueProgramCards.map((card) => (
                <div
                  key={card.title}
                  className={`rounded-2xl border border-border/60 p-4 sm:p-5 shadow-sm ${card.className ?? ""}`}
                >
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-sm sm:text-base text-foreground leading-snug">{card.title}</p>
                      <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mt-2">{card.body}</p>
                      {card.footnote && (
                        <p className="text-muted-foreground/80 text-[10px] sm:text-[11px] leading-snug mt-2">{card.footnote}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="rounded-3xl overflow-hidden shadow-luxury">
              <img
                src={vf7Street}
                alt="VinFast VF 7 on Road"
                className="w-full h-full object-cover aspect-[4/3]"
                loading="lazy"
              />
            </div>
            {/* Floating stat card */}
            <div className="absolute bottom-3 left-3 right-3 max-w-xs sm:left-4 sm:right-auto sm:bottom-4 lg:-bottom-6 lg:-left-4 lg:right-auto glass-card p-4 sm:p-5">
              <p className="font-display font-bold text-2xl text-primary">24 min</p>
              <p className="text-foreground/60 text-xs">Fast charge 10-70%</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default OwnershipSection;
