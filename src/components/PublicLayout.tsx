import { useLocation, Outlet } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const PublicLayout = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main key={location.pathname} className="flex-1 page-transition">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
