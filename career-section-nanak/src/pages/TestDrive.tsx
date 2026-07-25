import { useCallback, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import { toast } from "sonner";
import { CalendarDays, Calendar as CalendarIcon, MapPin, Car, Clock, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { addLead, addTestDriveBooking } from "@/lib/vfLocalStorage";
import type { Lead, TestDriveBooking } from "@/data/mockData";
import { hasApi, isPublicFormPostDisabled, PUBLIC_FORM_POST_DISABLED_MESSAGE } from "@/lib/apiConfig";
import { formatApiErrors } from "@/lib/api";
import { submitPublicTestDrive } from "@/lib/publicFormsApi";
import { DEFAULT_VF7_TRIM, leadModelLabel } from "@/data/vinfastModels";
import { useVehicleCatalog } from "@/hooks/useVehicleCatalog";
import { FormCaptcha } from "@/components/FormCaptcha";
import { BiharDistrictField } from "@/components/BiharDistrictField";
import {
  BIHAR_DEFAULT_DISTRICT,
  DISTRICT_OTHER,
  resolvedDistrictLabel,
} from "@/data/biharDistricts";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  OWNS_CAR_OPTIONS,
  PURCHASE_TIMELINE_OPTIONS,
  TEST_DRIVE_LOCATION_OPTIONS,
} from "@/data/testDriveFormOptions";
import { usePublicFormRecaptcha } from "@/context/PublicRecaptchaContext";
import { usePublicSite } from "@/context/PublicSiteContext";
import { WhatsAppOtpVerify } from "@/components/WhatsAppOtpVerify";
import { TestDriveSlotPicker } from "@/components/TestDriveSlotPicker";
import { formatSlotLabel } from "@/lib/publicTdApi";
import { telHref } from "@/lib/contactLinks";
import vf7Driving from "@/assets/slide-vf7-driving.png";
import vf6Hero from "@/assets/vf6-earth-hero-family.png";
import vf7Interior from "@/assets/slide-vf7-interior.png";
import vf7Real from "@/assets/vf7-real.png";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const HOME_TEST_DRIVE_OPTION = "Home Test Drive";
const DEALERSHIP_VISIT_OPTION = "Dealership Visit";

/** First calendar day of each month that accepts test-drive bookings (days 1–9 are blocked). */
const MIN_TEST_DRIVE_DAY_OF_MONTH = 10;

function isTestDriveBookableDate(d: Date): boolean {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (start < todayStart) return false;
  if (d.getDate() < MIN_TEST_DRIVE_DAY_OF_MONTH) return false;
  return true;
}

function toISODateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const getLocalISODate = () => {
  // Returns YYYY-MM-DD in the user's local timezone (safe for <input type="date">).
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <span className="font-display text-sm font-semibold text-foreground pt-1">{title}</span>
      </div>
      {children}
    </div>
  );
}

