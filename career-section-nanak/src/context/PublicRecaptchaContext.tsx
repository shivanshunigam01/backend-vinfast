import { createContext, useCallback, useContext, type ReactNode } from "react";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() ?? "";

type PublicRecaptchaContextValue = {
  /** Returns a v3 token when the site key is configured; otherwise `undefined`. Throws if script is not ready. */
  getToken: (action: string) => Promise<string | undefined>;
};

const PublicRecaptchaContext = createContext<PublicRecaptchaContextValue>({
  getToken: async () => undefined,
});

function RecaptchaInner({ children }: { children: ReactNode }) {
  const { executeRecaptcha } = useGoogleReCaptcha();

  const getToken = useCallback(
    async (action: string) => {
      if (!executeRecaptcha) {
        throw new Error("Security check is still loading. Please wait a moment and try again.");
      }
      const token = await executeRecaptcha(action);
      if (!token?.trim()) {
        throw new Error("Could not complete security verification. Please try again.");
      }
      return token;
    },
    [executeRecaptcha],
  );

  return <PublicRecaptchaContext.Provider value={{ getToken }}>{children}</PublicRecaptchaContext.Provider>;
}

/**
 * Loads Google reCAPTCHA v3 when `VITE_RECAPTCHA_SITE_KEY` is set.
 * Pair with `RECAPTCHA_SECRET_KEY` on the API (`/leads`, `/test-drives`, `/enquiries`).
 */
export function PublicRecaptchaProvider({ children }: { children: ReactNode }) {
  if (!SITE_KEY) {
    return (
      <PublicRecaptchaContext.Provider value={{ getToken: async () => undefined }}>
        {children}
      </PublicRecaptchaContext.Provider>
    );
  }

  return (
    <GoogleReCaptchaProvider reCaptchaKey={SITE_KEY} scriptProps={{ async: true, defer: true }}>
      <RecaptchaInner>{children}</RecaptchaInner>
    </GoogleReCaptchaProvider>
  );
}

export function usePublicFormRecaptcha(): PublicRecaptchaContextValue {
  return useContext(PublicRecaptchaContext);
}
