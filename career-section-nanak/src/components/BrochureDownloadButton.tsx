import { useCallback, useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { addLead } from "@/lib/vfLocalStorage";
import type { Lead } from "@/data/mockData";
import { hasApi, isPublicFormPostDisabled, PUBLIC_FORM_POST_DISABLED_MESSAGE } from "@/lib/apiConfig";
import { formatApiErrors } from "@/lib/api";
import { submitPublicLead } from "@/lib/publicFormsApi";
import { leadModelLabel } from "@/data/vinfastModels";
import { BiharDistrictField } from "@/components/BiharDistrictField";
import { FormCaptcha } from "@/components/FormCaptcha";
import { BIHAR_DEFAULT_DISTRICT, DISTRICT_OTHER } from "@/data/biharDistricts";
import { usePublicFormRecaptcha } from "@/context/PublicRecaptchaContext";
import { usePublicSite } from "@/context/PublicSiteContext";
import { WhatsAppOtpVerify } from "@/components/WhatsAppOtpVerify";

const MOBILE_REGEX = /^[6-9]\d{9}$/;

const getLocalISODate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

function triggerBrochureDownload(href: string, downloadFileName: string) {
  const a = document.createElement("a");
  a.href = href;
  a.setAttribute("download", downloadFileName);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export type BrochureDownloadButtonProps = Omit<ButtonProps, "type" | "onClick" | "asChild"> & {
  brochureHref: string;
  downloadFileName: string;
  /** e.g. "VF 7", "VF 6", "VF MPV 7" */
  modelDisplay: string;
  pageSource: string;
};

export function BrochureDownloadButton({
  brochureHref,
  downloadFileName,
  modelDisplay,
  pageSource,
  children,
  disabled,
  ...buttonProps
}: BrochureDownloadButtonProps) {
  const { siteConfig } = usePublicSite();
  const { getToken } = usePublicFormRecaptcha();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState(BIHAR_DEFAULT_DISTRICT);
  const [otherCity, setOtherCity] = useState("");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [waToken, setWaToken] = useState<string | null>(null);
  const onWaTokenChange = useCallback((t: string | null) => setWaToken(t), []);

  useEffect(() => {
    if (!open) {
      setName("");
      setMobile("");
      setEmail("");
      setCity(BIHAR_DEFAULT_DISTRICT);
      setOtherCity("");
      setSubmitting(false);
      setCaptchaResetSignal((n) => n + 1);
      setWaToken(null);
    }
  }, [open]);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (!mobile || !MOBILE_REGEX.test(mobile)) {
      toast.error("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (city === DISTRICT_OTHER && !otherCity.trim()) {
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

    const cityVal = city === DISTRICT_OTHER ? DISTRICT_OTHER : city;
    const modelLine = leadModelLabel(modelDisplay, "");
    const remarks = `Brochure: ${downloadFileName}`;

    setSubmitting(true);
    try {
      if (hasApi()) {
        if (isPublicFormPostDisabled()) {
          triggerBrochureDownload(brochureHref, downloadFileName);
          toast.info(PUBLIC_FORM_POST_DISABLED_MESSAGE);
          setOpen(false);
          return;
        }
        let recaptchaToken: string | undefined;
        try {
          recaptchaToken = await getToken("brochure_download");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Security verification failed.");
          return;
        }
        const res = await submitPublicLead({
          name: name.trim(),
          mobile,
          city: cityVal,
          otherCity: city === DISTRICT_OTHER ? otherCity : "",
          email: email.trim() || undefined,
          modelDisplay: modelLine,
          source: "Website",
          interest: "Brochure download",
          remarks,
          pageSource,
          recaptchaToken,
          whatsappVerificationToken: waToken ?? undefined,
        });
        triggerBrochureDownload(brochureHref, downloadFileName);
        toast.success(
          res.message ?? "Your brochure download has started. We'll be in touch soon.",
        );
        setOpen(false);
      } else {
        try {
          const todayStr = getLocalISODate();
          const ts = Date.now();
          const resolvedCity = city === DISTRICT_OTHER ? otherCity.trim() || DISTRICT_OTHER : city;
          const lead: Lead = {
            id: `WL_${ts}`,
            name: name.trim(),
            mobile,
            email: email.trim(),
            city: resolvedCity,
            model: modelLine,
            source: "Website",
            status: "New Lead",
            assignedTo: "",
            createdAt: todayStr,
            nextFollowUp: "",
            remarks,
            financeNeeded: false,
            exchangeNeeded: false,
          };
          addLead(lead);
        } catch {
          toast.error("Could not save your details. Please try again or contact us by phone.");
          return;
        }
        triggerBrochureDownload(brochureHref, downloadFileName);
        toast.success("Your brochure download has started. We'll be in touch soon.");
        setOpen(false);
      }
    } catch (err) {
      toast.error(formatApiErrors(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "h-11 px-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full";

  return (
    <>
      <Button type="button" disabled={disabled} onClick={() => setOpen(true)} {...buttonProps}>
        {children}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Download brochure</DialogTitle>
            <DialogDescription>
              Enter your details to download the {modelDisplay} brochure. We&apos;ll save this as a lead so our team can follow up if you need help.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="brochure-name" className="text-xs font-medium text-foreground/80 mb-1 block">
                Full name <span className="text-primary">*</span>
              </label>
              <input
                id="brochure-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="brochure-mobile" className="text-xs font-medium text-foreground/80 mb-1 block">
                Mobile <span className="text-primary">*</span>
              </label>
              <input
                id="brochure-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={mobile}
                onChange={handleMobileChange}
                className={inputClass}
                placeholder="10-digit mobile"
              />
            </div>
            <div>
              <label htmlFor="brochure-email" className="text-xs font-medium text-foreground/80 mb-1 block">
                Email (optional)
              </label>
              <input
                id="brochure-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>
            {hasApi() && siteConfig.features?.whatsappOtp && (
              <WhatsAppOtpVerify
                mobile={mobile.replace(/\D/g, "").slice(0, 10)}
                displayName={name.trim() || "Customer"}
                recaptchaAction="brochure_whatsapp_otp"
                enabled
                onTokenChange={onWaTokenChange}
              />
            )}
            <BiharDistrictField
              label="District (Bihar)"
              selectClassName={inputClass}
              otherInputClassName={`${inputClass} border-primary/50`}
              value={city}
              otherValue={otherCity}
              onDistrictChange={(c) => {
                setCity(c);
                setOtherCity("");
              }}
              onOtherChange={setOtherCity}
            />
            <FormCaptcha onVerifyChange={setCaptchaVerified} resetSignal={captchaResetSignal} />

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="hero"
                disabled={
                  submitting ||
                  Boolean(hasApi() && siteConfig.features?.whatsappOtp && !waToken)
                }
              >
                {submitting ? "Saving…" : "Download PDF"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
