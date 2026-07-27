import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { toast } from "sonner";
import { Car, CreditCard, Headphones, CalendarDays, Share2 } from "lucide-react";
import html2canvas from "html2canvas";
import { addLead } from "@/lib/vfLocalStorage";
import type { Lead } from "@/data/mockData";
import { hasApi, isPublicFormPostDisabled, PUBLIC_FORM_POST_DISABLED_MESSAGE } from "@/lib/apiConfig";
import { formatApiErrors } from "@/lib/api";
import { submitPublicLead } from "@/lib/publicFormsApi";
import { DEFAULT_VF7_TRIM, DEFAULT_MPV7_TRIM, DEFAULT_LIMO_GREEN_TRIM, leadModelLabel } from "@/data/vinfastModels";
import { ModelTrimSelect } from "@/components/ModelTrimSelect";
import { BiharDistrictField } from "@/components/BiharDistrictField";
import { FormCaptcha } from "@/components/FormCaptcha";
import { BIHAR_DEFAULT_DISTRICT, DISTRICT_OTHER } from "@/data/biharDistricts";
import { usePublicFormRecaptcha } from "@/context/PublicRecaptchaContext";
import { usePublicSite } from "@/context/PublicSiteContext";
import { WhatsAppOtpVerify } from "@/components/WhatsAppOtpVerify";
import vf7Real from "@/assets/vf7-real.png";
import vf6Hero from "@/assets/vf6-earth-hero-family.png";
import bookNowCabinGrid from "@/assets/book-now-cabin-grid.png";
import slideVf7Interior from "@/assets/slide-vf7-interior.png";
import bookNowPaymentQr from "@/assets/book-now-payment-qr.png";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const ITR_NUMBER = "206508881857";

