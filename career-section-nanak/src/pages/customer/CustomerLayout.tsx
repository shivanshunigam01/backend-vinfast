import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { LogOut, CalendarCheck } from "lucide-react";
import vinfastLogo from "@/assets/patliputra-vinfast-logo.png";
import patliputraOutlineLogo from "@/assets/black outline logo patliputra.png";
import { Button } from "@/components/ui/button";
import { clearCustomerSession, getCustomerToken, getCustomerUser } from "@/lib/customerAuth";

export default function CustomerLayout() {
  const navigate = useNavigate();
  const customer = getCustomerUser();

  useEffect(() => {
    if (!getCustomerToken()) {
      navigate("/customer/login", { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    clearCustomerSession();
    navigate("/customer/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="flex min-w-0 items-center gap-1.5 overflow-hidden sm:gap-2">
              <img
                src={vinfastLogo}
                alt="Patliputra VinFast"
                className="h-8 w-auto max-w-[7.5rem] shrink object-contain object-left sm:h-10 sm:max-w-[11rem]"
              />
              <span className="h-5 w-px shrink-0 bg-border sm:h-6" aria-hidden />
              <img
                src={patliputraOutlineLogo}
                alt="Patliputra Group"
                className="h-5 w-auto max-w-[5.5rem] shrink-0 object-contain object-left sm:h-6 sm:max-w-[7.5rem]"
              />
            </Link>
            <span className="hidden sm:inline shrink-0 text-sm font-medium text-muted-foreground">
              Customer Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            {customer ? (
              <div className="hidden sm:block text-right text-sm">
                <p className="font-medium text-foreground">{customer.name}</p>
                <p className="text-muted-foreground">{customer.mobile}</p>
              </div>
            ) : null}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-primary" />
            My Test Drive Bookings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All bookings linked to your mobile number. You can reschedule upcoming drives from here.
          </p>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
