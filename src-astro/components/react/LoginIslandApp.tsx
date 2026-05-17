import { AppProviders } from "@/components/AppProviders";
import Login from "@/pages/Login";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, StaticRouter, useLocation } from "react-router-dom";

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

const LoginRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="*" element={<FullReloadFallback />} />
  </Routes>
);

interface LoginIslandAppProps {
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
  location: string;
}

const LoginIslandApp = ({
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
  location,
}: LoginIslandAppProps) => {
  const content = (
    <AppProviders
      initialPublicBootstrap={initialPublicBootstrap}
      initialPublicRoutePayload={initialPublicRoutePayload}
      initialSettings={initialSettings ?? initialPublicBootstrap?.settings}
      initiallyLoaded={Boolean(initialSettings ?? initialPublicBootstrap?.settings)}
    >
      <LoginRoutes />
    </AppProviders>
  );

  if (typeof window === "undefined") {
    return <StaticRouter location={location}>{content}</StaticRouter>;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
};

export default LoginIslandApp;
