import { Link } from "react-router-dom";
import { Car, Calculator, ArrowLeftRight, MapPin, Phone, MessageCircle, CalendarDays } from "lucide-react";
import { useMemo } from "react";
import { usePublicSite } from "@/context/PublicSiteContext";
import { telHref, waMeUrl } from "@/lib/contactLinks";

const QuickActionBar = () => {
  const { dealer, siteConfig } = usePublicSite();
  const tel = telHref(siteConfig.phoneNumber || dealer.phone);
  const wa = waMeUrl(siteConfig.whatsappNumber || dealer.whatsapp);

  const actions = useMemo(
    () => [
      { icon: CalendarDays, label: "Test Drive", href: "/test-drive" as const, external: false },
      { icon: Car, label: "Get Price", href: "/contact" as const, external: false },
      { icon: Calculator, label: "EMI Calculator", href: "/emi-calculator" as const, external: false },
      { icon: ArrowLeftRight, label: "Exchange", href: "/contact" as const, external: false },
      { icon: MapPin, label: "Find Showroom", href: "/contact" as const, external: false },
      { icon: Phone, label: "Call", href: tel, external: true },
      { icon: MessageCircle, label: "WhatsApp", href: wa, external: true },
    ],
    [tel, wa],
  );

  return (
    <section className="relative z-10 mt-5 sm:mt-6 lg:mt-8 block">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="rounded-3xl border border-border bg-background px-4 py-4 lg:px-8 lg:py-5 overflow-x-auto sm:overflow-visible">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 lg:gap-4 sm:min-w-max lg:justify-center">
            {actions.map((action) => {
              const Icon = action.icon;
              const content = (
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl hover:bg-foreground/5 cursor-pointer group">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="text-xs sm:text-sm font-medium text-foreground/80 group-hover:text-foreground whitespace-nowrap">
                    {action.label}
                  </span>
                </div>
              );

              if (action.external) {
                return (
                  <a key={action.label} href={action.href} target="_blank" rel="noopener noreferrer">
                    {content}
                  </a>
                );
              }

              return (
                <Link key={action.label} to={action.href}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default QuickActionBar;
