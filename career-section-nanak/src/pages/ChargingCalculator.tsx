import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { Button } from "@/components/ui/button";
import { usePageSeo } from "@/hooks/usePageSeo";

export default function ChargingCalculator() {
  usePageSeo({
    title: "EV Charging Cost Calculator | Patliputra VinFast Bihar",
    description:
      "Estimate home charging cost for VinFast EVs in Bihar. Plan electricity spend for VF6, VF7, MPV7 and Limo Green.",
    keywords: ["EV charging calculator", "charging cost Bihar", "VinFast charger cost"],
    canonical: "/charging-calculator",
  });

  const [batteryKwh, setBatteryKwh] = useState(60);
  const [tariff, setTariff] = useState(8);
  const [startPct, setStartPct] = useState(20);
  const [endPct, setEndPct] = useState(100);

  const cost = useMemo(() => {
    const kwh = batteryKwh * Math.max(0, endPct - startPct) / 100;
    return kwh * tariff;
  }, [batteryKwh, tariff, startPct, endPct]);

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <div className="pt-24 pb-20 lg:pt-32 container mx-auto px-4 lg:px-8 max-w-2xl">
        <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="font-display font-bold text-3xl md:text-4xl mb-3">
          Charging cost calculator
        </motion.h1>
        <p className="text-muted-foreground mb-8">Estimate the electricity cost to charge your VinFast EV at home.</p>
        <div className="space-y-5 rounded-xl border border-border/60 p-6 bg-card/40">
          <label className="block text-sm">
            Usable battery (kWh)
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 bg-background" value={batteryKwh} onChange={(e) => setBatteryKwh(Number(e.target.value) || 0)} />
          </label>
          <label className="block text-sm">
            Tariff (₹ / kWh)
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 bg-background" value={tariff} onChange={(e) => setTariff(Number(e.target.value) || 0)} />
          </label>
          <label className="block text-sm">
            Start charge %
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 bg-background" value={startPct} onChange={(e) => setStartPct(Number(e.target.value) || 0)} />
          </label>
          <label className="block text-sm">
            End charge %
            <input type="number" className="mt-1 w-full rounded-lg border px-3 py-2 bg-background" value={endPct} onChange={(e) => setEndPct(Number(e.target.value) || 0)} />
          </label>
          <p className="text-2xl font-display font-bold">Estimated cost: ₹{Math.round(cost).toLocaleString("en-IN")}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><Link to="/test-drive">Book test drive</Link></Button>
          <Button asChild variant="outline"><Link to="/emi-calculator">EMI calculator</Link></Button>
        </div>
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
