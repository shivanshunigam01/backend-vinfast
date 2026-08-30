import { useEffect, useState } from "react";
import { Check, Download, Gauge, Sparkles, Timer } from "lucide-react";
import Navbar from "@/components/Navbar";
import LeadCaptureStrip from "@/components/LeadCaptureStrip";
import { BrochureDownloadButton } from "@/components/BrochureDownloadButton";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import vf6Hero from "@/assets/vf6-product-hero.png";
import vf6HeroPagePortrait from "@/assets/vf6-hero-page-portrait.png";
import vf6WhyInteriorRhd from "@/assets/interior-rhd-luxury-ambient.png";
import vf6InfinityBlanc from "@/assets/vf6-infinity-blanc.png";
import vf6CrimsonRed from "@/assets/vf6-crimson-red.png";
import vf6JetBlack from "@/assets/vf6-jet-black.png";
import vf6DesatSilver from "@/assets/vf6-desat-silver.png";
import vf6ZenithGrey from "@/assets/vf6-zenith-grey.png";
import vf6UrbanMint from "@/assets/vf6-urban-mint.png";
import vf6GalExterior1 from "@/assets/vf6-gallery/vf6-gallery-exterior-1.jpg";
import vf6GalExterior2 from "@/assets/vf6-gallery/vf6-gallery-exterior-2.jpg";
import vf6GalDetail01 from "@/assets/vf6-gallery/vf6-gallery-detail-01.png";
import vf6GalDetail02 from "@/assets/vf6-gallery/vf6-gallery-detail-02.png";
import vf6GalDetail03 from "@/assets/vf6-gallery/vf6-gallery-detail-03.png";
import vf6GalDetail04 from "@/assets/vf6-gallery/vf6-gallery-detail-04.png";
import vf6GalDetail05 from "@/assets/vf6-gallery/vf6-gallery-detail-05.png";
import { usePublicSite } from "@/context/PublicSiteContext";
import { usePublicPricing } from "@/hooks/usePublicPricing";
import { usePageSeo } from "@/hooks/usePageSeo";
import { VF6_TRIM_0_100_KMH } from "@/data/vinfastCompareSpecAnchors";

const colors = [
  { name: "Infinity Blanc", hex: "#E8E8E4", image: vf6InfinityBlanc },
  { name: "Crimson Red", hex: "#C80F1E", image: vf6CrimsonRed },
  { name: "Jet Black", hex: "#18191D", image: vf6JetBlack },
  { name: "Desert Silver", hex: "#C8C9C4", image: vf6DesatSilver },
  { name: "Zenith Grey", hex: "#61656B", image: vf6ZenithGrey },
  { name: "Urban Mint", hex: "#727A67", image: vf6UrbanMint },
];

type VariantId = "earth" | "wind" | "infinity";

const vf6Variants: {
  id: VariantId;
  name: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    id: "earth",
    name: "VF 6 Earth",
    shortLabel: "Earth",
    description: "177 PS, R17 alloys, longest MIDC range — chassis safety (ABS suite + TPMS), no ADAS, no smart-app suite.",
  },
  {
    id: "wind",
    name: "VF 6 Wind",
    shortLabel: "Wind",
    description: "204 PS, 18\" wheels, 7 airbags, ADAS core, panoramic roof & smart connectivity.",
  },
  {
    id: "infinity",
    name: "VF 6 Wind Infinity",
    shortLabel: "Wind Infinity",
    description: "Everything in Wind plus extended ADAS: AEB, FCW, RCTA, auto high beam, driver monitoring & more.",
  },
];

const variantHeroStats: Record<
  VariantId,
  { range: string; accel: string; power: string; driveline: string }
> = {
  earth: { range: "468 km", accel: VF6_TRIM_0_100_KMH.earth, power: "177 PS", driveline: "FWD" },
  wind: { range: "463 km", accel: VF6_TRIM_0_100_KMH.wind, power: "204 PS", driveline: "FWD" },
  infinity: { range: "463 km", accel: VF6_TRIM_0_100_KMH.infinity, power: "204 PS", driveline: "FWD" },
};

