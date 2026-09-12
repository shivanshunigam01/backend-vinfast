import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { usePageSeo } from "@/hooks/usePageSeo";

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const EMICalculator = () => {
  usePageSeo({
    title: "EV EMI Calculator | VinFast Finance Estimates | Patliputra VinFast",
    description:
      "Estimate monthly EMI for VinFast VF6, VF7 and MPV models. Plan your EV purchase with Patliputra VinFast, Bihar.",
    keywords: ["VinFast EMI calculator", "EV finance Bihar", "VF6 EMI", "VF7 EMI"],
    canonical: "/emi-calculator",
  });

  const [price, setPrice] = useState(2299000);
  const [downPayment, setDownPayment] = useState(500000);
  const [tenure, setTenure] = useState(60);
  const [rate, setRate] = useState(8.5);

  const maxDownPayment = Math.floor(price * 0.9 / 10000) * 10000;

  const emi = useMemo(() => {
    const principal = price - downPayment;
    if (principal <= 0) return 0;

    const monthlyRate = rate / 100 / 12;
    const months = tenure;
    if (monthlyRate === 0) return principal / months;

    return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  }, [price, downPayment, tenure, rate]);

  const totalAmount = emi * tenure;
  const totalInterest = totalAmount - (price - downPayment);
  const formatINR = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  const labelCls = "text-sm text-muted-foreground";
  const inputCls = "w-28 text-right text-sm font-semibold tabular-nums bg-background/60 border border-border/60 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground";

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <div className="pt-24 pb-20 lg:pt-32 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
            <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">Easy Finance</p>
            <h1 className="font-display font-bold text-4xl md:text-5xl mb-4">EMI Calculator</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Calculate your monthly EMI for VinFast VF 6, VF 7, VF MPV 7, or Limo Green.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto grid lg:grid-cols-2 gap-6 sm:gap-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5 sm:p-8 min-w-0">
              <h3 className="font-display font-bold text-lg mb-6">Customize Your Plan</h3>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className={labelCls}>Vehicle Price</label>
                    <input
                      type="number"
                      className={inputCls}
                      min={500000}
                      max={10000000}
                      step={10000}
                      value={price}
                      onChange={(e) => {
                        const v = clamp(Number(e.target.value) || 500000, 500000, 10000000);
                        setPrice(v);
                        setDownPayment((prev) => Math.min(prev, Math.floor(v * 0.9 / 10000) * 10000));
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    className="w-full accent-primary"
                    min={500000}
                    max={10000000}
                    step={10000}
                    value={price}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPrice(v);
                      setDownPayment((prev) => Math.min(prev, Math.floor(v * 0.9 / 10000) * 10000));
                    }}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className={labelCls}>Down Payment</label>
                    <input
                      type="number"
                      className={inputCls}
                      min={0}
                      max={maxDownPayment}
                      step={10000}
                      value={downPayment}
                      onChange={(e) => {
                        const v = clamp(Number(e.target.value) || 0, 0, maxDownPayment);
                        setDownPayment(v);
                      }}
                    />
                  </div>
                  <input
                    type="range"
                    className="w-full accent-primary"
                    min={0}
                    max={maxDownPayment}
                    step={10000}
                    value={downPayment}
                    onChange={(e) => setDownPayment(Number(e.target.value))}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className={labelCls}>Tenure (months)</label>
                    <input
                      type="number"
                      className={inputCls}
                      min={12}
                      max={120}
                      step={1}
                      value={tenure}
                      onChange={(e) => setTenure(clamp(Number(e.target.value) || 12, 12, 120))}
                    />
                  </div>
                  <input
                    type="range"
                    className="w-full accent-primary"
                    min={12}
                    max={120}
                    step={1}
                    value={tenure}
                    onChange={(e) => setTenure(Number(e.target.value))}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className={labelCls}>Interest Rate (% p.a.)</label>
                    <input
                      type="number"
                      className={inputCls}
                      min={1}
                      max={20}
                      step={0.1}
                      value={rate}
                      onChange={(e) => setRate(clamp(Number(e.target.value) || 1, 1, 20))}
                    />
                  </div>
                  <input
                    type="range"
                    className="w-full accent-primary"
                    min={1}
                    max={20}
                    step={0.1}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                  />
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-5 sm:p-8 h-fit min-w-0">
              <h3 className="font-display font-bold text-lg mb-6">Estimated EMI</h3>

              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 text-center mb-6">
                <p className="text-sm text-muted-foreground mb-2">Your Monthly EMI</p>
                <p className="font-display font-bold text-4xl text-primary">{formatINR(emi)}</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Loan Amount</span>
                  <span className="font-semibold">{formatINR(price - downPayment)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Interest</span>
                  <span className="font-semibold">{formatINR(totalInterest)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span className="font-semibold">{formatINR(totalAmount)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Link to="/contact" className="block">
                  <Button variant="hero" size="lg" className="w-full">Get Best Finance Offer</Button>
                </Link>
                <Link to="/test-drive" className="block">
                  <Button variant="outline" size="lg" className="w-full">Book Test Drive</Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default EMICalculator;

