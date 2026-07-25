import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { addLead } from "@/lib/vfLocalStorage";
import type { Lead } from "@/data/mockData";
import { hasApi, isPublicFormPostDisabled, PUBLIC_FORM_POST_DISABLED_MESSAGE } from "@/lib/apiConfig";
import { formatApiErrors } from "@/lib/api";
import { submitPublicLead } from "@/lib/publicFormsApi";
import { DEFAULT_VF7_TRIM, leadModelLabel } from "@/data/vinfastModels";
import { ModelTrimSelect } from "@/components/ModelTrimSelect";
import { BiharDistrictField } from "@/components/BiharDistrictField";
import { FormCaptcha } from "@/components/FormCaptcha";
import { BIHAR_DEFAULT_DISTRICT, DISTRICT_OTHER } from "@/data/biharDistricts";
import { usePublicSite } from "@/context/PublicSiteContext";
import { WhatsAppOtpVerify } from "@/components/WhatsAppOtpVerify";
import { usePublicFormRecaptcha } from "@/context/PublicRecaptchaContext";

const MOBILE_REGEX = /^[6-9]\d{9}$/;

const getLocalISODate = () => {
  // Returns YYYY-MM-DD in the user's local timezone.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

type LeadCaptureStripProps = {
  includeMpv7InModelSelect?: boolean;
};

const LeadCaptureStrip = ({ includeMpv7InModelSelect = true }: LeadCaptureStripProps) => {
  const { siteConfig } = usePublicSite();
  const { getToken } = usePublicFormRecaptcha();
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    city: BIHAR_DEFAULT_DISTRICT,
    otherCity: "",
    model: "VF 7",
    variant: DEFAULT_VF7_TRIM,
    interest: "Test Drive",
  });
  const [mobileError, setMobileError] = useState("");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [waToken, setWaToken] = useState<string | null>(null);
  const onWaTokenChange = useCallback((t: string | null) => setWaToken(t), []);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits only, max 10 characters
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    setFormData({ ...formData, mobile: digits });

    if (digits.length === 0) {
      setMobileError("");
    } else if (digits.length < 10) {
      setMobileError("Mobile number must be 10 digits.");
    } else if (!MOBILE_REGEX.test(digits)) {
      setMobileError("Enter a valid Indian mobile number (starts with 6–9).");
    } else {
      setMobileError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Please enter your name.");
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
    if (hasApi()) {
      if (isPublicFormPostDisabled()) {
        toast.info(PUBLIC_FORM_POST_DISABLED_MESSAGE);
        setFormData({
          name: "",
          mobile: "",
          city: BIHAR_DEFAULT_DISTRICT,
          otherCity: "",
          model: "VF 7",
          variant: DEFAULT_VF7_TRIM,
          interest: "Test Drive",
        });
        setMobileError("");
        setCaptchaResetSignal((n) => n + 1);
        return;
      }
      const cityVal = formData.city === DISTRICT_OTHER ? DISTRICT_OTHER : formData.city;
      let recaptchaToken: string | undefined;
      try {
        recaptchaToken = await getToken("homepage_lead_strip");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Security verification failed.");
        return;
      }
      try {
        const res = await submitPublicLead({
          name: formData.name,
          mobile: formData.mobile,
          city: cityVal,
          otherCity: formData.city === DISTRICT_OTHER ? formData.otherCity : "",
          modelDisplay: leadModelLabel(formData.model, formData.variant),
          source: "Website",
          interest: formData.interest,
          remarks: `Interest: ${formData.interest}`,
          pageSource: "Homepage Lead Strip",
          recaptchaToken,
          whatsappVerificationToken: waToken ?? undefined,
        });
        toast.success(res.message ?? "Our EV advisor will get in touch with you shortly.");
      } catch (err) {
        toast.error(formatApiErrors(err));
        return;
      }
      setFormData({ name: "", mobile: "", city: BIHAR_DEFAULT_DISTRICT, otherCity: "", model: "VF 7", variant: DEFAULT_VF7_TRIM, interest: "Test Drive" });
      setMobileError("");
      setCaptchaResetSignal((n) => n + 1);
      return;
    }

    try {
      const todayStr = getLocalISODate();
      const city = formData.city === DISTRICT_OTHER ? (formData.otherCity || DISTRICT_OTHER) : formData.city;
      const lead: Lead = {
        id: `WL_${Date.now()}`,
        name: formData.name.trim(),
        mobile: formData.mobile,
        email: "",
        city,
        model: leadModelLabel(formData.model, formData.variant),
        source: "Website",
        status: "New Lead",
        assignedTo: "",
        createdAt: todayStr,
        nextFollowUp: "",
        remarks: `Interest: ${formData.interest}`,
        financeNeeded: false,
        exchangeNeeded: false,
      };
      addLead(lead);
    } catch {
      toast.error("Could not save your details (storage blocked or full). Please call or WhatsApp us.");
      return;
    }

    toast.success("Our EV advisor will get in touch with you shortly.");
    setFormData({ name: "", mobile: "", city: BIHAR_DEFAULT_DISTRICT, otherCity: "", model: "VF 7", variant: DEFAULT_VF7_TRIM, interest: "Test Drive" });
    setMobileError("");
    setCaptchaResetSignal((n) => n + 1);
  };

  return (
    <section className="py-12 sm:py-16 lg:py-24 section-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
      <div className="container mx-auto px-4 lg:px-8 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto text-center mb-10"
        >
          <h2 className="font-display font-bold text-3xl md:text-4xl mb-3">
            {siteConfig.leadStripTitle}
          </h2>
          <p className="text-muted-foreground">
            {siteConfig.leadStripSubtitle}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto glass-card p-4 sm:p-6 lg:p-8"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Your Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-12 min-w-0 w-full px-4 rounded-xl bg-background/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <div className="flex min-w-0 w-full flex-col gap-1">
              <input
                type="tel"
                placeholder="Mobile Number"
                value={formData.mobile}
                onChange={handleMobileChange}
                maxLength={10}
                inputMode="numeric"
                className={`h-12 min-w-0 w-full px-4 rounded-xl bg-background/50 border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                  mobileError ? "border-red-500 focus:ring-red-500/50" : "border-border"
                }`}
              />
              {mobileError && (
                <p className="text-red-500 text-[11px] px-1 leading-tight">{mobileError}</p>
              )}
            </div>
            <BiharDistrictField
              selectClassName="h-12 min-w-0 w-full px-4 rounded-xl bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              otherInputClassName="h-12 min-w-0 w-full px-4 rounded-xl bg-background/50 border border-primary/50 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={formData.city}
              otherValue={formData.otherCity}
              onDistrictChange={(city) => setFormData({ ...formData, city, otherCity: "" })}
              onOtherChange={(otherCity) => setFormData({ ...formData, otherCity })}
            />
            <ModelTrimSelect
              model={formData.model}
              variant={formData.variant}
              onChange={(m, v) => setFormData({ ...formData, model: m, variant: v })}
              className="h-12 min-w-0 w-full px-4 rounded-xl bg-background/50 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              includeMpv7={includeMpv7InModelSelect}
            />
          </div>
          <div className="mt-4">
            <FormCaptcha onVerifyChange={setCaptchaVerified} resetSignal={captchaResetSignal} />
          </div>
          {hasApi() && siteConfig.features?.whatsappOtp && (
            <div className="mt-4">
              <WhatsAppOtpVerify
                mobile={formData.mobile.replace(/\D/g, "").slice(0, 10)}
                displayName={formData.name.trim() || "Customer"}
                recaptchaAction="homepage_lead_whatsapp_otp"
                enabled
                onTokenChange={onWaTokenChange}
              />
            </div>
          )}
          <Button
            type="submit"
            variant="hero"
            className="h-12 w-full sm:w-auto lg:w-full shrink-0 mt-4"
            disabled={Boolean(hasApi() && siteConfig.features?.whatsappOtp && !waToken)}
          >
            Get in Touch
          </Button>
          <p className="text-center text-muted-foreground text-xs mt-4">
            By submitting, you agree to our privacy policy. We respect your data.
          </p>
        </motion.form>
      </div>
    </section>
  );
};

export default LeadCaptureStrip;