const variantExShowroomPrice: Record<VariantId, string> = {
  earth: "₹18,19,000*",
  wind: "₹18,69,000*",
  infinity: "₹19,19,000*",
};

/** Dense facts for the selected-variant column (synced with spec tables) */
const variantKeyFigures: Record<VariantId, { label: string; value: string }[]> = {
  earth: [
    { label: "Usable battery", value: "59.6 kWh" },
    { label: "Max. torque", value: "250 Nm" },
    { label: "DC fast charge (10–70%)", value: "25 min · up to 100 kW" },
    { label: "Boot space", value: "423 L" },
    { label: "Ground clearance", value: "190 mm (unladen)" },
    { label: "Tyres & wheels", value: "225/60 R17 · silver alloy" },
  ],
  wind: [
    { label: "Usable battery", value: "59.6 kWh" },
    { label: "Max. torque", value: "310 Nm" },
    { label: "DC fast charge (10–70%)", value: "25 min · up to 100 kW" },
    { label: "Boot space", value: "423 L" },
    { label: "Ground clearance", value: "190 mm (unladen)" },
    { label: "Tyres & wheels", value: "225/55 R18 · machine-cut alloy" },
  ],
  infinity: [
    { label: "Usable battery", value: "59.6 kWh" },
    { label: "Max. torque", value: "310 Nm" },
    { label: "DC fast charge (10–70%)", value: "25 min · up to 100 kW" },
    { label: "Boot space", value: "423 L" },
    { label: "Ground clearance", value: "190 mm (unladen)" },
    { label: "Tyres & wheels", value: "225/55 R18 · machine-cut alloy" },
  ],
};

const variantSpotlightChips: Record<VariantId, string[]> = {
  earth: [
    "17\" silver alloys",
    "Fabric seats",
    "Longest MIDC range in the lineup",
    "Single-zone auto climate · 6 speakers",
    "Chassis safety suite + TPMS",
  ],
  wind: [
    "18\" machine-cut alloys",
    "Vegan leather · ventilated front seats",
    "Panoramic roof · dual-zone HVAC · PM1.0 filter",
    "7 airbags · 360° camera · rear sensors",
    "Core ADAS · adaptive cruise",
    "Smart app · OTA · wireless AA / CarPlay",
  ],
  infinity: [
    "Everything included on Wind",
    "AEB · forward collision warning",
    "Rear cross-traffic alert",
    "Auto high beam · driver monitoring",
    "Door-open warning",
  ],
};

/** Rows: [parameter, Earth, Wind, Wind Infinity] */
const technicalSpecRows: [string, string, string, string][] = [
  ["Max. power", "130 kW (177 PS)", "150 kW (204 PS)", "150 kW (204 PS)"],
  ["Max. torque", "250 Nm", "310 Nm", "310 Nm"],
  ["Driveline", "FWD", "FWD", "FWD"],
  ["Range (MIDC)", "468 km", "463 km", "463 km"],
  [
    "Acceleration (0–100 km/h)",
    variantHeroStats.earth.accel,
    variantHeroStats.wind.accel,
    variantHeroStats.infinity.accel,
  ],
  ["Usable battery capacity", "59.6 kWh", "59.6 kWh", "59.6 kWh"],
  ["Charge port", "CCS2", "CCS2", "CCS2"],
  ["AC charging", "Up to 7.2 kW", "Up to 7.2 kW", "Up to 7.2 kW"],
  ["DC charging", "Up to 100 kW", "Up to 100 kW", "Up to 100 kW"],
  ["Fast charging (10–70%)", "25 min", "25 min", "25 min"],
  ["Portable charger", "3.3 kW (16 A)", "3.3 kW (16 A)", "3.3 kW (16 A)"],
  ["Length × width × height", "4231 × 1834 × 1615 mm", "4231 × 1834 × 1615 mm", "4231 × 1834 × 1615 mm"],
  ["Wheelbase", "2730 mm", "2730 mm", "2730 mm"],
  ["Ground clearance (unladen)", "190 mm", "190 mm", "190 mm"],
  ["Boot space", "423 L", "423 L", "423 L"],
  ["Curb weight", "1962 kg", "2028 kg", "2028 kg"],
  [
    "Tyre & wheel size",
    "225/60 R17 (D = 436.6 mm), silver finish alloy",
    "225/55 R18 (D = 462 mm), machine cut alloy",
    "225/55 R18 (D = 462 mm), machine cut alloy",
  ],
  ["Front / rear brakes", "Disc / Disc", "Disc / Disc", "Disc / Disc"],
  ["Electronic parking brake", "Yes", "Yes", "Yes"],
  ["Auto Hold", "Yes", "Yes", "Yes"],
  ["Front suspension", "MacPherson independent", "MacPherson independent", "MacPherson independent"],
  ["Rear suspension", "Control blade independent", "Control blade independent", "Control blade independent"],
  ["Regeneration brake modes", "Off / Low / Medium / High", "Off / Low / Medium / High", "Off / Low / Medium / High"],
  ["Driving modes", "Eco / Normal / Sport", "Eco / Normal / Sport", "Eco / Normal / Sport"],
];