const TestDrivePage = () => {
  const { getToken } = usePublicFormRecaptcha();
  const { siteConfig, dealer } = usePublicSite();
  const vehicleCatalog = useVehicleCatalog();
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    city: BIHAR_DEFAULT_DISTRICT,
    otherCity: "",
    model: "VF 7",
    variant: DEFAULT_VF7_TRIM,
    preferredTestDriveLocation: "",
    ownsCar: "",
    currentCarDetails: "",
    purchaseTimeline: "",
    date: "",
    time: "",
    remarks: "",
  });
  const [mobileError, setMobileError] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [waToken, setWaToken] = useState<string | null>(null);
  const onWaTokenChange = useCallback((t: string | null) => setWaToken(t), []);
  const todayStr = getLocalISODate();
  const selectedCalendarDate = formData.date
    ? new Date(`${formData.date}T12:00:00`)
    : undefined;
  const homeTestDriveAllowed = formData.city !== DISTRICT_OTHER;
  const useLiveSlots = hasApi();
  const otpRequired = hasApi() && Boolean(siteConfig.features?.whatsappOtp);

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
    if (!formData.date) {
      toast.error("Please select a preferred date.");
      return;
    }
    if (!formData.time) {
      toast.error("Please select a preferred time slot.");
      return;
    }

    const selected = new Date(`${formData.date}T12:00:00`);
    if (Number.isNaN(selected.getTime())) {
      toast.error("Please select a valid preferred date.");
      return;
    }
    if (!isTestDriveBookableDate(selected)) {
      toast.error(
        `Test drives can be booked from the ${MIN_TEST_DRIVE_DAY_OF_MONTH}th of each month onward (past dates are not allowed).`,
      );
      return;
    }
    if (formData.city === DISTRICT_OTHER && !formData.otherCity.trim()) {
      toast.error("Please enter your city or district (outside Bihar).");
      return;
    }
    if (!formData.preferredTestDriveLocation) {
      toast.error("Please choose a preferred test drive location.");
      return;
    }
    if (!formData.ownsCar) {
      toast.error("Please answer whether you currently own a car.");
      return;
    }
    if (formData.ownsCar === "Yes" && !formData.currentCarDetails.trim()) {
      toast.error("Please enter your current car (model / brand).");
      return;
    }
    if (!formData.purchaseTimeline) {
      toast.error("Please select when you are planning to purchase.");
      return;
    }
    if (otpRequired && !waToken) {
      toast.error("Please verify your mobile number with the WhatsApp code before booking.");
      return;
    }

    const modelLine = leadModelLabel(formData.model, formData.variant);
    const cityResolved = resolvedDistrictLabel(formData.city, formData.otherCity);

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
          preferredTestDriveLocation: "",
          ownsCar: "",
          currentCarDetails: "",
          purchaseTimeline: "",
          date: "",
          time: "",
          remarks: "",
        });
        setMobileError("");
        setCaptchaResetSignal((n) => n + 1);
        return;
      }
      let recaptchaToken: string | undefined;
      try {
        recaptchaToken = await getToken("test_drive");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Security verification failed.");
        return;
      }
      try {
        const res = await submitPublicTestDrive({
          customerName: formData.name.trim(),
          mobile: formData.mobile,
          email: formData.email.trim(),
          city: cityResolved,
          model: formData.model,
          variant: formData.variant,
          preferredDate: formData.date,
          preferredTime: formData.time,
          branch: "Patna Showroom",
          remarks: formData.remarks?.trim()
            ? formData.remarks.trim()
            : `Preferred: ${formData.date} ${formatSlotLabel({ time: formData.time, available: true, bookings: 0, maxBookings: 1 })}`,
          pageSource: "Test Drive Page",
          preferredTestDriveLocation: formData.preferredTestDriveLocation,
          ownsCar: formData.ownsCar,
          currentCarDetails:
            formData.ownsCar === "Yes" ? formData.currentCarDetails.trim() : undefined,
          purchaseTimeline: formData.purchaseTimeline,
          recaptchaToken,
          whatsappVerificationToken: waToken ?? undefined,
        });
        toast.success(
          res.message ?? "Test drive booked! We'll confirm your slot shortly via SMS.",
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
        preferredTestDriveLocation: "",
        ownsCar: "",
        currentCarDetails: "",
        purchaseTimeline: "",
        date: "",
        time: "",
        remarks: "",
      });
      setMobileError("");
      setCaptchaResetSignal((n) => n + 1);
      return;
    }

    try {
      const leadId = `WL_${Date.now()}`;
      const tdMeta = [
        `TD location: ${formData.preferredTestDriveLocation}`,
        formData.ownsCar === "Yes"
          ? `Owns car: Yes — ${formData.currentCarDetails.trim()}`
          : "Owns car: No",
        `Purchase plan: ${formData.purchaseTimeline}`,
      ].join(" | ");
      const lead: Lead = {
        id: leadId,
        name: formData.name.trim(),
        mobile: formData.mobile,
        email: formData.email.trim(),
        city: cityResolved,
        model: modelLine,
        source: "Website",
        status: "Test Drive Scheduled",
        assignedTo: "",
        createdAt: todayStr,
        nextFollowUp: "",
        remarks: [
          "Test drive booking (website)",
          formData.remarks?.trim(),
          tdMeta,
          `Preferred: ${formData.date} ${formatSlotLabel({ time: formData.time, available: true, bookings: 0, maxBookings: 1 })}`,
        ]
          .filter(Boolean)
          .join(" | "),
        financeNeeded: false,
        exchangeNeeded: false,
      };

      const booking: TestDriveBooking = {
        id: `WTD_${Date.now()}`,
        leadId,
        customerName: formData.name.trim(),
        mobile: formData.mobile,
        model: modelLine,
        preferredDate: formData.date,
        preferredTime: formData.time,
        branch: "Patna Showroom",
        preferredTestDriveLocation: formData.preferredTestDriveLocation,
        ownsCar: formData.ownsCar,
        currentCarDetails:
          formData.ownsCar === "Yes" ? formData.currentCarDetails.trim() : "",
        purchaseTimeline: formData.purchaseTimeline,
        status: "Pending",
        assignedExecutive: "",
        feedback: "",
        createdAt: todayStr,
      };

      addLead(lead);
      addTestDriveBooking(booking);
    } catch {
      toast.error("Could not save your booking (storage blocked or full). Please call or WhatsApp us.");
      return;
    }

    toast.success("Test drive booked! We'll confirm your slot shortly via SMS.");
    setFormData({
      name: "",
      mobile: "",
      email: "",
      city: BIHAR_DEFAULT_DISTRICT,
      otherCity: "",
      model: "VF 7",
      variant: DEFAULT_VF7_TRIM,
      preferredTestDriveLocation: "",
      ownsCar: "",
      currentCarDetails: "",
      purchaseTimeline: "",
      date: "",
      time: "",
      remarks: "",
    });
    setMobileError("");
    setCaptchaResetSignal((n) => n + 1);
  };

  const update = (field: string, value: string) =>
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "ownsCar" && value !== "Yes" ? { currentCarDetails: "" } : {}),
    }));

  const handleDateChange = useCallback((d: string) => {
    setFormData((prev) => ({ ...prev, date: d, time: "" }));
  }, []);

  const handleTimeChange = useCallback((t: string) => {
    setFormData((prev) => ({ ...prev, time: t }));
  }, []);

  const inputClass =
    "h-11 px-3.5 rounded-xl bg-background/50 border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full min-w-0";
  const labelClass = "text-xs font-medium text-muted-foreground";
  const fieldBlockClass = "flex flex-col gap-1.5 min-w-0";
  const tel = telHref(siteConfig.phoneNumber || dealer.phone);

  return (
    <div className="min-h-screen bg-background pb-36 lg:pb-0">
      <Navbar />

      {/* Mobile hero band */}
      <div className="relative lg:hidden pt-[4.25rem]">
        <div className="relative h-44 sm:h-52 overflow-hidden">
          <img
            src={vf7Driving}
            alt="VinFast test drive"
            className="image-high-quality absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/25" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-center">
            <p className="text-primary font-display font-semibold text-xs uppercase tracking-[0.2em] mb-1">
              Test Drive
            </p>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-foreground">Experience the Future</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
              Book a complimentary drive with live showroom slots.
            </p>
          </div>
        </div>
      </div>

      <div className="pt-6 pb-36 lg:pt-28 lg:pb-16">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-8 sm:gap-10 lg:gap-10 items-start">
            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="order-2 lg:order-1 lg:sticky lg:top-28 lg:self-start lg:rounded-2xl lg:border lg:border-border/50 lg:bg-gradient-to-br lg:from-primary/[0.05] lg:via-muted/25 lg:to-background lg:p-5 lg:shadow-sm space-y-5 lg:space-y-4"
            >
              <div className="hidden lg:block shrink-0">
                <p className="text-primary font-display font-semibold text-xs uppercase tracking-[0.2em] mb-2">
                  Test Drive
                </p>
                <h1 className="font-display font-bold text-3xl xl:text-[2.15rem] mb-2 leading-tight">
                  Experience the Future
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Live showroom slots · complimentary drive at Patliputra VinFast.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:gap-2.5 shrink-0">
                {[
                  { src: vf7Driving, alt: "VinFast VF 7 on the road" },
                  { src: vf7Interior, alt: "VF 7 premium cabin" },
                ].map((img) => (
                  <div
                    key={img.alt}
                    className="relative aspect-[4/3] lg:aspect-[16/11] rounded-xl overflow-hidden border border-border/60 shadow-sm"
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className="image-high-quality absolute inset-0 h-full w-full object-cover"
                      sizes="(max-width: 1024px) 45vw, 240px"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>

              {/* Mobile-only extra gallery */}
              <div className="grid grid-cols-2 gap-2 lg:hidden">
                {[
                  { src: vf6Hero, alt: "VinFast VF 6 family drive" },
                  { src: vf7Real, alt: "VinFast VF 7 exterior" },
                ].map((img) => (
                  <div key={img.alt} className="relative aspect-[4/3] rounded-xl overflow-hidden border border-border/60">
                    <img src={img.src} alt={img.alt} className="image-high-quality absolute inset-0 h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-3 shrink-0">
                {[
                  { icon: Car, title: "Model", desc: "VF 6 or VF 7" },
                  { icon: CalendarDays, title: "Date", desc: `From ${MIN_TEST_DRIVE_DAY_OF_MONTH}th` },
                  { icon: MapPin, title: "Location", desc: "Showroom / home" },
                ].map((step) => {
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.title}
                      className="flex flex-col items-center text-center gap-1.5 rounded-xl border border-border/50 bg-background/60 p-2.5 lg:p-2"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-xs font-semibold">{step.title}</h3>
                        <p className="text-muted-foreground text-[10px] leading-snug hidden sm:block lg:block">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3.5 shrink-0">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-sm mb-0.5">Patliputra VinFast Patna</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 lg:line-clamp-3">{dealer.address}</p>
                    <a href={tel} className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline mt-1.5">
                      <Phone className="h-3 w-3" />
                      Call to book instantly
                    </a>
                  </div>
                </div>
              </div>

              <p className="hidden lg:flex shrink-0 text-xs text-muted-foreground items-center gap-2">
                <Car className="w-3.5 h-3.5 shrink-0 text-primary" />
                <span>
                  Ready to buy? Use <strong>Book Now</strong> in the top menu to start Pre-Booking.
                </span>
              </p>
            </motion.aside>

            <motion.form
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onSubmit={handleSubmit}
              className="order-1 lg:order-2 glass-card min-w-0 p-4 sm:p-6 lg:p-7"
            >
              <h3 className="font-display font-bold text-lg sm:text-xl mb-0.5">Schedule your test drive</h3>
              <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed mb-5">
                {`Slots from the ${MIN_TEST_DRIVE_DAY_OF_MONTH}th of each month.`}
                {hasApi() ? " Syncs to CRM." : null}
              </p>

              <div className="space-y-4 lg:space-y-3.5">
                <FormSection title="Your details">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={fieldBlockClass}>
                      <label htmlFor="td-name" className={labelClass}>
                        Full name *
                      </label>
                      <input
                        id="td-name"
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={(e) => update("name", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className={fieldBlockClass}>
                      <label htmlFor="td-mobile" className={labelClass}>
                        Mobile number *
                      </label>
                      <input
                        id="td-mobile"
                        type="tel"
                        placeholder="10-digit mobile"
                        value={formData.mobile}
                        onChange={handleMobileChange}
                        maxLength={10}
                        inputMode="numeric"
                        className={`${inputClass} ${mobileError ? "border-red-500 focus:ring-red-500/50" : ""}`}
                      />
                      {mobileError ? (
                        <p className="text-red-500 text-[11px] leading-tight">{mobileError}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className={fieldBlockClass}>
                    <label htmlFor="td-email" className={labelClass}>
                      Email (optional)
                    </label>
                    <input
                      id="td-email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => update("email", e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  {otpRequired && (
                    <WhatsAppOtpVerify
                      mobile={formData.mobile.replace(/\D/g, "").slice(0, 10)}
                      displayName={formData.name.trim() || "Customer"}
                      recaptchaAction="test_drive_whatsapp_otp"
                      enabled
                      onTokenChange={onWaTokenChange}
                    />
                  )}
                </FormSection>

                <FormSection title="Vehicle & slot">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    <div className={fieldBlockClass}>
                      <label htmlFor="td-model" className={labelClass}>
                        Model *
                      </label>
                      <select
                        id="td-model"
                        value={vehicleCatalog.models.includes(formData.model) ? formData.model : vehicleCatalog.models[0] ?? ""}
                        onChange={(e) => {
                          const m = e.target.value;
                          setFormData({
                            ...formData,
                            model: m,
                            variant: vehicleCatalog.defaultVariantFor(m),
                            time: "",
                          });
                        }}
                        className={inputClass}
                      >
                        {vehicleCatalog.models.map((m) => (
                          <option key={m} value={m}>
                            VinFast {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={fieldBlockClass}>
                      <label htmlFor="td-variant" className={labelClass}>
                        Variant *
                      </label>
                      {vehicleCatalog.trimsFor(formData.model).length === 0 ? (
                        <input value="Single lineup — no variants" disabled className={inputClass} />
                      ) : (
                        <select
                          id="td-variant"
                          value={formData.variant}
                          onChange={(e) => setFormData({ ...formData, variant: e.target.value, time: "" })}
                          className={inputClass}
                        >
                          {vehicleCatalog.variantOptionsFor(formData.model).map((label) => (
                            <option key={label} value={label}>
                              {label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {useLiveSlots ? (
                    <TestDriveSlotPicker
                      model={formData.model}
                      variant={formData.variant}
                      date={formData.date}
                      time={formData.time}
                      onDateChange={handleDateChange}
                      onTimeChange={handleTimeChange}
                      minBookableDay={MIN_TEST_DRIVE_DAY_OF_MONTH}
                      isDateBookable={isTestDriveBookableDate}
                      toISODateString={toISODateString}
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      <div className={fieldBlockClass}>
                        <span id="td-date-label" className={labelClass}>
                          Preferred date *
                        </span>
                        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              aria-labelledby="td-date-label"
                              className={cn(
                                "h-11 w-full min-w-0 justify-start text-left font-normal rounded-xl border-border bg-background/50 px-3.5",
                                !formData.date && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                              <span className="truncate">
                                {formData.date
                                  ? format(new Date(`${formData.date}T12:00:00`), "dd MMM yyyy")
                                  : "Pick date"}
                              </span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedCalendarDate}
                              onSelect={(d) => {
                                if (!d) return;
                                if (!isTestDriveBookableDate(d)) return;
                                update("date", toISODateString(d));
                                setDatePickerOpen(false);
                              }}
                              disabled={(date) => !isTestDriveBookableDate(date)}
                              defaultMonth={selectedCalendarDate ?? new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className={fieldBlockClass}>
                        <label htmlFor="td-time" className={labelClass}>
                          Preferred time *
                        </label>
                        <select
                          id="td-time"
                          value={formData.time}
                          onChange={(e) => update("time", e.target.value)}
                          className={inputClass}
                        >
                          <option value="">Select time</option>
                          <option value="10:00">10:00 AM</option>
                          <option value="11:00">11:00 AM</option>
                          <option value="12:00">12:00 PM</option>
                          <option value="14:00">02:00 PM</option>
                          <option value="15:00">03:00 PM</option>
                          <option value="16:00">04:00 PM</option>
                          <option value="17:00">05:00 PM</option>
                        </select>
                      </div>
                    </div>
                  )}
                </FormSection>

                <FormSection title="Location & preferences">
                  <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
                    <div className="space-y-2">
                      <BiharDistrictField
                        id="td-district"
                        label="District (Bihar) *"
                        selectClassName={inputClass}
                        otherInputClassName={`${inputClass} border-primary/50`}
                        value={formData.city}
                        otherValue={formData.otherCity}
                        onDistrictChange={(city) => {
                          const allowHome = city !== DISTRICT_OTHER;
                          setFormData((prev) => ({
                            ...prev,
                            city,
                            otherCity: "",
                            preferredTestDriveLocation:
                              !allowHome && prev.preferredTestDriveLocation === HOME_TEST_DRIVE_OPTION
                                ? DEALERSHIP_VISIT_OPTION
                                : prev.preferredTestDriveLocation,
                          }));
                          if (!allowHome && formData.preferredTestDriveLocation === HOME_TEST_DRIVE_OPTION) {
                            toast.info("Home Test Drive is available across Bihar. Outside Bihar, please choose Dealership Visit.");
                          }
                        }}
                        onOtherChange={(otherCity) => setFormData({ ...formData, otherCity })}
                        fullWidthOtherRow
                        otherFieldLabel="City / state / district *"
                      />
                      {homeTestDriveAllowed ? (
                        <p className="text-emerald-600 text-[11px] leading-relaxed">
                          Bihar — home test drives available in your district.
                        </p>
                      ) : (
                        <p className="text-amber-600 text-[11px] leading-relaxed">
                          Outside Bihar — choose Dealership Visit.
                        </p>
                      )}
                    </div>

                    <div className={fieldBlockClass}>
                      <span className={labelClass}>Test drive location *</span>
                      <RadioGroup
                        value={formData.preferredTestDriveLocation}
                        onValueChange={(v) => {
                          if (!homeTestDriveAllowed && v === HOME_TEST_DRIVE_OPTION) {
                            toast.info("Home Test Drive is available across Bihar. Outside Bihar, please select Dealership Visit.");
                            update("preferredTestDriveLocation", DEALERSHIP_VISIT_OPTION);
                            return;
                          }
                          update("preferredTestDriveLocation", v);
                        }}
                        className="grid gap-2"
                      >
                        {TEST_DRIVE_LOCATION_OPTIONS.map((opt) => (
                          <div
                            key={opt}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                              !homeTestDriveAllowed && opt === HOME_TEST_DRIVE_OPTION
                                ? "border-border/40 bg-muted/40 opacity-60"
                                : "border-border/60 bg-background/30"
                            }`}
                          >
                            <RadioGroupItem
                              value={opt}
                              id={`td-loc-${opt.replace(/\s+/g, "-")}`}
                              disabled={!homeTestDriveAllowed && opt === HOME_TEST_DRIVE_OPTION}
                            />
                            <Label
                              htmlFor={`td-loc-${opt.replace(/\s+/g, "-")}`}
                              className={`text-xs sm:text-sm font-normal leading-snug ${
                                !homeTestDriveAllowed && opt === HOME_TEST_DRIVE_OPTION
                                  ? "cursor-not-allowed text-muted-foreground"
                                  : "cursor-pointer"
                              }`}
                            >
                              {opt}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={fieldBlockClass}>
                      <span className={labelClass}>Own a car? *</span>
                      <RadioGroup
                        value={formData.ownsCar}
                        onValueChange={(v) => update("ownsCar", v)}
                        className="flex flex-wrap gap-2"
                      >
                        {OWNS_CAR_OPTIONS.map((opt) => (
                          <div
                            key={opt}
                            className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/30 px-3 py-2"
                          >
                            <RadioGroupItem value={opt} id={`td-own-${opt}`} />
                            <Label htmlFor={`td-own-${opt}`} className="text-xs sm:text-sm font-normal cursor-pointer">
                              {opt}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className={fieldBlockClass}>
                      <span className={labelClass}>Purchase timeline *</span>
                      <RadioGroup
                        value={formData.purchaseTimeline}
                        onValueChange={(v) => update("purchaseTimeline", v)}
                        className="grid grid-cols-2 gap-1.5"
                      >
                        {PURCHASE_TIMELINE_OPTIONS.map((opt, i) => (
                          <div
                            key={opt}
                            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/30 px-2 py-1.5"
                          >
                            <RadioGroupItem value={opt} id={`td-buy-${i}`} className="h-3.5 w-3.5" />
                            <Label htmlFor={`td-buy-${i}`} className="text-[10px] sm:text-xs font-normal cursor-pointer leading-snug">
                              {opt}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>

                  {formData.ownsCar === "Yes" ? (
                    <div className={fieldBlockClass}>
                      <label htmlFor="td-current-car" className={labelClass}>
                        Current car (model / brand) *
                      </label>
                      <input
                        id="td-current-car"
                        type="text"
                        placeholder="e.g. Honda City, Maruti Swift"
                        value={formData.currentCarDetails}
                        onChange={(e) => update("currentCarDetails", e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  ) : null}

                  <div className={fieldBlockClass}>
                    <label htmlFor="td-remarks" className={labelClass}>
                      Remarks (optional)
                    </label>
                    <textarea
                      id="td-remarks"
                      placeholder="Any special requests…"
                      value={formData.remarks}
                      onChange={(e) => update("remarks", e.target.value)}
                      className={`${inputClass} h-16 py-2 resize-none`}
                    />
                  </div>
                </FormSection>

                <FormCaptcha onVerifyChange={() => {}} resetSignal={captchaResetSignal} />
                <Button
                  type="submit"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  disabled={otpRequired && !waToken}
                >
                  Confirm Test Drive
                </Button>
                {otpRequired && !waToken ? (
                  <p className="text-center text-amber-600 text-[11px]">
                    Verify your mobile number with the WhatsApp code above to enable booking.
                  </p>
                ) : null}
                <p className="text-center text-muted-foreground text-[11px]">By submitting, you agree to our privacy policy.</p>
                <p className="text-center text-muted-foreground text-[11px] lg:hidden">
                  Ready to buy? Use Book Now in the menu for Pre-Booking.
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

export default TestDrivePage;
