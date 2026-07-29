import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { toast } from "sonner";
import { MapPin, Phone, Mail, Clock, MessageCircle } from "lucide-react";
import { addEnquiry, addLead } from "@/lib/vfLocalStorage";
import type { Enquiry, Lead } from "@/data/mockData";
import {
  hasApi,
  isPublicFormPostDisabled,
  PUBLIC_FORM_POST_DISABLED_MESSAGE,
} from "@/lib/apiConfig";
import { formatApiErrors } from "@/lib/api";
import { submitPublicEnquiry, submitPublicLead } from "@/lib/publicFormsApi";
import { DEFAULT_VF7_TRIM, leadModelLabel } from "@/data/vinfastModels";
import { ModelTrimSelect } from "@/components/ModelTrimSelect";
import { BiharDistrictField } from "@/components/BiharDistrictField";
import { FormCaptcha } from "@/components/FormCaptcha";
import {
  BIHAR_DEFAULT_DISTRICT,
  DISTRICT_OTHER,
  resolvedDistrictLabel,
} from "@/data/biharDistricts";
import { usePublicSite } from "@/context/PublicSiteContext";
import { WhatsAppOtpVerify } from "@/components/WhatsAppOtpVerify";
import { usePublicFormRecaptcha } from "@/context/PublicRecaptchaContext";
import { usePageSeo } from "@/hooks/usePageSeo";
import { telHref, waMeUrl } from "@/lib/contactLinks";
import { mapsDirectionsHref, mapsEmbedSrc } from "@/lib/dealerMap";

const MOBILE_REGEX = /^[6-9]\d{9}$/;