/** Exterior & interior — only where trims differ (per full VF 6 brief) */
const exteriorInteriorRows: [string, string, string, string][] = [
  ["Wheels", "Silver finish alloy (R17)", "Machine cut alloy (R18)", "Machine cut alloy (R18)"],
  ["Heated ORVM", "No", "Yes", "Yes"],
  ["Roof rail", "No", "Yes", "Yes"],
  ["Seat upholstery", "Fabric", "Vegan leather", "Vegan leather"],
  ["Driver seat adjustment", "Manual", "6-way power", "8-way power"],
  ["Ventilated front seats", "No", "Yes", "Yes"],
  ["HVAC", "Automatic single-zone", "Automatic dual-zone", "Automatic dual-zone"],
  ["Cabin air filter", "Yes", "PM1.0", "PM1.0"],
  ["Air ionizer", "No", "Yes", "Yes"],
  ["Rear AC vents", "No", "Yes", "Yes"],
  ["Head-up display (HUD)", "No", "Yes", "Yes"],
  ["Rear centre armrest (with cupholders)", "No", "Yes", "Yes"],
  ["Panoramic glass roof", "No", "Yes", "Yes"],
  ["Wireless charger", "No", "Yes", "Yes"],
];

const exteriorCommonBullets = [
  "Headlamp: LED projector; auto headlamp, auto levelling, follow-me-home",
  "DRL: LED; front & rear signature V light; tail lamp: LED",
  "ORVM: power fold & power adjust; reverse link (passenger side)",
  "Shark-fin antenna, window trim, keyless entry",
];

const interiorCommonBullets = [
  "Steering: D-cut multi-function, vegan leather wrap; tilt & telescopic adjustment",
  "USB — Front: 2× Type A; Rear: 2× Type A & 1× Type C (90 W)",
  "Power windows: all auto up/down; anti-pinch: Yes",
  "Keyless start: Yes; auto-dimming IRVM: Yes",
  "Glove box light & luggage light: Yes",
];

const safetyChassisAll =
  "On every VF 6 (Earth, Wind & Wind Infinity): ABS, EBD, BA, ESC, TCS, hill start assist, TPMS.";

const safetyWindInfinityBullets = [
  "7 airbags — driver, co-driver, front side, curtain, driver knee",
  "Rain-sensing wipers",
  "Roll-over mitigation",
  "Emergency signal system",
  "Rear parking sensors",
  "360° camera",
  "Rear seat ISOFIX",
  "Theft alarm & immobilizer",
  "Speed-sensing door lock",
  "Seatbelt reminder — all seats",
];

const adasWindBullets = [
  "Blind spot detection",
  "Lane centering control",
  "Auto lane change assist",
  "Lane departure warning",
  "Lane keeping assist",
  "Emergency lane keeping",
  "Adaptive cruise control",
];

