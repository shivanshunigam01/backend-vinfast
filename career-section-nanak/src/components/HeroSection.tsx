import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import heroSlide01 from "@/assets/hero-slideshow/slide-01.png";
import heroSlide02 from "@/assets/hero-slideshow/slide-02.png";
import heroSlide03 from "@/assets/hero-slideshow/slide-03.png";
import heroVf7LedHighway from "@/assets/hero-slideshow/hero-vf7-led-highway.png";
import heroVf7Cockpit from "@/assets/hero-slideshow/hero-vf7-cockpit.png";
import heroSlide05 from "@/assets/hero-slideshow/slide-05.png";
import heroSlide06 from "@/assets/vf6-earth-hero-family.png";
import heroMpv7 from "@/assets/mpv7-gallery/mpv7-hero-shared.png";
import heroMobileDealerLineup from "@/assets/hero-slideshow/mobile/hero-mobile-dealer-lineup.png";
import heroMobileRearSignature from "@/assets/hero-slideshow/mobile/hero-mobile-rear-signature.png";
import heroMobileMpv7 from "@/assets/hero-slideshow/mobile/hero-mobile-mpv7.png";
import heroMobileVf6Family from "@/assets/hero-slideshow/mobile/hero-mobile-vf6-family.png";
import heroMobileCockpit from "@/assets/hero-slideshow/mobile/hero-mobile-cockpit.png";
import heroMobileVf7City from "@/assets/hero-slideshow/mobile/hero-mobile-vf7-city.png";
import { hasApi } from "@/lib/apiConfig";
import { publicGet } from "@/lib/api";
import { useRefetchWhenVisible } from "@/hooks/useRefetchWhenVisible";
import { useMediaQuery } from "react-responsive";

export type HeroSlideView = {
  image: string;
  /** Portrait / mobile-optimized art; used below `lg` when set. */
  imageMobile?: string;
  /** Optional focal point when `imageMobile` is shown. */
  objectPositionMobile?: string;
  title: string;
  /** Three subtitle lines under the title (CMS / API subtitles are split automatically). */
  subLines?: readonly [string, string, string];
  objectPosition: string;
  badge?: string;
  ctaPrimary?: string;
  ctaPrimaryLink?: string;
  ctaSecondary?: string;
  ctaSecondaryLink?: string;
};

