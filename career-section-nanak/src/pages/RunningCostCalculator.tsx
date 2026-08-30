import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/hooks/usePageSeo";

export default function RunningCostCalculator() {
  usePageSeo({
    title: "EV Running Cost in Bihar | 100 km Cost Calculator | Patliputra VinFast",
    description:
      "Estimate what 100 km costs in a VinFast EV versus petrol in Bihar. Uses your tariff, consumption and fuel price — see methodology.",
    canonical: "/running-cost-calculator",
  });

  const [kmPerMonth, setKmPerMonth] = useState(1200);
  const [evKwhPer100, setEvKwhPer100] = useState(18);
  const [tariff, setTariff] = useState(8);
  const [petrolKmpl, setPetrolKmpl] = useState(12);
  const [petrolPrice, setPetrolPrice] = useState(105);

  const { evCost, petrolCost, savings } = useMemo(() => {
    const ev = (kmPerMonth / 100) * evKwhPer100 * tariff;
    const petrol = (kmPerMonth / Math.max(petrolKmpl, 0.1)) * petrolPrice;
    return { evCost: ev, petrolCost: petrol, savings: petrol - ev };
  }, [kmPerMonth, evKwhPer100, tariff, petrolKmpl, petrolPrice]);

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <div className="pt-24 pb-20 lg:pt-32 container mx-auto px-4 lg:px-8 max-w-2xl">
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="font-display font-bold text-3xl md:text-4xl mb-3">
          Running cost calculator
        </motion.h1>
        <p className="text-muted-foreground mb-8">Estimate monthly energy cost for an EV versus a petrol SUV.</p>
        <div className="space-y-5 rounded-xl border border-border/60 p-6 bg-card/40">
          <label className="block text-sm">
            Km per month
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 bg-background" value={kmPerMonth} onChange={(e) => setKmPerMonth(Number(e.target.value) || 0)} />
          </label>
          <label className="block text-sm">
            EV consumption (kWh / 100 km)
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 bg-background" value={evKwhPer100} onChange={(e) => setEvKwhPer100(Number(e.target.value) || 0)} />
          </label>
          <label className="block text-sm">
            Electricity ₹ / kWh
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 bg-background" value={tariff} onChange={(e) => setTariff(Number(e.target.value) || 0)} />
          </label>
          <label className="block text-sm">
            Petrol SUV km/l
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 bg-background" value={petrolKmpl} onChange={(e) => setPetrolKmpl(Number(e.target.value) || 0)} />
          </label>
          <label className="block text-sm">
            Petrol ₹ / litre
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 bg-background" value={petrolPrice} onChange={(e) => setPetrolPrice(Number(e.target.value) || 0)} />
          </label>
          <div className="space-y-1 pt-2">
            <p>EV monthly: <strong>{fmt(evCost)}</strong></p>
            <p>Petrol monthly: <strong>{fmt(petrolCost)}</strong></p>
            <p className="text-xl font-display font-bold text-primary">Est. savings: {fmt(savings)}</p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><Link to="/test-drive">Book test drive</Link></Button>
          <Button asChild variant="outline"><Link to="/charging-calculator">Charging calculator</Link></Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
          About this information: EV cost uses km × (kWh/100 km) × tariff. Petrol cost uses km ÷ km/l ×
          fuel price. These are planning figures, not a promise of savings. Last updated{" "}
          {new Date().toLocaleDateString("en-IN")}.
        </p>
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
