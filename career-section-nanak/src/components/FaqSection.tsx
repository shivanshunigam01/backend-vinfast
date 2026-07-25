import { useEffect, useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { hasApi } from "@/lib/apiConfig";
import { publicGet } from "@/lib/api";
import { useRefetchWhenVisible } from "@/hooks/useRefetchWhenVisible";

type FaqItem = { question: string; answer: string; category?: string };

const FALLBACK_FAQS: FaqItem[] = [
  {
    question: "What is the range of VF 7?",
    answer: "The VF 7 offers up to 532 km of range (MIDC, variant-dependent) on a single charge.",
    category: "VF 7",
  },
  {
    question: "Is home charging available?",
    answer: "Yes, VinFast provides home charging solutions; our team can guide you on installation and usage.",
    category: "Charging",
  },
  {
    question: "What finance options are available?",
    answer: "We partner with leading banks to offer competitive EMI options. Visit the showroom or EMI calculator for indicative numbers.",
    category: "Finance",
  },
];

const FaqSection = ({ className = "" }: { className?: string }) => {
  const [items, setItems] = useState<FaqItem[]>(FALLBACK_FAQS);
  const [open, setOpen] = useState<number | null>(0);

  const loadFaqs = useCallback(async () => {
    if (!hasApi()) return;
    const data = await publicGet<unknown[]>("/public/faqs");
    if (!Array.isArray(data) || data.length === 0) return;
    setItems(
      (data as Record<string, unknown>[]).map((d) => ({
        question: String(d.question ?? ""),
        answer: String(d.answer ?? ""),
        category: d.category ? String(d.category) : undefined,
      })),
    );
  }, []);

  useEffect(() => {
    if (!hasApi()) return;
    void loadFaqs();
  }, [loadFaqs]);

  useRefetchWhenVisible(loadFaqs, hasApi());

  const list = useMemo(() => (items.length ? items : FALLBACK_FAQS), [items]);

  return (
    <section className={`py-14 sm:py-20 ${className}`}>
      <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-2">FAQ</p>
          <h2 className="font-display font-bold text-2xl sm:text-4xl">Common questions</h2>
          <p className="text-muted-foreground text-sm mt-2">Answers from our team — live data when your API is connected.</p>
        </motion.div>
        <div className="space-y-2">
          {list.map((faq, i) => (
            <motion.div
              key={`${faq.question}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border/60 bg-card/50 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 text-left px-4 py-3.5 sm:px-5 sm:py-4 hover:bg-secondary/30 transition-colors"
              >
                <span className="font-medium text-sm sm:text-base text-foreground pr-2">{faq.question}</span>
                <ChevronDown
                  className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform ${open === i ? "rotate-180" : ""}`}
                />
              </button>
              {open === i && (
                <div className="px-4 sm:px-5 pb-4 pt-0 text-sm text-muted-foreground leading-relaxed border-t border-border/40">
                  {faq.category && (
                    <span className="inline-block text-[10px] uppercase tracking-wider text-primary mb-2">{faq.category}</span>
                  )}
                  <p>{faq.answer}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;