const adasInfinityExtraBullets = [
  "Automatic emergency braking (front & rear)",
  "Forward collision warning",
  "Rear cross traffic alert",
  "Auto high beam",
  "Driver monitoring system",
  "Door open warning",
];

const connectivityRows: [string, string, string, string][] = [
  ["Touchscreen", "32.76 cm", "32.76 cm", "32.76 cm"],
  ["Audio", "6 speakers", "8 speakers", "8 speakers"],
  [
    "Smart & connected features",
    "Touchscreen & 6-speaker audio (no camp/pet/wash/valet, wireless AA/CP, games, remote app or FOTA per model brief)",
    "Camp, pet, wash & valet modes; wireless Android Auto & Apple CarPlay; games; on-board diagnostics; firmware OTA; remote control (doors, window, HVAC); vehicle tracking & monitoring; smartphone notifications; OTA via smartphone app",
    "Same smart suite as Wind",
  ],
];

const featureHighlights = [
  "Three variants: Earth (177 PS, R17), Wind & Wind Infinity (204 PS, R18)",
  "Same 59.6 kWh battery — Earth up to 468 km MIDC; Wind/Infinity 463 km MIDC",
  "Earth: no ADAS; Wind: core ADAS + ACC; Infinity: adds AEB, FCW, RCTA, driver monitoring & more",
  "Wind & Wind Infinity: 7 airbags, 360° camera, panoramic roof, ventilated seats & full smart connectivity",
  "Colours: Infinity Blanc, Crimson Red, Jet Black, Desert Silver, Zenith Grey, Urban Mint",
];

/** Patliputra showroom photography — each item keeps visible copy with the image */
const vf6GalleryFeature: { src: string; title: string; description: string; alt: string }[] = [
  {
    src: vf6GalExterior1,
    title: "Sculpted for the city",
    description:
      "Compact SUV proportions with a confident stance — LED lighting and clean surfacing that reads premium from every angle you walk up to it.",
    alt: "VinFast VF 6 exterior — dramatic three-quarter view",
  },
  {
    src: vf6GalExterior2,
    title: "Designed to stand out",
    description:
      "Strong shoulder lines and balanced glass area give the VF 6 a modern silhouette that feels at home on Patna roads and open highways alike.",
    alt: "VinFast VF 6 exterior — dynamic road presence",
  },
];

const vf6GalleryDetails: { src: string; title: string; description: string; alt: string }[] = [
  {
    src: vf6GalDetail01,
    title: "Driver-centric cabin",
    description:
      "Landscape touchscreen, D-cut steering with the VinFast V, and light upholstery with contrast stitching — clear ergonomics and a premium feel through the front row.",
    alt: "VinFast VF 6 interior dashboard, steering wheel, and front seats",
  },
  {
    src: vf6GalDetail02,
    title: "Sleek side profile",
    description:
      "Aerodynamic roofline and defined wheel arches — Wind and Wind Infinity wear 18\" machine-cut alloys; Earth uses refined 17\" silver alloys.",
    alt: "VinFast VF 6 full side profile",
  },
  {
    src: vf6GalDetail03,
    title: "Front fascia & lighting",
    description:
      "LED lighting, signature V-shaped DRL, and a confident front graphic — visibility and identity in one glance.",
    alt: "VinFast VF 6 front three-quarter studio view",
  },
  {
    src: vf6GalDetail04,
    title: "Signature road presence",
    description:
      "Bold VF 6 proportions on the road — the full-width V light signature and sculpted cladding read unmistakable from the three-quarter angle.",
    alt: "VinFast VF 6 front three-quarter on open road with mountain backdrop",
  },
  {
    src: vf6GalDetail05,
    title: "Electrified performance",
    description:
      "Panoramic roofline, motion-ready stance, and smart-tech positioning — Wind and Wind Infinity add full ADAS and connected features; confirm your exact trim at Patliputra VinFast.",
    alt: "VinFast VF 6 dynamic front three-quarter on highway with motion blur",
  },
];

