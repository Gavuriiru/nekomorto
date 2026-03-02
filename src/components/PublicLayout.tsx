import { Outlet, useLocation } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

const PublicLayout = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
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