function subtitleToThreeLines(raw: string): readonly [string, string, string] {
  const t = raw.trim();
  if (!t) return ["", "", ""];
  const byNl = t
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byNl.length >= 3) return [byNl[0], byNl[1], byNl.slice(2).join(" ")];
  if (byNl.length === 2) return [byNl[0], byNl[1], ""];
  const sentences = t
    .match(/[^.!?]+(?:[.!?]+|$)/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [t];
  if (sentences.length >= 3)
    return [sentences[0], sentences[1], sentences.slice(2).join(" ")];
  if (sentences.length === 2) return [sentences[0], sentences[1], ""];
  const dashParts = t
    .split(/\s*[—–]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (dashParts.length >= 3)
    return [dashParts[0], dashParts[1], dashParts.slice(2).join(" — ")];
  if (dashParts.length === 2) return [dashParts[0], dashParts[1], ""];
  const commaParts = t.split(/,\s+/);
  if (commaParts.length >= 3) {
    const a = Math.ceil(commaParts.length / 3);
    const b = Math.ceil((2 * commaParts.length) / 3);
    return [
      commaParts.slice(0, a).join(", "),
      commaParts.slice(a, b).join(", "),
      commaParts.slice(b).join(", "),
    ];
  }
  const words = t.split(/\s+/);
  if (words.length >= 6) {
    const n = Math.ceil(words.length / 3);
    return [
      words.slice(0, n).join(" "),
      words.slice(n, 2 * n).join(" "),
      words.slice(2 * n).join(" "),
    ];
  }
  return [t, "", ""];
}

function buildDealerOpeningSlide(): HeroSlideView {
  return {
    image: heroSlide01,
    imageMobile: heroMobileDealerLineup,
    objectPositionMobile: "center 42%",
    title: "VF 6, VF 7, VF MPV 7 & Limo Green",
    subLines: [
      "Electrify your drive with our SUV lineup and the seven-seat VF MPV 7 and Limo Green MPVs. Exclusively at Patliputra VinFast, Bihar's only authorized VinFast dealer.",
      "",
      "",
    ],
    objectPosition: "28% 48%",
  };
}

/** New launch — second in fallback rotation after dealer opening slide. */
function buildMpv7LaunchSlide(): HeroSlideView {
  return {
    image: heroMpv7,
    imageMobile: heroMobileMpv7,
    objectPositionMobile: "center 38%",
    title: "The all-new VF MPV 7",
    subLines: [
      "Seven-seat electric MPV · 60.13 kWh battery · Book Now open.",
      "",
      "",
    ],
    /* Align to top of artwork so baked-in headline (“THE ALL-NEW”, etc.) stays in frame */
    objectPosition: "48% top",
  };
}

const HERO_FALLBACK_TAIL: HeroSlideView[] = [
  {
    image: heroSlide02,
    imageMobile: heroMobileVf7City,
    objectPositionMobile: "center 44%",
    title: "VinFast VF 7",
    subLines: [
      "Urban performance and electric sophistication — crafted for highways, city streets, and everything between.",
      "",
      "",
    ],
    objectPosition: "center 48%",
  },
  {
    image: heroSlide03,
    imageMobile: heroMobileRearSignature,
    objectPositionMobile: "center 48%",
    title: "Precision in every detail",
    subLines: ["Alloys, colour, unmistakable VF form.", "", ""],
    objectPosition: "center 55%",
  },
  {
    image: heroVf7LedHighway,
    imageMobile: heroMobileDealerLineup,
    objectPositionMobile: "center 40%",
    title: "Signature LED presence",
    subLines: ["Full-width light signature, front to rear.", "", ""],
    objectPosition: "center 50%",
  },
  {
    image: heroVf7Cockpit,
    imageMobile: heroMobileCockpit,
    objectPositionMobile: "center 45%",
    title: "Your command centre",
    subLines: ["Touchscreen, connected services, refined cabin.", "", ""],
    objectPosition: "center 48%",
  },
  {
    image: heroSlide05,
    imageMobile: heroMobileVf6Family,
    objectPositionMobile: "center 42%",
    title: "VinFast VF 6",
    subLines: [
      "Compact, smart, and electrifying — minimal dash, large screen, driver-focused layout.",
      "",
      "",
    ],
    objectPosition: "center 50%",
  },
  {
    image: heroSlide06,
    imageMobile: heroMobileVf6Family,
    objectPositionMobile: "center 42%",
    title: "Built for your family",
    subLines: [
      "VF 6 — space, safety, and zero tailpipe emissions for every journey.",
      "",
      "",
    ],
    objectPosition: "28% 45%",
  },
];

function buildHeroFallbackSlides(): HeroSlideView[] {
  return [
    buildDealerOpeningSlide(),
    buildMpv7LaunchSlide(),
    ...HERO_FALLBACK_TAIL,
  ];
}

function mapHeroFromApi(doc: Record<string, unknown>): HeroSlideView | null {
  const img = String(doc.bgImage ?? "").trim();
  if (!img) return null;
  const imgMobile = String(doc.bgImageMobile ?? "").trim();
  const subtitle = String(doc.subtitle ?? "").trim();
  const triplet = subtitle ? subtitleToThreeLines(subtitle) : undefined;
  const subLines = triplet?.some((l) => l.trim()) ? triplet : undefined;
  const objMob = String(doc.objectPositionMobile ?? "").trim();
  return {
    image: img,
    imageMobile: imgMobile || undefined,
    objectPositionMobile: objMob || undefined,
    title: String(doc.title ?? "VinFast"),
    subLines,
    objectPosition: String(doc.objectPosition ?? "center 50%"),
    badge: String(doc.badge ?? "").trim() || undefined,
    ctaPrimary: String(doc.ctaPrimary ?? "").trim() || undefined,
    ctaPrimaryLink: String(doc.ctaPrimaryLink ?? "").trim() || undefined,
    ctaSecondary: String(doc.ctaSecondary ?? "").trim() || undefined,
    ctaSecondaryLink: String(doc.ctaSecondaryLink ?? "").trim() || undefined,
  };
}

function heroImageSrc(slide: HeroSlideView, isLg: boolean): string {
  return !isLg && slide.imageMobile ? slide.imageMobile : slide.image;
}

function heroImageObjectPosition(slide: HeroSlideView, isLg: boolean): string {
  if (!isLg) {
    if (slide.imageMobile)
      return slide.objectPositionMobile ?? slide.objectPosition;
    if (slide.image === heroSlide01) return "76% 48%";
  }
  return slide.objectPosition;
}

const HeroSection = () => {
  const fallbackSlides = useMemo(() => buildHeroFallbackSlides(), []);
  const [apiSlides, setApiSlides] = useState<HeroSlideView[] | null>(null);
  const slides = apiSlides ?? fallbackSlides;
  const [current, setCurrent] = useState(0);
  const [loadedSlideIndices, setLoadedSlideIndices] = useState<Set<number>>(
    () => new Set([0, 1]),
  );
  const isLg = useMediaQuery({ query: "(min-width: 1024px)" });
  const loadSlidesFromApi = useCallback(async () => {
    if (!hasApi()) return;
    const raw = await publicGet<unknown[]>("/public/hero-slides");
    if (!Array.isArray(raw) || raw.length === 0) return;
    const mapped = (raw as Record<string, unknown>[])
      .map(mapHeroFromApi)
      .filter(Boolean) as HeroSlideView[];
    if (mapped.length > 0) {
      const opening = buildDealerOpeningSlide();
      const mpv7 = buildMpv7LaunchSlide();
      const withoutDupes = mapped.filter(
        (s) => s.image !== heroMpv7 && s.image !== opening.image,
      );
      setApiSlides([opening, mpv7, ...withoutDupes]);
    }
  }, []);

  useEffect(() => {
    if (!hasApi()) return;
    void loadSlidesFromApi();
  }, [loadSlidesFromApi]);

  useRefetchWhenVisible(loadSlidesFromApi, hasApi());

  useEffect(() => {
    setCurrent((c) => (slides.length ? Math.min(c, slides.length - 1) : 0));
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length) {
      setLoadedSlideIndices(new Set());
      return;
    }
    setLoadedSlideIndices(new Set([0, slides.length > 1 ? 1 : 0]));
  }, [slides.length]);

  useEffect(() => {
    if (!slides.length) return;
    const nextIdx = (current + 1) % slides.length;
    const prevIdx = (current - 1 + slides.length) % slides.length;
    setLoadedSlideIndices((prev) => {
      const next = new Set(prev);
      next.add(current);
      next.add(nextIdx);
      next.add(prevIdx);
      return next;
    });
  }, [current, slides.length]);

  const next = useCallback(
    () => setCurrent((c) => (slides.length ? (c + 1) % slides.length : 0)),
    [slides.length],
  );
  const prev = useCallback(
    () =>
      setCurrent((c) =>
        slides.length ? (c - 1 + slides.length) % slides.length : 0,
      ),
    [slides.length],
  );

  useEffect(() => {
    if (!slides.length) return;
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next, slides.length]);

  const slide = slides[current] ?? fallbackSlides[0];

  return (
    <section className="relative z-0 w-full max-w-[100%] overflow-x-clip overflow-y-hidden bg-background pt-16 sm:pt-[4.25rem] lg:pt-0 lg:h-[100dvh] lg:max-h-[100dvh] lg:min-h-0">
      <div className="relative w-full max-w-[100%] shrink-0 overflow-hidden h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-4.25rem)] min-h-[18rem] lg:h-full lg:absolute lg:inset-0 lg:z-0 lg:min-h-0">
        {slides.map((s, i) => {
          // Keep cross-fade wrappers mounted, but only request nearby slide images.
          // This avoids front-loading all hero assets on first paint.
          const shouldLoadImage = loadedSlideIndices.has(i) || i === current;
          return (
          <div
            key={`${s.image}-${i}`}
            className="hero-media-scrim absolute inset-0 transition-opacity duration-1000 ease-in-out [transform:translateZ(0)]"
            style={{
              opacity: i === current ? 1 : 0,
              zIndex: i === current ? 1 : 0,
            }}
            aria-hidden={i !== current}
          >
            <img
              src={shouldLoadImage ? heroImageSrc(s, isLg) : undefined}
              alt={`${s.title} — VinFast hero`}
              className="hero-slider-image absolute inset-0 block h-full w-full max-w-none object-cover"
              style={{ objectPosition: heroImageObjectPosition(s, isLg) }}
              sizes="100vw"
              loading={i === current ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={i === current ? "high" : loadedSlideIndices.has(i) ? "auto" : "low"}
            />
          </div>
          );
        })}

        {/* Carousel arrows — centered on left / right edges */}
        <div
          className="absolute inset-0 z-30 pointer-events-none flex items-center justify-between px-1.5 sm:px-3 lg:px-5"
          aria-hidden={false}
        >
          <button
            type="button"
            onClick={prev}
            className="pointer-events-auto flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/65"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            className="pointer-events-auto flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/65"
            aria-label="Next slide"
          >
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Full-bleed bottom stack: same pattern as desktop — copy pinned bottom-left, dots centered above safe area */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end">
          <div className="pointer-events-auto w-full">
            <div className="container mx-auto px-4 pb-3 sm:pb-4 lg:px-8 lg:pb-5 lg:pt-4">
              <div key={current} className="max-w-xl sm:max-w-2xl lg:max-w-3xl">
                <h2 className="text-hero-plain-lg font-display font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl lg:tracking-tight leading-[1.08] mb-2 sm:mb-3 lg:mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
                  {slide.title}
                </h2>
                {slide.subLines?.some((l) => l.trim()) && (
                  <div className="text-hero-plain-soft font-medium text-sm sm:text-base md:text-lg leading-relaxed max-w-prose space-y-1 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                    {slide.subLines.map(
                      (line, i) =>
                        line.trim() && (
                          <p key={i} className="block">
                            {line}
                          </p>
                        ),
                    )}
                  </div>
                )}
              </div>
            </div>
            <div
              className="pointer-events-auto flex justify-center gap-1.5 sm:gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-5 lg:pb-6"
              role="tablist"
              aria-label="Hero slides"
            >
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-selected={i === current}
                  className={`shrink-0 rounded-full transition-[width,height,background-color] ${
                    i === current
                      ? "h-2 w-2 sm:h-2.5 sm:w-2.5 bg-primary ring-2 ring-primary/50"
                      : "h-1.5 w-1.5 sm:h-2 sm:w-2 bg-white/50 hover:bg-white/75"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
