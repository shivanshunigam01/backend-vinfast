import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import stepInsideLuxuryV6 from "@/assets/step-inside-luxury-v6-upload.png";
import vf7Interior from "@/assets/vf7-gallery/vf7-gallery-interior-enhanced-08.jpg";
import mpv7Hero from "@/assets/mpv7-gallery/mpv7-new.png";
import limoGreenHero from "@/assets/limo-green/design-car.webp";
import leadInteriorRhd from "@/assets/interior-rhd-luxury-ambient.png";

const interiorModels = [
  {
    href: "/models/vf6",
    label: "VF 6",
    image: stepInsideLuxuryV6,
    alt: "VinFast VF 6 interior — right-hand drive dashboard and front seats",
    objectClass: "object-cover object-center",
  },
  {
    href: "/models/vf7",
    label: "VF 7",
    image: vf7Interior,
    alt: "VinFast VF 7 cabin — touchscreen, digital cluster, and front seating",
    objectClass: "object-cover object-center",
  },
  {
    href: "/models/mpv7",
    label: "VF MPV 7",
    image: mpv7Hero,
    alt: "VinFast VF MPV 7 — studio exterior, seven-seat electric MPV",
    objectClass: "object-cover object-[48%_top]",
  },
  {
    href: "/models/limo-green",
    label: "Limo Green",
    image: limoGreenHero,
    alt: "VinFast Limo Green — studio exterior, seven-seat electric MPV",
    objectClass: "object-cover object-center",
  },
] as const;

const VirtualShowroom = () => {
  return (
    <section className="py-12 sm:py-16 lg:py-24 section-surface overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 sm:mb-10 lg:mb-12"
        >
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
            Virtual Showroom
          </p>
          <h2 className="font-display font-bold text-3xl md:text-5xl mb-4">Step Inside Luxury</h2>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
            Premium materials, ambient lighting, and connected cockpits — tailored for right-hand drive.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative mb-8 sm:mb-10 max-w-6xl mx-auto w-full rounded-3xl overflow-hidden border border-border/60 shadow-luxury"
        >
          <img
            src={leadInteriorRhd}
            alt="VinFast premium RHD interior — portrait touchscreen, digital cluster, and ambient cabin lighting"
            className="w-full aspect-[5/4] sm:aspect-[16/9] md:aspect-[21/9] object-cover object-center min-h-[200px] sm:min-h-0"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 lg:bottom-8 lg:left-10 lg:right-10 pointer-events-none">
            <p className="text-on-image-lg font-display font-bold text-lg sm:text-xl lg:text-2xl">Right-hand drive luxury</p>
            <p className="text-on-image-soft text-xs sm:text-sm mt-1 max-w-lg">
              Tan leather, ambient light, and a portrait infotainment experience — the VF cabin, built for India.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 max-w-6xl mx-auto w-full">
          {interiorModels.map((m, i) => (
            <motion.div
              key={m.href}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="group relative rounded-2xl overflow-hidden border border-border/60 bg-card/40 shadow-sm"
            >
              <Link
                to={m.href}
                className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-muted/30">
                  <img
                    src={m.image}
                    alt={m.alt}
                    className={`absolute inset-0 h-full w-full transition-[filter,transform] duration-500 group-hover:brightness-[1.05] group-hover:scale-[1.02] ${m.objectClass}`}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex items-end justify-between gap-3 pointer-events-none">
                    <p className="text-on-image-lg font-display font-bold text-base sm:text-lg drop-shadow-sm">{m.label}</p>
                    <span className="shrink-0 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm group-hover:bg-white pointer-events-none">
                      View
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VirtualShowroom;