const getLocalISODate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const BookNowPage = () => {
  const { siteConfig } = usePublicSite();
  const { getToken } = usePublicFormRecaptcha();
  const paymentCardRef = useRef<HTMLDivElement | null>(null);
  const [searchParams] = useSearchParams();
  const [isSharingScreenshot, setIsSharingScreenshot] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    city: BIHAR_DEFAULT_DISTRICT,
    otherCity: "",
    model: "VF 7",
    variant: DEFAULT_VF7_TRIM,
    remarks: "",
    financeNeeded: false,
    exchangeNeeded: false,
  });
  const [mobileError, setMobileError] = useState("");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [waToken, setWaToken] = useState<string | null>(null);
  const onWaTokenChange = useCallback((t: string | null) => setWaToken(t), []);
  const todayStr = getLocalISODate();

  useEffect(() => {
    const raw = searchParams.get("model")?.trim() ?? "";
    const norm = raw.toLowerCase().replace(/\s+/g, " ");
    if (norm === "vf mpv 7" || norm === "mpv7" || raw === "VF MPV 7") {
      setFormData((f) => ({ ...f, model: "VF MPV 7", variant: DEFAULT_MPV7_TRIM }));
    } else if (norm === "limo green" || norm === "limo-green" || raw === "Limo Green") {
      setFormData((f) => ({ ...f, model: "Limo Green", variant: DEFAULT_LIMO_GREEN_TRIM }));
    }
  }, [searchParams]);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setFormData({ ...formData, mobile: digits });
    if (digits.length === 0) {
      setMobileError("");
    } else if (digits.length < 10) {
      setMobileError("Mobile number must be 10 digits.");
    } else if (MOBILE_REGEX.test(digits)) {
      setMobileError("");
    } else {
      setMobileError("Enter a valid Indian mobile number (starts with 6–9).");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!formData.mobile) {
      toast.error("Please enter your mobile number.");
      return;
    }
    if (!MOBILE_REGEX.test(formData.mobile)) {
      toast.error("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (formData.city === DISTRICT_OTHER && !formData.otherCity.trim()) {
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

    const extras = [
      formData.financeNeeded ? "Finance assistance requested." : "",
      formData.exchangeNeeded ? "Exchange / trade-in interest." : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (hasApi()) {
      if (isPublicFormPostDisabled()) {
        toast.info(PUBLIC_FORM_POST_DISABLED_MESSAGE);
        setFormData({
          name: "",
          mobile: "",
          email: "",
          city: BIHAR_DEFAULT_DISTRICT,
          otherCity: "",
          model: "VF 7",
          variant: DEFAULT_VF7_TRIM,
          remarks: "",
          financeNeeded: false,
          exchangeNeeded: false,
        });
        setMobileError("");
        setCaptchaResetSignal((n) => n + 1);
        return;
      }
      let recaptchaToken: string | undefined;
      try {
        recaptchaToken = await getToken("book_now");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Security verification failed.");
        return;
      }
      try {
        const res = await submitPublicLead({
          name: formData.name.trim(),
          mobile: formData.mobile,
          city: formData.city === DISTRICT_OTHER ? DISTRICT_OTHER : formData.city,
          otherCity: formData.city === DISTRICT_OTHER ? formData.otherCity : "",
          modelDisplay: leadModelLabel(formData.model, formData.variant),
          source: "Website",
          email: formData.email.trim(),
          remarks: [extras, formData.remarks?.trim()].filter(Boolean).join(" ") || "Book Now enquiry",
          interest: "Book Now",
          financeNeeded: formData.financeNeeded,
          exchangeNeeded: formData.exchangeNeeded,
          pageSource: "Book Now Page",
          recaptchaToken,
          whatsappVerificationToken: waToken ?? undefined,
        });
        toast.success(
          res.message ?? "Request received! Our team will call you shortly to complete your booking.",
        );
      } catch (err) {
        toast.error(formatApiErrors(err));
        return;
      }
      setFormData({
        name: "",
        mobile: "",
        email: "",
        city: BIHAR_DEFAULT_DISTRICT,
        otherCity: "",
        model: "VF 7",
        variant: DEFAULT_VF7_TRIM,
        remarks: "",
        financeNeeded: false,
        exchangeNeeded: false,
      });
      setMobileError("");
      setCaptchaResetSignal((n) => n + 1);
      return;
    }

    try {
      const lead: Lead = {
        id: `WL_${Date.now()}`,
        name: formData.name.trim(),
        mobile: formData.mobile,
        email: formData.email.trim(),
        city:
          formData.city === DISTRICT_OTHER
            ? formData.otherCity.trim() || DISTRICT_OTHER
            : formData.city,
        model: leadModelLabel(formData.model, formData.variant),
        source: "Website",
        status: "Interested",
        assignedTo: "",
        createdAt: todayStr,
        nextFollowUp: "",
        remarks: [extras, formData.remarks?.trim()].filter(Boolean).join(" ") || "Book Now enquiry",
        financeNeeded: formData.financeNeeded,
        exchangeNeeded: formData.exchangeNeeded,
      };
      addLead(lead);
    } catch {
      toast.error("Could not save your request (storage blocked or full). Please call or WhatsApp us.");
      return;
    }

    toast.success("Request received! Our team will call you shortly to complete your booking.");
    setFormData({
      name: "",
      mobile: "",
      email: "",
      city: BIHAR_DEFAULT_DISTRICT,
      otherCity: "",
      model: "VF 7",
      variant: DEFAULT_VF7_TRIM,
      remarks: "",
      financeNeeded: false,
      exchangeNeeded: false,
    });
    setMobileError("");
    setCaptchaResetSignal((n) => n + 1);
  };

  const update = (field: string, value: string | boolean) =>
    setFormData({ ...formData, [field]: value });

  const handleShareScreenshot = async () => {
    if (!paymentCardRef.current) return;

    setIsSharingScreenshot(true);
    try {
      const canvas = await html2canvas(paymentCardRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
      if (!blob) {
        toast.error("Could not prepare screenshot. Please try again.");
        return;
      }

      const file = new File([blob], "vinfast-book-now-payment-qr.png", { type: "image/png" });
      const canShareFile =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        await navigator.share({
          title: "VinFast Book Now Payment QR",
          text: `Scan and pay using this QR. ITR Number: ${ITR_NUMBER}`,
          files: [file],
        });
        toast.success("Screenshot shared successfully.");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vinfast-book-now-payment-qr.png";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Screenshot downloaded. You can now share it.");
    } catch {
      toast.error("Screenshot share failed. Please try again.");
    } finally {
      setIsSharingScreenshot(false);
    }
  };

  const inputClass =
    "h-12 px-4 rounded-xl bg-background/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full";

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <div className="pt-24 pb-36 lg:pt-32 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-start">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">Book Now</p>
              <h1 className="font-display font-bold text-4xl md:text-5xl mb-6">Reserve Your VinFast</h1>
              <p className="text-muted-foreground text-lg mb-8 max-w-lg">
                Purchase or reservation enquiry — we&apos;ll share pricing, variants, finance, and delivery. This is separate
                from scheduling a test drive.
              </p>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-10 max-w-xl">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border/60 shadow-sm">
                  <img
                    src={vf7Real}
                    alt="VinFast VF 7"
                    className="image-high-quality absolute inset-0 h-full w-full object-cover"
                    sizes="(max-width: 1024px) 45vw, 320px"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border/60 shadow-sm">
                  <img
                    src={vf6Hero}
                    alt="VinFast VF 6"
                    className="image-high-quality absolute inset-0 h-full w-full object-cover"
                    sizes="(max-width: 1024px) 45vw, 320px"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border/60 shadow-sm">
                  <img
                    src={bookNowCabinGrid}
                    alt="VinFast cabin — dashboard and front seats"
                    className="image-high-quality absolute inset-0 h-full w-full object-cover"
                    sizes="(max-width: 1024px) 45vw, 320px"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border/60 shadow-sm">
                  <img
                    src={slideVf7Interior}
                    alt="VF 7 cabin"
                    className="image-high-quality absolute inset-0 h-full w-full object-cover"
                    sizes="(max-width: 1024px) 45vw, 320px"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>

              <div className="space-y-6 max-w-lg">
                {[
                  {
                    icon: Car,
                    title: "Pick your model",
                    desc: "Choose VinFast VF 6 or VF 7 and optional trim — Earth, Wind, Wind Infinity, or Sky / Sky Infinity on VF 7.",
                  },
                  {
                    icon: CreditCard,
                    title: "Finance & exchange",
                    desc: "Flag loan help or trade-in in the same request.",
                  },
                  {
                    icon: Headphones,
                    title: "Dealer callback",
                    desc: "Patliputra VinFast Patna will contact you with next steps.",
                  },
                ].map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.title} className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-display font-semibold mb-1">{step.title}</h3>
                        <p className="text-muted-foreground text-sm">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-10 text-sm text-muted-foreground flex items-start gap-2">
                <CalendarDays className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Only want to drive first?{" "}
                  <Link to="/test-drive" className="text-primary font-medium hover:underline">
                    Book a test drive
                  </Link>
                  .
                </span>
              </p>
            </motion.div>

            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              onSubmit={handleSubmit}
              className="glass-card p-5 sm:p-8 min-w-0"
            >
              <h3 className="font-display font-bold text-xl mb-2">Complete your Book Now</h3>
              <p className={`text-muted-foreground text-sm ${hasApi() ? "mb-3" : "mb-6"}`}>
                No date or time here — those are for test drives only.
              </p>
              {hasApi() && (
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Your request is saved to the CRM; with mail configured on the server, the team receives it by email as well.
                </p>
              )}
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={formData.name}
                  onChange={(e) => update("name", e.target.value)}
                  className={inputClass}
                />
                <div className="flex flex-col gap-1">
                  <input
                    type="tel"
                    placeholder="Mobile Number *"
                    value={formData.mobile}
                    onChange={handleMobileChange}
                    maxLength={10}
                    inputMode="numeric"
                    className={`${inputClass} ${mobileError ? "border-red-500 focus:ring-red-500/50" : ""}`}
                  />
                  {mobileError && <p className="text-red-500 text-[11px] px-1 leading-tight">{mobileError}</p>}
                </div>
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={formData.email}
                  onChange={(e) => update("email", e.target.value)}
                  className={inputClass}
                />
                {hasApi() && siteConfig.features?.whatsappOtp && (
                  <WhatsAppOtpVerify
                    mobile={formData.mobile.replace(/\D/g, "").slice(0, 10)}
                    displayName={formData.name.trim() || "Customer"}
                    recaptchaAction="book_now_whatsapp_otp"
                    enabled
                    onTokenChange={onWaTokenChange}
                  />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5 min-w-0">
                    <label htmlFor="booknow-model-trim" className="text-xs font-medium text-muted-foreground">
                      Model &amp; trim
                    </label>
                    <ModelTrimSelect
                      id="booknow-model-trim"
                      model={formData.model}
                      variant={formData.variant}
                      onChange={(m, v) => setFormData({ ...formData, model: m, variant: v })}
                      className={inputClass}
                      includeMpv7
                    />
                  </div>
                  <BiharDistrictField
                    id="booknow-district"
                    label="District (Bihar)"
                    selectClassName={inputClass}
                    otherInputClassName={`${inputClass} border-primary/50`}
                    value={formData.city}
                    otherValue={formData.otherCity}
                    onDistrictChange={(city) => setFormData({ ...formData, city, otherCity: "" })}
                    onOtherChange={(otherCity) => setFormData({ ...formData, otherCity })}
                    fullWidthOtherRow
                    otherFieldLabel="City / state / district *"
                  />
                </div>
                <div className="flex flex-col gap-3 pt-1">
                  <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.financeNeeded}
                      onChange={(e) => update("financeNeeded", e.target.checked)}
                      className="rounded border-border w-4 h-4 text-primary"
                    />
                    I need finance / loan assistance
                  </label>
                  <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.exchangeNeeded}
                      onChange={(e) => update("exchangeNeeded", e.target.checked)}
                      className="rounded border-border w-4 h-4 text-primary"
                    />
                    I have a car to exchange
                  </label>
                </div>
                <textarea
                  placeholder="Colour, timeline, questions…"
                  value={formData.remarks}
                  onChange={(e) => update("remarks", e.target.value)}
                  className={`${inputClass} h-24 py-3 resize-none`}
                />
                <div ref={paymentCardRef} className="rounded-xl border border-border bg-card/70 p-4 space-y-3">
                  <p className="font-display text-base font-semibold">Book Now QR Payment</p>
                  <img
                    src={bookNowPaymentQr}
                    alt="Scan and pay QR code for book now payment"
                    className="w-full max-w-[320px] mx-auto rounded-md border border-border/70"
                    loading="lazy"
                    decoding="async"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    ITR Number: <span className="font-semibold text-foreground">{ITR_NUMBER}</span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleShareScreenshot}
                  disabled={isSharingScreenshot}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  {isSharingScreenshot ? "Preparing screenshot..." : "Share screenshot"}
                </Button>
                <FormCaptcha onVerifyChange={setCaptchaVerified} resetSignal={captchaResetSignal} />
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={Boolean(hasApi() && siteConfig.features?.whatsappOtp && !waToken)}
                >
                  Submit Book Now request
                </Button>
                <p className="text-center text-muted-foreground text-xs">By submitting, you agree to our privacy policy.</p>
              </div>
            </motion.form>
          </div>
        </div>
      </div>
      <Footer />
      <StickyMobileCTA />
    </div>
  );
};

export default BookNowPage;
