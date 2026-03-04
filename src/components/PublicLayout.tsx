import { Outlet, useLocation } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";

const PublicLayout = () => {
  const location = useLocation();
  const hasSurfaceGradient = location.pathname === "/projetos";

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col",
        hasSurfaceGradient && "bg-gradient-surface text-foreground",
      )}
    >
      <Header />
      <main
        key={location.pathname}
        id="public-main-content"
        tabIndex={-1}
        className="a11y-focus-target flex-1 page-transition"
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
