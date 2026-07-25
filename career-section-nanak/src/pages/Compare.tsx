import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Plus, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LeadCaptureStrip from "@/components/LeadCaptureStrip";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { BrochureDownloadButton } from "@/components/BrochureDownloadButton";
import {
  compareModels,
  compareRowLabels,
  compareSectionDefinitions,
  getVariantEntry,
  type CompareModelKey,
  type CompareSelection,
} from "@/data/compareCatalog";
import { hasApi } from "@/lib/apiConfig";
import { usePublicOffers } from "@/hooks/usePublicOffers";

type Slot = CompareSelection | null;

const defaultSlots: [Slot, Slot, Slot] = [
  { modelKey: "vf6", variantId: "infinity" },
  { modelKey: "vf7", variantId: "skyInfinity" },
  null,
];

function VsBadge() {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold tracking-tight text-background shadow-md border-2 border-background z-10"
      aria-hidden
    >
      VS
    </div>
  );
}

const ComparePage = () => {
  const { loaded: offersLoaded, hasOffers } = usePublicOffers();
  const [slots, setSlots] = useState<[Slot, Slot, Slot]>(defaultSlots);
  const [hideCommon, setHideCommon] = useState(false);
  const [thirdModelDraft, setThirdModelDraft] = useState<CompareModelKey>("vf6");
  const [thirdVariantDraft, setThirdVariantDraft] = useState<string>(
    compareModels.vf6.variants[0]?.id ?? "earth",
  );

  const activeSelections = useMemo(() => slots.filter((s): s is CompareSelection => s !== null), [slots]);

  const comparisonColumns = useMemo(() => {
    return activeSelections.map((sel) => {
      const model = compareModels[sel.modelKey];
      const variant = getVariantEntry(sel);
      return { sel, model, variant };
    });
  }, [activeSelections]);

  const tableSections = useMemo(() => {
    return compareSectionDefinitions
      .map((section) => {
        const rows = section.keys
          .map((key) => {
            const label = compareRowLabels[key] ?? key;
            const values = activeSelections.map((sel) => {
              const v = getVariantEntry(sel);
              return (v?.specs[key] ?? "—").trim();
            });
            if (values.every((v) => v === "—" || v === "")) return null;
            const allEqual = values.length > 1 && values.every((v) => v === values[0]);
            if (hideCommon && allEqual) return null;
            return { key, label, values };
          })
          .filter(Boolean) as { key: string; label: string; values: string[] }[];
        return { title: section.title, rows };
      })
      .filter((s) => s.rows.length > 0);
  }, [activeSelections, hideCommon]);

  const colCount = comparisonColumns.length;
  const gridTemplate = `minmax(140px,1.1fr) repeat(${colCount}, minmax(120px,1fr))`;

  const updateSlot = (index: 0 | 1 | 2, patch: Partial<CompareSelection> | null) => {
    setSlots((prev) => {
      const next: [Slot, Slot, Slot] = [...prev];
      if (patch === null) {
        next[index] = null;
        return next;
      }
      const cur = next[index];
      const base: CompareSelection =
        cur ?? { modelKey: patch.modelKey ?? "vf6", variantId: patch.variantId ?? compareModels.vf6.variants[0].id };
      next[index] = {
        modelKey: patch.modelKey ?? base.modelKey,
        variantId: patch.variantId ?? base.variantId,
      };
      const m = compareModels[next[index]!.modelKey];
      if (!m.variants.find((v) => v.id === next[index]!.variantId)) {
        next[index]!.variantId = m.variants[0].id;
      }
      return next;
    });
  };

  const addThirdVehicle = () => {
    const m = compareModels[thirdModelDraft];
    const vId = m.variants.some((v) => v.id === thirdVariantDraft) ? thirdVariantDraft : m.variants[0].id;
    setSlots((prev) => {
      const next: [Slot, Slot, Slot] = [...prev];
      next[2] = { modelKey: thirdModelDraft, variantId: vId };
      return next;
    });
  };

  const specRegionRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const fixedHeaderScrollRef = useRef<HTMLDivElement>(null);
  const [pinnedSpecHeader, setPinnedSpecHeader] = useState(false);
  const scrollSyncLock = useRef(false);

  const updatePinnedHeader = useCallback(() => {
    const el = specRegionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nh = window.matchMedia("(min-width: 1024px)").matches ? 80 : 64;
    const headerBand = 88;
    const pin = r.top <= nh + 1 && r.bottom >= nh + headerBand;
    setPinnedSpecHeader(pin);
  }, []);

  useEffect(() => {
    updatePinnedHeader();
    window.addEventListener("scroll", updatePinnedHeader, { passive: true });
    window.addEventListener("resize", updatePinnedHeader);
    return () => {
      window.removeEventListener("scroll", updatePinnedHeader);
      window.removeEventListener("resize", updatePinnedHeader);
    };
  }, [updatePinnedHeader]);

  const syncHorizontalScroll = useCallback((source: "table" | "fixed") => {
    if (scrollSyncLock.current) return;
    const t = tableScrollRef.current;
    const f = fixedHeaderScrollRef.current;
    if (!t || !f) return;
    scrollSyncLock.current = true;
    if (source === "table") f.scrollLeft = t.scrollLeft;
    else t.scrollLeft = f.scrollLeft;
    requestAnimationFrame(() => {
      scrollSyncLock.current = false;
    });
  }, []);

  useEffect(() => {
    if (!pinnedSpecHeader) return;
    const f = fixedHeaderScrollRef.current;
    const tb = tableScrollRef.current;
    if (f && tb) f.scrollLeft = tb.scrollLeft;
  }, [pinnedSpecHeader, comparisonColumns, gridTemplate]);

  const columnHeaderGrid = (
    <div className="grid gap-0 py-3 sm:py-3.5" style={{ gridTemplateColumns: gridTemplate }}>
      <div className="px-4 flex items-end">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none pb-0.5">
          Specification
        </span>
      </div>
      {comparisonColumns.map((col, i) => (
        <div
          key={`${col.sel.modelKey}-${col.sel.variantId}-head-${i}`}
          className="px-2 sm:px-3 text-center border-l border-border/50 flex flex-col justify-end min-h-[4.25rem] sm:min-h-[4.5rem]"
        >
          <p className="font-display font-bold text-xs sm:text-sm text-foreground leading-tight">
            {col.model.brand} {col.model.name}
          </p>
          <p className="text-[11px] sm:text-xs font-semibold text-primary mt-1 leading-tight">{col.variant?.label}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums mt-1">{col.variant?.price}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />

      {/* Fixed column legend — sits flush under navbar while spec block is on screen */}
      {pinnedSpecHeader && (
        <div
          className="fixed top-16 lg:top-20 left-0 right-0 z-[45] border-b border-border/80 bg-background/98 backdrop-blur-md shadow-md"
          role="region"
          aria-label="Comparison columns — model and variant"
        >
          {/* Same horizontal shell as #compare-tool spec table so columns line up with scroll sync */}
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <div
                ref={fixedHeaderScrollRef}
                onScroll={() => syncHorizontalScroll("fixed")}
                className="overflow-x-auto touch-pan-x rounded-2xl border border-border/70 bg-card/30 shadow-sm [-webkit-overflow-scrolling:touch]"
              >
                <div className="min-w-[720px] p-1 sm:p-2">
                  <div className="rounded-xl border border-border/60 bg-muted/30 shadow-sm">
                    <div className="rounded-xl border border-border/50 bg-card/80">
                      {columnHeaderGrid}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="pt-20 pb-8 sm:pt-24 lg:pt-32 lg:pb-10 border-b border-border/60 bg-muted/20">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-2">Compare</p>
            <h1 className="font-display font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl mb-3 leading-tight px-1">
              VinFast VF 6 &amp; VF 7
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Pick up to three trims, hide identical lines, and scroll the full spec stack — Patliputra VinFast Patna.
            </p>
          </motion.div>

          {/* Quick summary — lineup */}
          <div className="max-w-5xl mx-auto mb-10 sm:mb-12 rounded-2xl border border-border/70 bg-card shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 bg-muted/40 px-3 py-5 sm:px-6 sm:py-8 divide-y sm:divide-y-0 sm:divide-x divide-border/50 max-w-3xl mx-auto">
              {(["vf7", "vf6"] as const).map((key) => {
                const m = compareModels[key];
                return (
                  <div key={key} className="flex flex-col items-center justify-center py-4 sm:py-0 px-2 min-w-0">
                    <img
                      src={m.image}
                      alt={`VinFast ${m.name}`}
                      className="max-h-24 sm:max-h-28 md:max-h-32 w-full max-w-[min(100%,180px)] object-contain mb-3"
                    />
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">{m.brand}</p>
                    <p className="font-display font-bold text-base sm:text-lg leading-tight text-center">{m.name}</p>
                    <p className="text-xs sm:text-sm text-foreground/90 mt-2 tabular-nums leading-snug text-center px-1">
                      {key === "vf7" && "₹21,89,000* – ₹26,79,000*"}
                      {key === "vf6" && "₹17,29,000* – ₹19,19,000*"}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="p-4 sm:p-5 border-t border-border/60">
              <Button variant="outline" className="w-full border-primary/60 text-primary hover:bg-primary/5" asChild>
                <Link to="#compare-tool">Build your comparison</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="compare-tool" className="py-8 sm:py-10 lg:py-14 scroll-mt-20">
        <div className="container mx-auto px-4 lg:px-8">
          <h2 className="font-display font-bold text-lg sm:text-xl md:text-2xl mb-2 text-center md:text-left leading-snug break-words px-1 md:px-0">
            {comparisonColumns.map((c, i) => (
              <span key={i}>
                {c.model.name} {c.variant?.label}
                {i < comparisonColumns.length - 1 ? " vs " : ""}
              </span>
            ))}{" "}
            comparison
          </h2>

          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <Checkbox id="hide-common" checked={hideCommon} onCheckedChange={(v) => setHideCommon(v === true)} />
              <Label htmlFor="hide-common" className="text-sm font-normal cursor-pointer text-muted-foreground">
                Hide common features
              </Label>
            </div>
          </div>

          {/* Selector row — CarDekho-style cards + optional third slot */}
          <div className="flex flex-col lg:flex-row lg:items-stretch lg:justify-center lg:flex-wrap gap-4 lg:gap-0 mb-12">
            {comparisonColumns.map((col, idx) => (
              <Fragment key={`${col.sel.modelKey}-${col.sel.variantId}-${idx}`}>
                {idx > 0 && (
                  <div className="flex items-center justify-center py-2 lg:py-0 lg:w-12 lg:shrink-0">
                    <VsBadge />
                  </div>
                )}
                <div className="flex-1 min-w-0 w-full max-w-md mx-auto lg:mx-0 lg:max-w-[280px] xl:max-w-[320px] rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-sm relative">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Vehicle {idx + 1}</span>
                    {idx === 2 && (
                      <button
                        type="button"
                        onClick={() => updateSlot(2, null)}
                        className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Remove third vehicle"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl bg-[#ECECEA] dark:bg-muted/50 mb-4 h-32 sm:h-36 flex items-center justify-center overflow-hidden">
                    <img src={col.model.image} alt="" className="max-h-full w-auto object-contain" />
                  </div>
                  <p className="font-display font-bold text-lg mb-3">
                    {col.model.brand} {col.model.name}
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Model</Label>
                      <Select
                        value={col.sel.modelKey}
                        onValueChange={(v) =>
                          updateSlot(idx as 0 | 1 | 2, {
                            modelKey: v as CompareModelKey,
                            variantId: compareModels[v as CompareModelKey].variants[0].id,
                          })
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vf6">VinFast VF 6</SelectItem>
                          <SelectItem value="vf7">VinFast VF 7</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Variant</Label>
                      <Select value={col.sel.variantId} onValueChange={(v) => updateSlot(idx as 0 | 1 | 2, { variantId: v })}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {col.model.variants.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="mt-4 font-display font-bold text-lg tabular-nums">{col.variant?.price}</p>
                  <div className="mt-4 flex flex-col gap-2">
                    {!offersLoaded && hasApi() ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Loading…
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="w-full border-primary/50 text-primary" asChild>
                        <Link
                          to={
                            offersLoaded && hasOffers
                              ? { pathname: "/", hash: "offers" }
                              : { pathname: "/contact", hash: "contact-form" }
                          }
                        >
                          {offersLoaded && hasOffers ? "View offers" : "Know more"}
                        </Link>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" asChild>
                      <Link to={col.model.route}>Model page</Link>
                    </Button>
                  </div>
                </div>
              </Fragment>
            ))}

            {slots[2] === null && (
              <>
                <div className="flex items-center justify-center py-2 lg:py-0 lg:w-12 lg:shrink-0">
                  <VsBadge />
                </div>
                <div className="flex-1 min-w-0 w-full max-w-md mx-auto lg:mx-0 lg:max-w-[280px] xl:max-w-[320px] rounded-2xl border border-dashed border-primary/40 bg-muted/20 p-4 sm:p-5">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Plus className="h-6 w-6" />
                    </div>
                    <p className="font-display font-semibold text-sm">Add a third vehicle</p>
                    <p className="text-xs text-muted-foreground max-w-xs">
                      Add another VF 6 or VF 7 trim — for example two VF 7 variants side by side.
                    </p>
                    <div className="w-full space-y-2 text-left">
                      <Label className="text-xs text-muted-foreground">Model</Label>
                      <Select
                        value={thirdModelDraft}
                        onValueChange={(v) => {
                          const mk = v as CompareModelKey;
                          setThirdModelDraft(mk);
                          setThirdVariantDraft(compareModels[mk].variants[0].id);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vf6">VinFast VF 6</SelectItem>
                          <SelectItem value="vf7">VinFast VF 7</SelectItem>
                        </SelectContent>
                      </Select>
                      <Label className="text-xs text-muted-foreground mt-2 block">
                        Variant
                      </Label>
                      <Select value={thirdVariantDraft} onValueChange={setThirdVariantDraft}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {compareModels[thirdModelDraft].variants.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full mt-2" onClick={addThirdVehicle}>
                      Add to comparison
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Spec tables — in-flow header + fixed duplicate under navbar while scrolling this block */}
          <div ref={specRegionRef} className="max-w-6xl mx-auto">
            <div
              ref={tableScrollRef}
              onScroll={() => syncHorizontalScroll("table")}
              className="overflow-x-auto touch-pan-x rounded-2xl border border-border/70 bg-card/30 shadow-sm [-webkit-overflow-scrolling:touch]"
            >
              <div className="min-w-[720px] space-y-6 p-1 sm:p-2">
                {/* In-flow header: invisible when pinned but same borders as fixed bar so widths / scroll match */}
                <div className="rounded-xl border border-border/60 bg-muted/30 shadow-sm">
                  <div
                    className={
                      pinnedSpecHeader
                        ? "rounded-xl border border-border/50 bg-card/80 invisible pointer-events-none select-none"
                        : "rounded-xl border border-border/50 bg-card/80"
                    }
                    aria-hidden={pinnedSpecHeader}
                  >
                    {columnHeaderGrid}
                  </div>
                </div>

                {tableSections.map((section) => (
                  <div
                    key={section.title}
                    className="rounded-2xl border border-border/70 bg-card/50 overflow-hidden shadow-sm"
                  >
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <h3 className="font-display font-semibold text-sm md:text-base">{section.title}</h3>
                    </div>
                    <div>
                      {section.rows.map((row) => (
                        <div
                          key={row.key}
                          className="grid gap-0 items-stretch border-b border-border/40 last:border-b-0"
                          style={{ gridTemplateColumns: gridTemplate }}
                        >
                          <div className="px-4 py-3 text-sm text-muted-foreground bg-muted/20 font-medium">
                            {row.label}
                          </div>
                          {row.values.map((val, vi) => (
                            <div
                              key={vi}
                              className="px-3 sm:px-4 py-3 text-sm text-foreground/95 border-l border-border/40 bg-background/40"
                            >
                              {val}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-4 max-w-6xl mx-auto">
            <BrochureDownloadButton
              brochureHref="/brochures/VF6-Brochure.pdf"
              downloadFileName="VinFast-VF6-Brochure.pdf"
              modelDisplay="VF 6"
              pageSource="Compare Page"
              variant="outline"
              size="sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              VF 6 brochure
            </BrochureDownloadButton>
            <BrochureDownloadButton
              brochureHref="/brochures/VF7-Brochure.pdf"
              downloadFileName="VinFast-VF7-Brochure.pdf"
              modelDisplay="VF 7"
              pageSource="Compare Page"
              variant="outline"
              size="sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              VF 7 brochure
            </BrochureDownloadButton>
          </div>
        </div>
      </section>

      <section className="py-16 section-surface border-t border-border/60">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <h2 className="font-display font-bold text-2xl md:text-3xl mb-3">Still deciding?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto text-sm">
            Book back-to-back test drives or ask our Patna team to walk through trims with you.
          </p>
          <div className="hidden lg:flex flex-wrap justify-center gap-4">
            <Link to="/test-drive">
              <Button variant="hero" size="lg">
                Book test drive
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg">
                Contact dealer
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <LeadCaptureStrip includeMpv7InModelSelect={true} />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default ComparePage;
