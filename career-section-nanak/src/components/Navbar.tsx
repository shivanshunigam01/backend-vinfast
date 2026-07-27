import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Phone, MessageCircle, UserCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import vinfastLogo from "@/assets/patliputra-vinfast-logo.png";
import patliputraOutlineLogo from "@/assets/black outline logo patliputra.png";
import { usePublicSite } from "@/context/PublicSiteContext";
import { telHref, waMeUrl } from "@/lib/contactLinks";
import { getCustomerToken } from "@/lib/customerAuth";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "VF 7", href: "/models/vf7" },
  { label: "VF 6", href: "/models/vf6" },
  { label: "VF MPV 7", href: "/models/mpv7" },
  { label: "Limo Green", href: "/models/limo-green" },
  { label: "Compare", href: "/compare" },
  { label: "Test Drive", href: "/test-drive" },
  { label: "EMI Calculator", href: "/emi-calculator" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const loginOptions = [
  { label: "Customer", href: "/customer/login" },
  { label: "Staff", href: "/staff/login" },
  { label: "Admin", href: "/admin/login" },
] as const;

const GAP_PX = 2;
const MORE_BTN_RESERVE_PX = 84;

const Navbar = () => {
  const { dealer, siteConfig } = usePublicSite();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(navLinks.length);
  const location = useLocation();
  const tel = telHref(siteConfig.phoneNumber || dealer.phone);
  const wa = waMeUrl(siteConfig.whatsappNumber || dealer.whatsapp);
  const customerLoggedIn = Boolean(getCustomerToken());
  const loginActive =
    location.pathname.startsWith("/customer") ||
    location.pathname.startsWith("/admin/login") ||
    location.pathname.startsWith("/staff/login");

  const navSlotRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  useEffect(() => {
    if (!isMobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileOpen]);

  useLayoutEffect(() => {
    const slot = navSlotRef.current;
    const measure = measureRef.current;
    if (!slot || !measure) return;

    const recalc = () => {
      const available = slot.clientWidth;
      if (available <= 0) return;

      const items = Array.from(measure.children) as HTMLElement[];
      const widths = items.map((el) => el.getBoundingClientRect().width);
      const totalAll =
        widths.reduce((sum, w) => sum + w, 0) + Math.max(0, widths.length - 1) * GAP_PX;

      if (totalAll <= available) {
        setVisibleCount(navLinks.length);
        return;
      }

      let used = MORE_BTN_RESERVE_PX;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        const next = used + (count > 0 ? GAP_PX : 0) + widths[i];
        if (next > available) break;
        used = next;
        count += 1;
      }
      // Keep at least Home + More when space is very tight
      setVisibleCount(Math.max(1, count));
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(slot);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, []);

  const visibleLinks = navLinks.slice(0, visibleCount);
  const overflowLinks = navLinks.slice(visibleCount);
  const moreActive = overflowLinks.some((link) => location.pathname === link.href);

  const linkClass = (active: boolean) =>
    cn(
      "shrink-0 rounded-lg px-2 py-2 text-[0.8125rem] font-medium whitespace-nowrap transition-colors",
      active ? "text-primary" : "text-foreground/70 hover:text-foreground",
    );

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto w-full max-w-[100%] px-3 sm:px-4 lg:px-5">
          <div className="flex h-16 items-center gap-2 sm:h-[4.25rem] sm:gap-3 lg:h-[4.5rem]">
            <Link
              to="/"
              className="flex min-w-0 shrink items-center gap-1.5 overflow-hidden sm:gap-2 lg:max-w-[18rem] xl:max-w-[20rem]"
            >
              <img
                src={vinfastLogo}
                alt={dealer.dealerName}
                className="h-9 w-auto max-w-[9.5rem] object-contain object-left sm:h-11 sm:max-w-[12rem] lg:h-11 lg:max-w-[13rem]"
              />
              <span className="hidden h-6 w-px shrink-0 bg-border md:block" aria-hidden />
              <img
                src={patliputraOutlineLogo}
                alt="Patliputra Group"
                className="hidden h-6 w-auto max-w-[7rem] object-contain object-left md:block lg:h-7 lg:max-w-[8.5rem]"
              />
            </Link>

            {/* Desktop / laptop / MacBook nav — fits what it can, rest goes into More */}
            <div ref={navSlotRef} className="relative hidden min-w-0 flex-1 lg:block">
              {/* Off-screen measurer — keeps real widths even while nav is condensed */}
              <div
                ref={measureRef}
                aria-hidden
                className="pointer-events-none fixed left-0 top-0 z-[-1] flex items-center gap-0.5 opacity-0"
              >
                {navLinks.map((link) => (
                  <span key={link.href} className={linkClass(false)}>
                    {link.label}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-center gap-0.5">
                {visibleLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={linkClass(location.pathname === link.href)}
                  >
                    {link.label}
                  </Link>
                ))}

                {overflowLinks.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          linkClass(moreActive),
                          "inline-flex items-center gap-0.5 outline-none data-[state=open]:text-primary",
                        )}
                        aria-label="More navigation links"
                      >
                        More
                        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[11rem]">
                      {overflowLinks.map((link) => (
                        <DropdownMenuItem key={link.href} asChild>
                          <Link
                            to={link.href}
                            className={cn(
                              "cursor-pointer",
                              location.pathname === link.href && "text-primary font-medium",
                            )}
                          >
                            {link.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-0">
              {customerLoggedIn ? (
                <Link
                  to="/customer/bookings"
                  className={cn(
                    "hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors lg:inline-flex",
                    location.pathname.startsWith("/customer")
                      ? "text-primary"
                      : "text-foreground/70 hover:text-foreground",
                  )}
                >
                  <UserCircle className="h-4 w-4" />
                  My Bookings
                </Link>
              ) : (
                <div className="relative hidden lg:block">
                  <div className="group/login">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors outline-none",
                        loginActive
                          ? "text-primary"
                          : "text-foreground/70 hover:text-foreground group-hover/login:text-foreground",
                      )}
                      aria-haspopup="menu"
                      aria-label="Login options"
                    >
                      <UserCircle className="h-4 w-4" />
                      Login
                      <ChevronDown className="h-3.5 w-3.5 opacity-70 transition-transform group-hover/login:rotate-180" />
                    </button>
                    <div
                      className={cn(
                        "invisible absolute right-0 top-full z-50 min-w-[9.5rem] pt-1.5 opacity-0 transition-[opacity,visibility] duration-150",
                        "group-hover/login:visible group-hover/login:opacity-100",
                        "group-focus-within/login:visible group-focus-within/login:opacity-100",
                      )}
                    >
                      <div
                        role="menu"
                        className="rounded-xl border border-border/70 bg-popover p-1.5 shadow-md"
                      >
                        {loginOptions.map((option) => (
                          <Link
                            key={option.href}
                            to={option.href}
                            role="menuitem"
                            className={cn(
                              "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              location.pathname === option.href
                                ? "bg-primary/10 text-primary"
                                : "text-foreground/80 hover:bg-muted/60 hover:text-foreground",
                            )}
                          >
                            {option.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <a
                href={tel}
                className="hidden text-foreground/60 transition-colors hover:text-foreground xl:block"
                aria-label="Call us"
              >
                <Phone className="h-4 w-4" />
              </a>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden text-foreground/60 transition-colors hover:text-foreground xl:block"
                aria-label="WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>

              <Button
                variant="hero"
                size="sm"
                asChild
                className="h-8 px-2.5 text-[0.7rem] sm:h-9 sm:px-3 sm:text-xs"
              >
                <Link to="/book-now">Book Now</Link>
              </Button>

              <button
                type="button"
                onClick={() => setIsMobileOpen((open) => !open)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground touch-manipulation lg:hidden"
                aria-expanded={isMobileOpen}
                aria-controls="mobile-nav-panel"
                aria-label={isMobileOpen ? "Close menu" : "Open menu"}
              >
                {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            key="mobile-nav-panel"
            id="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 z-40 flex flex-col bg-background pt-16 sm:pt-[4.25rem] lg:hidden"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="mx-auto flex w-full max-w-lg flex-col gap-1 px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      "rounded-xl px-4 py-3 text-base font-medium transition-colors sm:text-lg",
                      location.pathname === link.href
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/70 hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                {customerLoggedIn ? (
                  <Link
                    to="/customer/bookings"
                    className={cn(
                      "rounded-xl px-4 py-3 text-base font-medium transition-colors sm:text-lg",
                      location.pathname.startsWith("/customer")
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/70 hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    My Bookings
                  </Link>
                ) : (
                  <>
                    <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Login
                    </p>
                    {loginOptions.map((option) => (
                      <Link
                        key={option.href}
                        to={option.href}
                        className={cn(
                          "rounded-xl px-4 py-3 text-base font-medium transition-colors sm:text-lg",
                          location.pathname === option.href
                            ? "bg-primary/10 text-primary"
                            : "text-foreground/70 hover:bg-muted/50 hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </Link>
                    ))}
                  </>
                )}
                <div className="mt-5 flex flex-col gap-3">
                  <Button variant="hero" size="lg" className="w-full" asChild>
                    <Link to="/book-now">Book Now</Link>
                  </Button>
                  <Button variant="outline" size="lg" className="w-full" asChild>
                    <Link to="/test-drive">Book Test Drive</Link>
                  </Button>
                  <Button variant="whatsapp" size="lg" className="w-full" asChild>
                    <a href={wa} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-5 w-5" /> WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
