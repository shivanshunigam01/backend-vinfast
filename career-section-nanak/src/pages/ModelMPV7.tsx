import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import LeadCaptureStrip from "@/components/LeadCaptureStrip";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { BrochureDownloadButton } from "@/components/BrochureDownloadButton";
import { toast } from "sonner";
import { addLead } from "@/lib/vfLocalStorage";
import type { Lead } from "@/data/mockData";
import { hasApi, isPublicFormPostDisabled, PUBLIC_FORM_POST_DISABLED_MESSAGE } from "@/lib/apiConfig";
import { formatApiErrors } from "@/lib/api";
import { submitPublicLead } from "@/lib/publicFormsApi";
import { DEFAULT_MPV7_TRIM, leadModelLabel } from "@/data/vinfastModels";
import { BiharDistrictField } from "@/components/BiharDistrictField";
import { FormCaptcha } from "@/components/FormCaptcha";
import { BIHAR_DEFAULT_DISTRICT, DISTRICT_OTHER } from "@/data/biharDistricts";
import { usePublicFormRecaptcha } from "@/context/PublicRecaptchaContext";
import { usePublicSite } from "@/context/PublicSiteContext";
import { usePageSeo } from "@/hooks/usePageSeo";
import { WhatsAppOtpVerify } from "@/components/WhatsAppOtpVerify";
import mpv7HeroDesktop from "@/assets/mpv7-gallery/mpv7-hero-shared.png";
import mpv7HeroPagePortrait from "@/assets/mpv7-hero-page-portrait.png";
import mpv7DtlInterior1 from "@/assets/mpv7-details/mpv7-dtl-interior-1.jpg";

const MPV7_PREBOOK_SESSION_KEY = "vinfast_mpv7_prebook_unlocked";
const MPV7_PREBOOK_UNLOCK_EVENT = "vinfast-mpv7-prebook-unlock";
const MOBILE_REGEX = /^[6-9]\d{9}$/;

const getLocalISODate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/** Copy and structure aligned with https://vinfastauto.in/en/mpv7 (India MPV 7 page). */
const VINFAST_MPV7_DISCLAIMER =
  "Image is for representation purpose only. Actual car features and details may vary.";

/** Vehicle Specification table — matches official India MPV 7 listing. */
const specRows: [string, string][] = [
  ["Overall dimension (LxWxH) (mm)", "4740 x 1872 x 1734"],
  ["Wheel base (mm)", "2840 mm"],
  ["Acceleration (0-100 kph) (s)", "< 10s"],
  ["Regeneration brake mode", "Off, Low, Medium, High"],
  ["Selectable driving mode", "Eco/Normal/Sport"],
  ["Usable Battery Capacity", "60.13 kWh"],
  ["Fast Charging 10% to 70%", "30 mins"],
  ["Wheel and Tyre", "235/50 R19"],
  ["Steering wheel", "D-cut, leatherette wrap, multi-function, tilt & telescopic"],
  ["Seat upholstery", "Leatherette"],
  ["Windows", "All windows auto up/down with anti pinch"],
  ["Tire Pressure Monitoring System (TPMS)", "dTPMS"],
  ["Braking & Stability Assistance", "ABS, EBD, BA, ESC, TCS, HSA, ROM"],
  ["All Disc Brakes", "YES"],
  ["Electronic Parking Brake with Auto Hold", "YES"],
];

const mpv7HighlightTriplet: { label: string; value: string }[] = [
  { label: "Wheel base", value: "2840 mm" },
  { label: "Battery Capacity", value: "60.13 kWh" },
  { label: "Wheel & Tyre", value: "R19" },
];

const inputClass =
  "h-12 px-4 rounded-xl bg-background/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full";

