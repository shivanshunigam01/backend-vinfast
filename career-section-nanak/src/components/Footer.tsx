import { Link } from "react-router-dom";
import { Phone, Mail, MapPin, MessageCircle, Clock } from "lucide-react";
import vinfastLogo from "@/assets/patliputra-vinfast-logo.png";
import patliputraOutlineLogo from "@/assets/black outline logo patliputra.png";
import { usePublicSite } from "@/context/PublicSiteContext";
import { telHref, waMeUrl } from "@/lib/contactLinks";
import { mapsDirectionsHref } from "@/lib/dealerMap";
//test
const Footer = () => {
  const { dealer, siteConfig } = usePublicSite();
  const address = dealer.address;
  const mapHref = mapsDirectionsHref(address, dealer.mapEmbedUrl);
  const tel = telHref(siteConfig.phoneNumber || dealer.phone);
  const wa = waMeUrl(siteConfig.whatsappNumber || dealer.whatsapp);
  const mailTo = dealer.email
    ? `mailto:${dealer.email}`
    : "mailto:info@patliputravinfast.com";

  return (
    <footer className="section-surface border-t border-border/50">
      <div className="container mx-auto px-4 lg:px-8 py-16 lg:py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link
              to="/"
              className="flex items-center gap-2 sm:gap-3 mb-4 w-fit shrink-0 min-w-0"
            >
              <img
                src={vinfastLogo}
                alt={dealer.dealerName}
                className="h-10 sm:h-12 lg:h-16 w-auto max-h-full object-contain object-left"
              />
              <span
                className="hidden sm:block w-px h-4 sm:h-5 lg:h-7 self-center bg-border shrink-0"
                aria-hidden
              />
              <img
                src={patliputraOutlineLogo}
                alt="Patliputra Group"
                className="h-4 sm:h-5 lg:h-8 w-auto max-h-full object-contain object-left"
              />
            </Link>
            <p className="text-xs text-primary font-display font-semibold uppercase tracking-[0.15em] mb-3">
              Authorized Dealer, Bihar
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mb-6">
              {dealer.dealerName} — Bihar&apos;s authorized {dealer.brand}{" "}
              dealer. Experience electric SUVs and the seven-seat VF MPV 7 and
              Limo Green — world-class safety, technology, and support.
            </p>
            <div className="flex gap-4">
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
              <a
                href={tel}
                className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
              >
                <Phone className="w-4 h-4" />
              </a>
              <a
                href={mailTo}
                className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">
              Quick Links
            </h4>
            <ul className="space-y-3">
              {[
                { label: "Home", href: "/" },
                { label: "VF 7", href: "/models/vf7" },
                { label: "VF 6", href: "/models/vf6" },
                { label: "VF MPV 7", href: "/models/mpv7" },
                { label: "Limo Green", href: "/models/limo-green" },
                { label: "Compare Models", href: "/compare" },
                { label: "Book Now", href: "/book-now" },
                { label: "Book Test Drive", href: "/test-drive" },
                { label: "EMI Calculator", href: "/emi-calculator" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-muted-foreground text-sm hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* More */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">
              More
            </h4>
            <ul className="space-y-3">
              {[
                { label: "About Us", href: "/about" },
                { label: "Offers", href: "/contact" },
                { label: "Exchange Car", href: "/contact" },
                { label: "Finance Options", href: "/emi-calculator" },
                { label: "FAQ", href: "/about" },
                { label: "Contact Us", href: "/contact" },
              ].map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-muted-foreground text-sm hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">
              Contact Us
            </h4>
            <ul className="space-y-4">
              <li className="flex gap-3 text-sm">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 text-muted-foreground hover:text-foreground transition-colors break-words"
                >
                  {address}
                </a>
              </li>
              <li className="flex gap-3 text-sm">
                <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                <a
                  href={tel}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {siteConfig.phoneNumber || dealer.phone}
                </a>
              </li>
              <li className="flex gap-3 text-sm">
                <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                <a
                  href={mailTo}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dealer.email}
                </a>
              </li>
              <li className="flex gap-3 text-sm">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-muted-foreground">
                  {dealer.showroomHours}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar — extra bottom padding below lg so legal links sit above StickyMobileCTA (fixed z-40) */}
      <div className="border-t border-border/30">
        <div className="container mx-auto px-4 lg:px-8 pt-6 pb-[calc(8.5rem+env(safe-area-inset-bottom,0px))] lg:pb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left space-y-2">
            <p className="text-muted-foreground text-xs">
              © 2026 Patliputra VinFast. All rights reserved. Authorized VinFast
              Dealer, Bihar.
            </p>
            <p className="text-muted-foreground text-[10px] leading-snug max-w-xl">
              This site is protected by reCAPTCHA and the Google{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Privacy Policy
              </a>{" "}
              and{" "}
              <a
                href="https://policies.google.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Terms of Service
              </a>{" "}
              apply.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-6">
            <Link
              to="/privacy-policy"
              className="text-muted-foreground text-xs hover:text-foreground transition-colors inline-flex min-h-11 min-w-[44px] items-center justify-center px-3 py-2 rounded-md active:bg-foreground/5"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms-of-service"
              className="text-muted-foreground text-xs hover:text-foreground transition-colors inline-flex min-h-11 min-w-[44px] items-center justify-center px-3 py-2 rounded-md active:bg-foreground/5"
            >
              Terms of Service
            </Link>
            <Link
              to="/terms-and-conditions"
              className="text-muted-foreground text-xs hover:text-foreground transition-colors inline-flex min-h-11 min-w-[44px] items-center justify-center px-3 py-2 rounded-md active:bg-foreground/5"
            >
              Terms and Conditions
            </Link>
            <Link
              to="/payment-refund-policy"
              className="text-muted-foreground text-xs hover:text-foreground transition-colors inline-flex min-h-11 min-w-[44px] items-center justify-center px-3 py-2 rounded-md active:bg-foreground/5"
            >
              Payment &amp; Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
