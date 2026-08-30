import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Phone, MessageCircle, CalendarDays, ShoppingBag } from "lucide-react";
import { usePublicSite } from "@/context/PublicSiteContext";
import { telHref, waMeUrl } from "@/lib/contactLinks";
import { attributionFromPathname, buildCtaPath } from "@/lib/seoAttribution";

const MPV7_PREBOOK_SESSION_KEY = "vinfast_mpv7_prebook_unlocked";
const MPV7_PREBOOK_UNLOCK_EVENT = "vinfast-mpv7-prebook-unlock";
const LIMO_GREEN_PREBOOK_SESSION_KEY = "vinfast_limo_green_prebook_unlocked";
const LIMO_GREEN_PREBOOK_UNLOCK_EVENT = "vinfast-limo-green-prebook-unlock";

/** Show sticky bar only after the user scrolls past this offset (px). */
const STICKY_CTA_SCROLL_THRESHOLD = 48;

const StickyMobileCTA = () => {
  const location = useLocation();
  const { dealer, siteConfig } = usePublicSite();
  const tel = telHref(siteConfig.phoneNumber || dealer.phone);
  const wa = waMeUrl(siteConfig.whatsappNumber || dealer.whatsapp);
  const onMpv7Page = location.pathname === "/models/mpv7";
  const onLimoGreenPage = location.pathname === "/models/limo-green";
  const pathAttr = attributionFromPathname(location.pathname);
  const [mpv7PrebookUnlocked, setMpv7PrebookUnlocked] = useState(false);
  const [limoGreenPrebookUnlocked, setLimoGreenPrebookUnlocked] = useState(false);
  const [showBar, setShowBar] = useState(false);

  useEffect(() => {
    const sync = () => {
      setMpv7PrebookUnlocked(sessionStorage.getItem(MPV7_PREBOOK_SESSION_KEY) === "1");
      setLimoGreenPrebookUnlocked(sessionStorage.getItem(LIMO_GREEN_PREBOOK_SESSION_KEY) === "1");
    };
    sync();
    window.addEventListener(MPV7_PREBOOK_UNLOCK_EVENT, sync);
    window.addEventListener(LIMO_GREEN_PREBOOK_UNLOCK_EVENT, sync);
    return () => {
      window.removeEventListener(MPV7_PREBOOK_UNLOCK_EVENT, sync);
      window.removeEventListener(LIMO_GREEN_PREBOOK_UNLOCK_EVENT, sync);
    };
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => {
      setShowBar(window.scrollY >= STICKY_CTA_SCROLL_THRESHOLD);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname]);

  if (!showBar) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 xl:hidden bg-background border-t border-border/50 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <a
            href={tel}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-foreground/5 text-foreground text-xs font-medium"
          >
            <Phone className="w-3.5 h-3.5" />
            Call
          </a>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-[#25D366] text-primary-foreground text-xs font-medium"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={
              onMpv7Page
                ? mpv7PrebookUnlocked
                  ? buildCtaPath("/book-now", { ...pathAttr, model: "vinfast-mpv7", intent: "book-now" })
                  : "/models/mpv7#mpv7-prebook"
                : onLimoGreenPage
                  ? limoGreenPrebookUnlocked
                    ? buildCtaPath("/book-now", { ...pathAttr, model: "vinfast-limo-green", intent: "book-now" })
                    : "/models/limo-green#limo-green-prebook"
                  : buildCtaPath("/book-now", { ...pathAttr, intent: "book-now" })
            }
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-primary text-primary-foreground text-xs font-medium"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Book Now
          </Link>
          <Link
            to={buildCtaPath("/test-drive", { ...pathAttr, intent: "test-drive" })}
            className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-xl bg-foreground/10 text-foreground text-xs font-medium border border-border/60"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            Test Drive
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StickyMobileCTA;