const ModelMPV7 = () => {
  const { siteConfig } = usePublicSite();
  const { getToken } = usePublicFormRecaptcha();
  const location = useLocation();
  usePageSeo({
    title: "VinFast VF MPV7 | 7-Seater Electric MPV in Bihar | Patliputra VinFast",
    description:
      "Discover VinFast VF MPV7 — spacious 7-seater electric MPV for families and fleets. Book with Patliputra VinFast, Patna.",
    keywords: ["VinFast MPV7", "7 seater electric car Bihar", "VF MPV7 Patna"],
    canonical: "/models/mpv7",
  });
  const [prebookUnlocked, setPrebookUnlocked] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem(MPV7_PREBOOK_SESSION_KEY) === "1",
  );
  const [interestForm, setInterestForm] = useState({
    name: "",
    mobile: "",
    email: "",
    city: BIHAR_DEFAULT_DISTRICT,
    otherCity: "",
  });
  const [mobileError, setMobileError] = useState("");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [waToken, setWaToken] = useState<string | null>(null);
  const onWaTokenChange = useCallback((t: string | null) => setWaToken(t), []);
  const todayStr = getLocalISODate();

  useEffect(() => {
    if (location.hash !== "#mpv7-prebook") return;
    const t = window.setTimeout(() => {
      document.getElementById("mpv7-prebook")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(t);
  }, [location.hash, location.pathname]);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setInterestForm({ ...interestForm, mobile: digits });
    if (digits.length === 0) setMobileError("");
    else if (digits.length < 10) setMobileError("Mobile number must be 10 digits.");
    else if (MOBILE_REGEX.test(digits)) setMobileError("");
    else setMobileError("Enter a valid Indian mobile number (starts with 6–9).");
  };

  const handlePrebookInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interestForm.name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!interestForm.mobile || !MOBILE_REGEX.test(interestForm.mobile)) {
      toast.error("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (interestForm.city === DISTRICT_OTHER && !interestForm.otherCity.trim()) {
      toast.error("Please enter your city or district (outside Bihar).");
      return;
    }
    if (!captchaVerified) {
      toast.error("Please complete captcha verification.");
      return;
    }
    if (hasApi() && siteConfig.features?.whatsappOtp && !waToken) {
      toast.error("Please verify your mobile number with the WhatsApp code we send you.");
      return;
    }

    const modelDisplay = leadModelLabel("VF MPV 7", DEFAULT_MPV7_TRIM);

    let apiSuccessMessage: string | undefined;
    if (hasApi() && !isPublicFormPostDisabled()) {
      let recaptchaToken: string | undefined;
      try {
        recaptchaToken = await getToken("mpv7_prebook");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Security verification failed.");
        return;
      }
      try {
        const res = await submitPublicLead({
          name: interestForm.name.trim(),
          mobile: interestForm.mobile,
          city: interestForm.city === DISTRICT_OTHER ? DISTRICT_OTHER : interestForm.city,
          otherCity: interestForm.city === DISTRICT_OTHER ? interestForm.otherCity : "",
          modelDisplay,
          source: "Website",
          email: interestForm.email.trim(),
          remarks: "VF MPV 7 Book Now interest — form gate on model page",
          interest: "Book Now",
          financeNeeded: false,
          exchangeNeeded: false,
          pageSource: "VF MPV 7 Model Page",
          recaptchaToken,
          whatsappVerificationToken: waToken ?? undefined,
        });
        apiSuccessMessage = res.message;
      } catch (err) {
        toast.error(formatApiErrors(err));
        return;
      }
    } else if (hasApi() && isPublicFormPostDisabled()) {
      apiSuccessMessage = PUBLIC_FORM_POST_DISABLED_MESSAGE;
    } else {
      try {
        const lead: Lead = {
          id: `WL_${Date.now()}`,
          name: interestForm.name.trim(),
          mobile: interestForm.mobile,
          email: interestForm.email.trim(),
          city:
            interestForm.city === DISTRICT_OTHER
              ? interestForm.otherCity.trim() || DISTRICT_OTHER
              : interestForm.city,
          model: modelDisplay,
          source: "Website",
          status: "Interested",
          assignedTo: "",
          createdAt: todayStr,
          nextFollowUp: "",
          remarks: "VF MPV 7 Book Now interest — form gate on model page",
          financeNeeded: false,
          exchangeNeeded: false,
        };
        addLead(lead);
      } catch {
        toast.error("Could not save your request. Please call or WhatsApp us.");
        return;
      }
    }

    sessionStorage.setItem(MPV7_PREBOOK_SESSION_KEY, "1");
    window.dispatchEvent(new Event(MPV7_PREBOOK_UNLOCK_EVENT));
    setPrebookUnlocked(true);
    toast.success(
      apiSuccessMessage ?? "Thank you! You can now continue to complete your VF MPV 7 Book Now.",
    );
    setInterestForm({ name: "", mobile: "", email: "", city: BIHAR_DEFAULT_DISTRICT, otherCity: "" });
    setMobileError("");
    setCaptchaResetSignal((n) => n + 1);
  };

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />

      {/* Mobile: HeroSection-style portrait; lg+: original shared wide hero */}
      <section
        className="relative z-0 w-full max-w-none overflow-hidden bg-background pt-[4.25rem] lg:h-screen lg:max-h-[min(100vh,1280px)] lg:min-h-[600px] lg:pt-0"
        aria-label="VF MPV 7 hero"
      >
        <div className="relative w-full max-w-none shrink-0 overflow-hidden h-[calc(100dvh-4.25rem)] lg:hidden">
          <div className="hero-media-scrim absolute inset-0 overflow-hidden [transform:translateZ(0)]">
            <img
              src={mpv7HeroPagePortrait}
              alt="Black VinFast VF MPV 7 electric MPV on a coastal road above the ocean"
              className="hero-slider-image h-full w-full object-cover"
              style={{ objectPosition: "center 38%" }}
              sizes="100vw"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
        <div className="relative hidden lg:block lg:absolute lg:inset-0 lg:min-h-0">
          <div className="hero-media-scrim absolute inset-0 overflow-hidden">
            <img
              src={mpv7HeroDesktop}
              alt="VinFast VF MPV 7"
              className="hero-slider-image h-full w-full object-cover object-[50%_45%]"
              sizes="100vw"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
        <h1 className="sr-only">VinFast VF MPV 7</h1>
      </section>

      <section className="relative border-b border-border/50 bg-gradient-to-b from-background via-background to-muted/30">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" aria-hidden />
        <div className="container mx-auto px-4 lg:px-8 py-8 sm:py-10 lg:py-12">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
            <div className="h-1 w-12 rounded-full bg-primary/80" aria-hidden />
            <Button variant="hero" size="lg" className="h-12 min-w-[min(100%,17rem)] rounded-full px-8 text-sm font-semibold shadow-md shadow-primary/25 sm:h-14 sm:px-10" asChild>
              <Link to="#mpv7-prebook">Register for Book Now</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Your drive, your way. — highlights from official page */}
      <section className="py-12 sm:py-16 lg:py-20 border-b border-border/60 bg-muted/25">
        <div className="container mx-auto px-4 lg:px-8 max-w-5xl">
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-1 text-foreground">Your drive, your way.</h2>
          <h3 className="font-display font-bold text-xl md:text-2xl text-foreground/95 mt-3 mb-4">VF MPV 7</h3>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-8 max-w-3xl">
            A space curated with intention — bringing together comfort, technology, and design in one complete experience.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {mpv7HighlightTriplet.map((h) => (
              <div key={h.label} className="rounded-2xl border border-border/70 bg-card/90 p-5 text-center shadow-sm">
                <p className="font-display font-bold text-2xl md:text-3xl tabular-nums text-foreground">{h.value}</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-2">{h.label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground max-w-3xl mb-8">{VINFAST_MPV7_DISCLAIMER}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="default" size="default">
              <Link to="#mpv7-prebook">Register for Book Now</Link>
            </Button>
            {prebookUnlocked ? (
              <Button asChild variant="default" size="default" className="bg-primary">
                <Link to="/book-now?model=VF%20MPV%207">Book Now — VF MPV 7</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      {/* Interior — illustration only (official site uses cabin imagery; no extra spec copy here) */}
      <section className="py-12 sm:py-16 bg-background border-b border-border/50">
        <div className="w-full">
          <div className="relative w-full overflow-hidden">
            <img
              src={mpv7DtlInterior1}
              alt="VinFast VF MPV 7 interior"
              className="image-high-quality w-full h-[34vh] min-h-[230px] max-h-[520px] sm:h-[46vh] lg:h-[62vh] object-cover object-center"
              sizes="100vw"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="container mx-auto px-4 lg:px-8">
            <p className="text-xs text-muted-foreground mt-4 text-center max-w-2xl mx-auto">{VINFAST_MPV7_DISCLAIMER}</p>
          </div>
        </div>
      </section>

      {/* Vehicle Specification — same rows as vinfastauto.in/en/mpv7 */}
      <section className="py-16 sm:py-24 section-dark border-t border-border/60">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-12 max-w-3xl mx-auto">
            <h2 className="font-display font-bold text-3xl md:text-5xl mb-3 text-foreground">Vehicle Specification</h2>
            <p className="text-muted-foreground text-sm md:text-base">{VINFAST_MPV7_DISCLAIMER}</p>
          </div>
          <div className="overflow-x-auto touch-pan-x rounded-2xl border border-border/80 bg-card/40 max-w-4xl mx-auto">
            <table className="w-full min-w-[320px] text-sm text-left">
              <tbody>
                {specRows.map(([k, v]) => (
                  <tr key={k} className="border-b border-border/60 last:border-0">
                    <th className="px-4 py-3 font-medium text-muted-foreground w-[45%] align-top">{k}</th>
                    <td className="px-4 py-3 align-top text-foreground/90">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <BrochureDownloadButton
              brochureHref="/brochures/VF-MPV7-Brochure.pdf"
              downloadFileName="VinFast-VF-MPV7-Brochure.pdf"
              modelDisplay="VF MPV 7"
              pageSource="VF MPV 7 Model Page"
              variant="outline"
              size="lg"
              className="border-white/25 bg-white/5 text-white hover:bg-white/10"
            >
              <Download className="w-4 h-4 mr-2" />
              Download brochure
            </BrochureDownloadButton>
          </div>
        </div>
      </section>

      {/* Book Now — Patliputra VinFast */}
      <section
        id="mpv7-prebook"
        className="scroll-mt-20 sm:scroll-mt-24 border-t border-border/60 bg-gradient-to-b from-primary/[0.07] via-muted/40 to-muted/30 py-14 sm:py-16 lg:py-20"
      >
        <div className="container mx-auto px-4 lg:px-8 max-w-5xl">
          <div className="text-center mb-8 sm:mb-10">
            <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-2">VF MPV 7 · Book Now</p>
            <h2 className="font-display font-bold text-3xl sm:text-4xl mb-3">Ready to take the next step?</h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
              Share your details — we’ll call you back from Patna. After you submit, the{" "}
              <strong className="text-foreground font-medium">Book Now — VF MPV 7</strong> action unlocks on this page.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/95 p-5 sm:p-6 lg:p-8 shadow-sm">
            {!prebookUnlocked ? (
              <form onSubmit={handlePrebookInterestSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-3 lg:items-start">
                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="mpv7-pb-name" className="sr-only">
                    Full name
                  </label>
                  <input
                    id="mpv7-pb-name"
                    type="text"
                    placeholder="Full name *"
                    value={interestForm.name}
                    onChange={(e) => setInterestForm({ ...interestForm, name: e.target.value })}
                    className={inputClass}
                    autoComplete="name"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="mpv7-pb-mobile" className="sr-only">
                    Mobile
                  </label>
                  <input
                    id="mpv7-pb-mobile"
                    type="tel"
                    placeholder="Mobile number *"
                    value={interestForm.mobile}
                    onChange={handleMobileChange}
                    maxLength={10}
                    inputMode="numeric"
                    className={`${inputClass} ${mobileError ? "border-red-500 focus:ring-red-500/50" : ""}`}
                    autoComplete="tel"
                  />
                  {mobileError && <p className="text-red-500 text-[11px] mt-1 px-1">{mobileError}</p>}
                </div>
                <div className="sm:col-span-1 lg:col-span-2">
                  <label htmlFor="mpv7-pb-email" className="sr-only">
                    Email
                  </label>
                  <input
                    id="mpv7-pb-email"
                    type="email"
                    placeholder="Email"
                    value={interestForm.email}
                    onChange={(e) => setInterestForm({ ...interestForm, email: e.target.value })}
                    className={inputClass}
                    autoComplete="email"
                  />
                </div>
                {hasApi() && siteConfig.features?.whatsappOtp && (
                  <div className="sm:col-span-2 lg:col-span-12">
                    <WhatsAppOtpVerify
                      mobile={interestForm.mobile.replace(/\D/g, "").slice(0, 10)}
                      displayName={interestForm.name.trim() || "Customer"}
                      recaptchaAction="mpv7_prebook_whatsapp_otp"
                      enabled
                      onTokenChange={onWaTokenChange}
                    />
                  </div>
                )}
                <BiharDistrictField
                  id="mpv7-pb-district"
                  label="District (Bihar)"
                  labelClassName="sr-only"
                  selectClassName={inputClass}
                  otherInputClassName={`${inputClass} border-primary/50`}
                  value={interestForm.city}
                  otherValue={interestForm.otherCity}
                  onDistrictChange={(city) => setInterestForm({ ...interestForm, city, otherCity: "" })}
                  onOtherChange={(otherCity) => setInterestForm({ ...interestForm, otherCity })}
                  fullWidthOtherRow
                  otherFieldLabel="City / state / district *"
                  selectWrapperClassName="sm:col-span-1 lg:col-span-2"
                  otherRowClassName="sm:col-span-2 lg:col-span-12"
                />
                <div className="sm:col-span-2 lg:col-span-12">
                  <FormCaptcha onVerifyChange={setCaptchaVerified} resetSignal={captchaResetSignal} />
                </div>
                <div className="sm:col-span-2 lg:col-span-2 flex lg:pt-0">
                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full lg:w-auto lg:shrink-0"
                    disabled={Boolean(hasApi() && siteConfig.features?.whatsappOtp && !waToken)}
                  >
                    Submit
                  </Button>
                </div>
                <p className="sm:col-span-2 lg:col-span-12 text-center lg:text-left text-muted-foreground text-xs">
                  By submitting, you agree to be contacted about VF MPV 7.
                </p>
              </form>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-center sm:text-left">
                <p className="text-sm text-muted-foreground">
                  You&apos;re set — continue on Book Now with VF MPV 7 pre-selected.
                </p>
                <Button variant="hero" size="lg" asChild>
                  <Link to="/book-now?model=VF%20MPV%207">Book Now — VF MPV 7</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <LeadCaptureStrip />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default ModelMPV7;
