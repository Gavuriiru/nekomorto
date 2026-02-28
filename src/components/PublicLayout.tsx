import { Outlet, useLocation } from "react-router-dom";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import SkipLinks from "@/components/SkipLinks";

const PublicLayout = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLinks links={[{ href: "#public-main-content", label: "Pular para o conteúdo" }]} />
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
