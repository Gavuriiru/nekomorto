import { AppProviders } from "@/components/AppProviders";
import DashboardRoutes from "@/routes/DashboardRoutes";
import type { SiteSettings } from "@/types/site-settings";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

const FullReloadFallback = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const target = `${location.pathname}${location.search}${location.hash}`;
    window.location.assign(target);
  }, [location.hash, location.pathname, location.search]);

  return null;
};

const DashboardHostRoutes = () => (
  <Routes>
    <Route path="/dashboard/*" element={<DashboardRoutes />} />
    <Route path="*" element={<FullReloadFallback />} />
  </Routes>
);

interface DashboardIslandAppProps {
  initialSettings?: SiteSettings | null;
}

const DashboardIslandApp = ({ initialSettings }: DashboardIslandAppProps) => (
  <AppProviders initialSettings={initialSettings ?? undefined} initiallyLoaded={Boolean(initialSettings)}>
    <BrowserRouter>
      <DashboardHostRoutes />
    </BrowserRouter>
  </AppProviders>
);

export default DashboardIslandApp;