const getLocalISODate = () => {
  // Returns YYYY-MM-DD in the user's local timezone.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const ContactPage = () => {
  const { dealer, siteConfig } = usePublicSite();
  const { getToken } = usePublicFormRecaptcha();
  usePageSeo({
    title: "Contact Patliputra VinFast | Patna Showroom | Bihar",
    description:
      "Contact Patliputra VinFast in Patna — phone, WhatsApp, map and enquiry form for VinFast EV sales and test drives.",
    keywords: ["contact VinFast Patna", "Patliputra VinFast phone", "VinFast showroom Patna"],
    canonical: "/contact",
  });
  const address = dealer.address;
  const mapLink = mapsDirectionsHref(address, dealer.mapEmbedUrl);
  const embedSrc = mapsEmbedSrc(address, dealer.mapEmbedUrl);
  const tel = telHref(siteConfig.phoneNumber || dealer.phone);
  const wa = waMeUrl(siteConfig.whatsappNumber || dealer.whatsapp);

  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    city: BIHAR_DEFAULT_DISTRICT,
    otherCity: "",
    model: "VF 7",
    variant: DEFAULT_VF7_TRIM,
    interest: "General Enquiry",
    message: "",
  });
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [waToken, setWaToken] = useState<string | null>(null);
  const onWaTokenChange = useCallback((t: string | null) => setWaToken(t), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) {
      toast.error("Please fill name and mobile number.");
      return;
    }
    const mobileDigits = formData.mobile.replace(/\D/g, "").slice(0, 10);
    if (hasApi() && !MOBILE_REGEX.test(mobileDigits)) {
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
      toast.error(
        "Please verify your mobile number with the WhatsApp code we send you.",
      );
      return;
    }
    const cityResolved = resolvedDistrictLabel(
      formData.city,
      formData.otherCity,
    );

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
          interest: "General Enquiry",
          message: "",
        });
        setCaptchaResetSignal((n) => n + 1);
        return;
      }
      let enquiryToken: string | undefined;
      let leadToken: string | undefined;
      try {
        enquiryToken = await getToken("contact_enquiry");
        leadToken = await getToken("contact_lead");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Security verification failed.",
        );
        return;
      }
      try {
        const enquiryRes = await submitPublicEnquiry({
          name: formData.name,
          mobile: mobileDigits,
          email: formData.email,
          city: cityResolved,
          model: formData.model,
          variant: formData.variant,
          interest: formData.interest,
          message: formData.message,
          recaptchaToken: enquiryToken,
          whatsappVerificationToken: waToken ?? undefined,
        });
        const leadRes = await submitPublicLead({
          name: formData.name,
          mobile: mobileDigits,
          city:
            formData.city === DISTRICT_OTHER ? DISTRICT_OTHER : formData.city,
          otherCity: formData.city === DISTRICT_OTHER ? formData.otherCity : "",
          modelDisplay: leadModelLabel(formData.model, formData.variant),
          source: "Website",
          interest: formData.interest,
          email: formData.email,
          remarks: formData.message.trim() || `Interest: ${formData.interest}`,
          pageSource: "Contact Page",
          recaptchaToken: leadToken,
          whatsappVerificationToken: waToken ?? undefined,
        });
        toast.success(
          leadRes.message ||
            enquiryRes.message ||
            "Our EV advisor will get in touch with you shortly.",
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
        interest: "General Enquiry",
        message: "",
      });
      setCaptchaResetSignal((n) => n + 1);
      return;
    }

    try {
      const todayStr = getLocalISODate();
      const ts = Date.now();
      const enquiry: Enquiry = {
        id: `WE_${ts}`,
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        email: formData.email.trim(),
        type: formData.interest,
        message: formData.message.trim(),
        status: "Open",
        createdAt: todayStr,
      };
      addEnquiry(enquiry);
      const lead: Lead = {
        id: `WL_${ts}`,
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        email: formData.email.trim(),
        city: cityResolved,
        model: leadModelLabel(formData.model, formData.variant),
        source: "Website",
        status: "New Lead",
        assignedTo: "",
        createdAt: todayStr,
        nextFollowUp: "",
        remarks: formData.message.trim() || `Interest: ${formData.interest}`,
        financeNeeded: false,
        exchangeNeeded: false,
      };
      addLead(lead);
    } catch {
      toast.error(
        "Could not save your enquiry (storage blocked or full). Please call or WhatsApp us.",
      );
      return;
    }

    toast.success("Our EV advisor will get in touch with you shortly.");
    setFormData({
      name: "",
      mobile: "",
      email: "",
      city: BIHAR_DEFAULT_DISTRICT,
      otherCity: "",
      model: "VF 7",
      variant: DEFAULT_VF7_TRIM,
      interest: "General Enquiry",
      message: "",
    });
    setCaptchaResetSignal((n) => n + 1);
  };

  const update = (field: string, value: string) =>
    setFormData({ ...formData, [field]: value });
  const inputClass =
    "h-12 px-4 rounded-xl bg-background/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full";

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />
      <div className="pt-24 pb-20 lg:pt-32 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <p className="text-primary font-display font-semibold text-sm uppercase tracking-[0.2em] mb-3">
              Get in Touch
            </p>
            <h1 className="font-display font-bold text-4xl md:text-5xl mb-4">
              Contact Us
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Visit our showroom, call us, or fill the form below. We're here to
              help you go electric.
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="glass-card p-5 sm:p-8">
                <h3 className="font-display font-bold text-xl mb-6">
                  Visit us
                </h3>
                <div className="space-y-4">
                  {[
                    { icon: MapPin, text: address, href: mapLink },
                    {
                      icon: Phone,
                      text: siteConfig.phoneNumber || dealer.phone,
                      href: tel,
                    },
                    {
                      icon: Mail,
                      text: dealer.email,
                      href: `mailto:${dealer.email}`,
                    },
                    { icon: Clock, text: dealer.showroomHours },
                  ].map((item) => {
                    const Icon = item.icon;
                    const content = (
                      <div className="flex gap-4">
                        <Icon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-foreground/80 text-sm">
                          {item.text}
                        </span>
                      </div>
                    );
                    return item.href ? (
                      <a
                        key={item.text}
                        href={item.href}
                        target={
                          item.href.startsWith("http") ? "_blank" : undefined
                        }
                        rel={
                          item.href.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                        className="block hover:opacity-80 transition-opacity"
                      >
                        {content}
                      </a>
                    ) : (
                      <div key={item.text}>{content}</div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-card p-8 aspect-video rounded-2xl overflow-hidden">
                <iframe
                  src={embedSrc}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  title={`${dealer.dealerName} showroom location`}
                  className="rounded-xl"
                />
              </div>

              <div className="flex gap-3">
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="whatsapp" size="lg" className="w-full">
                    <MessageCircle className="w-5 h-5" /> WhatsApp Us
                  </Button>
                </a>
                <a href={tel} className="flex-1">
                  <Button variant="outline" size="lg" className="w-full">
                    <Phone className="w-5 h-5" /> Call Now
                  </Button>
                </a>
              </div>
            </motion.div>

            {/* Form */}
            <motion.form
              id="contact-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleSubmit}
              className="glass-card p-5 sm:p-8 scroll-mt-24"
            >
              <h3 className="font-display font-bold text-xl mb-2">
                Send an Enquiry
              </h3>
              {hasApi() && (
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Submissions go to our CRM and trigger an email alert to your
                  dealership team when outgoing mail is configured on the
                  server.
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
                <input
                  type="tel"
                  placeholder="Mobile Number *"
                  value={formData.mobile}
                  onChange={(e) => update("mobile", e.target.value)}
                  className={inputClass}
                />
                <input
                  type="email"
                  placeholder="Email (Optional)"
                  value={formData.email}
                  onChange={(e) => update("email", e.target.value)}
                  className={inputClass}
                />
                {hasApi() && siteConfig.features?.whatsappOtp && (
                  <WhatsAppOtpVerify
                    mobile={formData.mobile.replace(/\D/g, "").slice(0, 10)}
                    displayName={formData.name.trim() || "Customer"}
                    recaptchaAction="contact_whatsapp_otp"
                    enabled
                    onTokenChange={onWaTokenChange}
                  />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="flex min-w-0 w-full flex-col gap-2">
                    <label
                      htmlFor="contact-model-trim"
                      className="text-xs font-medium text-muted-foreground"
                    >
                      Model &amp; trim
                    </label>
                    <ModelTrimSelect
                      id="contact-model-trim"
                      model={formData.model}
                      variant={formData.variant}
                      onChange={(m, v) =>
                        setFormData({ ...formData, model: m, variant: v })
                      }
                      className={inputClass}
                      includeNotSureBoth
                    />
                  </div>
                  <BiharDistrictField
                    id="contact-district"
                    label="District (Bihar)"
                    selectClassName={inputClass}
                    otherInputClassName={`${inputClass} border-primary/50`}
                    value={formData.city}
                    otherValue={formData.otherCity}
                    onDistrictChange={(city) =>
                      setFormData({ ...formData, city, otherCity: "" })
                    }
                    onOtherChange={(otherCity) =>
                      setFormData({ ...formData, otherCity })
                    }
                    fullWidthOtherRow
                    otherFieldLabel="City / state / district *"
                  />
                </div>
                <select
                  value={formData.interest}
                  onChange={(e) => update("interest", e.target.value)}
                  className={inputClass}
                >
                  <option value="General Enquiry">General Enquiry</option>
                  <option value="Get On-Road Price">Get On-Road Price</option>
                  <option value="Book Test Drive">Book Test Drive</option>
                  <option value="Finance Support">Finance Support</option>
                  <option value="Exchange Car">Exchange Car</option>
                  <option value="Corporate/Fleet">Corporate / Fleet</option>
                  <option value="Service">Service & Support</option>
                </select>
                <textarea
                  placeholder="Your Message (Optional)"
                  value={formData.message}
                  onChange={(e) => update("message", e.target.value)}
                  className={`${inputClass} h-24 py-3 resize-none`}
                />
                <FormCaptcha
                  onVerifyChange={setCaptchaVerified}
                  resetSignal={captchaResetSignal}
                />
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={Boolean(
                    hasApi() && siteConfig.features?.whatsappOtp && !waToken,
                  )}
                >
                  Submit Enquiry
                </Button>
                <p className="text-center text-muted-foreground text-xs">
                  We respect your privacy. No spam, ever.
                </p>
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

export default ContactPage;