function SpecTable({ title, rows }: { title: string; rows: [string, string, string, string][] }) {
  return (
    <div className="mb-12">
      <h3 className="font-display font-bold text-lg md:text-xl mb-4 text-left">{title}</h3>
      <div className="overflow-x-auto touch-pan-x rounded-2xl border border-border/80 bg-card/30 [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[640px] text-sm text-left">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 font-display font-semibold w-[28%]">Parameter</th>
              <th className="px-3 py-3 font-display font-semibold text-primary">VF 6 Earth</th>
              <th className="px-3 py-3 font-display font-semibold text-primary">VF 6 Wind</th>
              <th className="px-3 py-3 font-display font-semibold text-primary">VF 6 Wind Infinity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([param, e, w, inf]) => (
              <tr key={param} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5 text-muted-foreground align-top">{param}</td>
                <td className="px-3 py-2.5 align-top tabular-nums">{e}</td>
                <td className="px-3 py-2.5 align-top tabular-nums">{w}</td>
                <td className="px-3 py-2.5 align-top tabular-nums">{inf}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ModelVF6 = () => {
  const { siteConfig } = usePublicSite();
  const { variantPrice, bySlug } = usePublicPricing();
  const [selectedColor, setSelectedColor] = useState(0);
  const [variant, setVariant] = useState<VariantId>("earth");

  usePageSeo({
    title: "VinFast VF 6 Price, Range & Test Drive in Bihar | Patliputra VinFast",
    description:
      "Current VF 6 price, certified range and test drive assistance in Bihar from Patliputra VinFast, Patna. Book a slot or request EMI guidance.",
    canonical: "/models/vf6",
  });

  useEffect(() => {
    // Preload all colour images so palette switches feel instant.
    colors.forEach((color) => {
      const img = new Image();
      img.src = color.image;
    });
  }, []);

  const stats = variantHeroStats[variant];
  const vMeta = vf6Variants.find((v) => v.id === variant)!;
  const displayExShowroom =
    variant === "earth"
      ? bySlug("vf6")?.priceFrom || siteConfig.vf6Price || variantExShowroomPrice.earth
      : variantPrice("vf6", variant, variantExShowroomPrice[variant]);

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />

      <section
        className="relative z-0 w-full max-w-none overflow-hidden bg-background pt-[4.25rem] lg:h-screen lg:max-h-[min(100vh,1280px)] lg:min-h-[600px] lg:pt-0"
        aria-label="VF 6 hero"
      >
        {/* Mobile only: HeroSection-style shell + portrait art */}
        <div className="relative w-full max-w-none shrink-0 overflow-hidden h-[calc(100dvh-4.25rem)] lg:hidden">
          <div className="hero-media-scrim absolute inset-0 overflow-hidden [transform:translateZ(0)]">
            <img
              src={vf6HeroPagePortrait}
              alt="Silver VinFast VF 6 electric SUV with family and wildflower field under a bright sky"
              className="hero-slider-image h-full w-full object-cover"
              style={{ objectPosition: "center 42%" }}
              sizes="100vw"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
        {/* lg and up: original wide hero */}
        <div className="relative hidden min-h-[42vh] sm:min-h-[52vh] lg:block lg:absolute lg:inset-0 lg:min-h-0">
          <div className="hero-media-scrim absolute inset-0 overflow-hidden">
            <img
              src={vf6Hero}
              alt="Silver VinFast VF 6 electric SUV on a modern patio with a family and coastal bay view in the background"
              className="hero-slider-image h-full w-full object-cover object-[38%_52%]"
              sizes="100vw"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
        <h1 className="sr-only">VinFast VF 6</h1>
      </section>

      <section className="border-b border-border/60 bg-background/95 py-5 sm:py-6">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-primary font-display font-semibold text-xs uppercase tracking-[0.2em] mb-1">Select variant</p>
              <p className="text-sm text-muted-foreground">{vMeta.name}</p>
            </div>
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              {vf6Variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVariant(v.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    variant === v.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-foreground border-border/80 hover:bg-muted"
                  }`}
                >
                  {v.shortLabel}
                </button>
              ))}
            </div>
            <div className="sm:hidden">
              <label htmlFor="vf6-variant-selector" className="sr-only">
                Select VF 6 variant
              </label>
              <select
                id="vf6-variant-selector"
                value={variant}
                onChange={(e) => setVariant(e.target.value as VariantId)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              >
                {vf6Variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Exterior colour + selected variant (aligned with VF 7) */}
      <section className="py-10 sm:py-14 lg:py-20 border-b border-border/60 bg-muted/25">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="mb-10 lg:mb-12 rounded-2xl border border-border/60 bg-card/90 shadow-sm p-5 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
              <div className="min-w-0">
                <p className="text-primary font-display font-semibold text-xs uppercase tracking-[0.2em] mb-2">Exterior colour</p>
                <p className="font-display font-bold text-xl sm:text-2xl text-foreground">{colors[selectedColor].name}</p>
                <p className="text-muted-foreground text-sm mt-2 max-w-xl leading-relaxed">
                  Pick a paint for your VF 6 preview. Selection stays in sync with{" "}
                  <span className="text-foreground/80 font-medium">Color Studio</span> below.
                </p>
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5 sm:gap-3">
                {colors.map((c, i) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedColor(i)}
                    className={`relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border-2 transition-all ${
                      i === selectedColor
                        ? "border-primary scale-105 ring-2 ring-primary/30 shadow-md"
                        : "border-foreground/20 hover:border-foreground/40 hover:scale-[1.02]"
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                    aria-label={`Select colour ${c.name}`}
                    aria-pressed={i === selectedColor}
                  >
                    {i === selectedColor && (
                      <Check className="h-4 w-4 text-white drop-shadow-md mix-blend-difference" strokeWidth={3} aria-hidden />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid items-start gap-10 lg:gap-14 lg:grid-cols-12">
            <div className="lg:col-span-5 xl:col-span-5 space-y-6">
              <div>
                <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-2">Selected variant</p>
                <h2 className="font-display font-bold text-2xl md:text-3xl lg:text-4xl mb-3">{vMeta.name}</h2>
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed">{vMeta.description}</p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/90 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80 mb-3">Key figures</p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {variantKeyFigures[variant].map((row) => (
                    <div key={row.label} className="border-b border-border/40 sm:border-0 pb-3 sm:pb-0 last:border-0 last:pb-0">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</dt>
                      <dd className="text-sm font-medium text-foreground mt-0.5 leading-snug">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/80 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80 mb-2">ADAS</p>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {variant === "earth" && <span>No ADAS on VF 6 Earth.</span>}
                  {variant === "wind" && (
                    <ul className="list-disc pl-5 space-y-1.5">
                      {adasWindBullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  )}
                  {variant === "infinity" && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-foreground/80 mb-1">Same as Wind</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {adasWindBullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground/80 mb-1">Additional on Infinity</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {adasInfinityExtraBullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/30 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80 mb-2">Safety</p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">{safetyChassisAll}</p>
                {variant === "earth" ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Expanded pack (7 airbags, 360° camera, rain-sensing wipers, and more) is reserved for Wind and Wind Infinity.
                  </p>
                ) : (
                  <>
                    <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1.5">
                      {safetyWindInfinityBullets.slice(0, 5).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground mt-3">Full safety list is in the specifications section below.</p>
                  </>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 xl:col-span-7 space-y-8">
              <div className="rounded-2xl border border-border/60 bg-[#ECECEA] dark:bg-muted/40 overflow-hidden shadow-sm">
                <div className="relative aspect-[16/10] sm:aspect-[2/1] lg:min-h-[280px]">
                  <img
                    src={colors[selectedColor].image}
                    alt={`VF 6 ${vMeta.shortLabel} in ${colors[selectedColor].name}`}
                    className="image-high-quality absolute inset-0 h-full w-full object-contain object-center p-6 sm:p-8"
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground px-4 py-3 border-t border-border/40 bg-background/60">
                  {colors[selectedColor].name} · {vMeta.name}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="rounded-xl border border-border/70 bg-card/80 p-3 sm:p-4 shadow-sm col-span-2 sm:col-span-1">
                  <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 leading-tight">
                    Indicative ex-showroom
                  </p>
                  <p className="font-display font-bold text-base sm:text-lg md:text-xl tabular-nums">
                    {displayExShowroom}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Gauge className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider leading-tight">Range (MIDC)</p>
                  </div>
                  <p className="font-display font-bold text-base sm:text-lg md:text-xl tabular-nums">{stats.range}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-3 sm:p-4 shadow-sm" key={`stat-accel-${variant}`}>
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Timer className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider leading-tight">0–100 km/h</p>
                  </div>
                  <p className="font-display font-bold text-base sm:text-lg md:text-xl tabular-nums">{stats.accel}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/80 p-3 sm:p-4 shadow-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider leading-tight">Max. power</p>
                  </div>
                  <p className="font-display font-bold text-base sm:text-lg md:text-xl tabular-nums">{stats.power}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">At a glance</p>
                <div className="flex flex-wrap gap-2">
                  {variantSpotlightChips[variant].map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center rounded-full border border-border/80 bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground/90"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="rounded-xl border border-border/60 bg-muted/30 p-4 sm:p-5 mt-4"
                role="group"
                aria-label="Choose your desirable variant"
              >
                <p className="text-xs font-semibold tracking-wide text-muted-foreground mb-3">
                  Choose your desirable Variant
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-2 w-full max-w-2xl">
                  {vf6Variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariant(v.id)}
                      className={`rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-semibold transition-all border text-center leading-tight whitespace-nowrap shrink-0 ${
                        variant === v.id
                          ? "bg-foreground text-background border-foreground shadow-sm"
                          : "bg-background/90 text-foreground border-border/80 hover:bg-muted"
                      }`}
                    >
                      {v.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Showroom photo gallery — Patliputra VF 6 library */}
      <section className="py-12 sm:py-16 lg:py-24 bg-background border-y border-border/50">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-3xl mb-12 lg:mb-16">
            <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">Gallery</p>
            <h2 className="font-display font-bold text-3xl md:text-4xl lg:text-5xl mb-4">VF 6 in detail</h2>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
              Real exterior and interior photography from the showroom — each shot is paired with short context so specifications and design cues stay easy to scan alongside the visuals.
            </p>
          </div>

          <div className="grid gap-10 lg:gap-12 md:grid-cols-2 mb-14 lg:mb-20">
            {vf6GalleryFeature.map((item) => (
              <article key={item.title} className="flex flex-col">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border/50 bg-muted/30 shadow-sm">
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="image-high-quality absolute inset-0 h-full w-full object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="mt-5 md:mt-6">
                  <h3 className="font-display font-bold text-xl md:text-2xl text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-10 sm:grid-cols-2 xl:grid-cols-3">
            {vf6GalleryDetails.map((item) => (
              <article key={item.title} className="flex flex-col">
                <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border/50 bg-muted/20">
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="image-high-quality absolute inset-0 h-full w-full object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="mt-4 flex-1 flex flex-col">
                  <h3 className="font-display font-bold text-lg md:text-xl text-foreground leading-snug">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed flex-1">{item.description}</p>
                </div>
              </article>
            ))}
          </div>

        </div>
      </section>

      {/* Color Studio */}
      <section className="py-14 sm:py-20 section-surface">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">Color Studio</p>
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-8">Choose Your Shade</h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto mb-8">
            Infinity Blanc, Crimson Red, Jet Black, Desert Silver, Zenith Grey, Urban Mint.
          </p>
          <div className="max-w-5xl mx-auto mb-8 rounded-3xl overflow-hidden bg-[#F0F0F0]">
            <img
              src={colors[selectedColor].image}
              alt={`VinFast VF 6 in ${colors[selectedColor].name}`}
              className="image-high-quality h-auto w-full object-contain"
              sizes="(max-width: 768px) 100vw, 896px"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
            {colors.map((c, i) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedColor(i)}
                className={`w-10 h-10 rounded-full border-2 transition-all ${i === selectedColor ? "border-primary scale-110 shadow-glow-red" : "border-foreground/10"}`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
          <p className="text-muted-foreground text-sm">{colors[selectedColor].name}</p>
        </div>
      </section>

      {/* Full specification tables */}
      <section className="py-16 sm:py-24 section-dark">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">Specifications</p>
            <h2 className="font-display font-bold text-3xl md:text-5xl mb-4">VF 6 Earth, Wind & Wind Infinity</h2>
            <p className="text-muted-foreground text-sm md:text-base">
              Full technical, safety, ADAS, and feature breakdown for VF 6 Earth, Wind & Wind Infinity — as per the official model specification brief.
            </p>
          </div>

          <SpecTable title="Technical specification" rows={technicalSpecRows} />

          <div className="mb-12 grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="font-display font-bold text-lg md:text-xl mb-4 text-left">Exterior — standard on all variants</h3>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc pl-5">
                {exteriorCommonBullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-display font-bold text-lg md:text-xl mb-4 text-left">Interior — all variants</h3>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc pl-5">
                {interiorCommonBullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          <SpecTable title="Exterior & interior — differences by trim" rows={exteriorInteriorRows} />

          <div className="mb-12 grid gap-6 sm:gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-card/40 p-5 sm:p-6">
              <h3 className="font-display font-bold text-lg md:text-xl mb-3">Safety — all variants</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{safetyChassisAll}</p>
              <p className="text-muted-foreground text-xs mt-4 leading-relaxed">
                VF 6 Earth does not include the expanded safety pack below (7 airbags, 360°, rain-sensing wipers, etc.).
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/40 p-5 sm:p-6">
              <h3 className="font-display font-bold text-lg md:text-xl mb-3">Safety — VF 6 Wind & Wind Infinity only</h3>
              <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc pl-5">
                {safetyWindInfinityBullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mb-12">
            <h3 className="font-display font-bold text-lg md:text-xl mb-4">ADAS by variant</h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div className="rounded-2xl border border-border/80 bg-card/40 p-4 sm:p-5 text-left min-w-0">
                <p className="font-display font-semibold text-primary mb-2">VF 6 Earth</p>
                <p className="text-sm text-muted-foreground">No ADAS.</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/40 p-4 sm:p-5 text-left min-w-0">
                <p className="font-display font-semibold text-primary mb-2">VF 6 Wind</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  {adasWindBullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card/40 p-4 sm:p-5 text-left min-w-0">
                <p className="font-display font-semibold text-primary mb-2">VF 6 Wind Infinity</p>
                <p className="text-xs font-semibold text-foreground/70 mb-1">Same as Wind</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1 mb-3">
                  {adasWindBullets.map((b) => (
                    <li key={`inf-${b}`}>{b}</li>
                  ))}
                </ul>
                <p className="text-xs font-semibold text-foreground/70 mb-1">Additional on Infinity</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  {adasInfinityExtraBullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <SpecTable title="Connectivity, infotainment & smart features" rows={connectivityRows} />

          <div className="flex justify-center mt-10">
            <BrochureDownloadButton
              brochureHref="/brochures/VF6-Brochure.pdf"
              downloadFileName="VinFast-VF6-Brochure.pdf"
              modelDisplay="VF 6"
              pageSource="VF 6 Model Page"
              variant="outline"
              size="lg"
            >
              <Download className="w-4 h-4 mr-2" /> Download Brochure
            </BrochureDownloadButton>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-16 sm:py-24 section-surface">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">Why VF 6</p>
              <h2 className="font-display font-bold text-3xl md:text-4xl mb-8">Three trims, one smart platform</h2>
              <div className="grid sm:grid-cols-1 gap-3">
                {featureHighlights.map((f) => (
                  <div key={f} className="flex items-start gap-3 py-2">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground/80">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden shadow-luxury border border-border/40">
              <img
                src={vf6WhyInteriorRhd}
                alt="VinFast VF 6 interior — right-hand drive cabin, dashboard and front seats"
                className="image-high-quality aspect-[4/3] w-full object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <LeadCaptureStrip />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default ModelVF6;
