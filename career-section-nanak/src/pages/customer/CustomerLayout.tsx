import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { LogOut, CalendarCheck } from "lucide-react";
import vinLogo from "@/assets/patliputra-vinfast-logo.png";
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
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-3">
            <img src={vinLogo} alt="Patliputra VinFast" className="h-10 w-auto object-contain" />
            <span className="hidden sm:inline text-sm font-medium text-muted-foreground">Customer Portal</span>
          </Link>

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
