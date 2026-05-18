import { AppProviders } from "@/components/AppProviders";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import { useEffect, useRef } from "react";
import { BrowserRouter, StaticRouter, useLocation } from "react-router-dom";

interface PublicChromeIslandProps {
  initialCurrentUser?: unknown;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
  kind: "footer" | "header";
  location: string;
}

export const PublicChromeNavigationBridge = ({
  onRouteChange = () => undefined,
}: {
  onRouteChange?: (target: string) => void;
}) => {
  const location = useLocation();
  const previousTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const target = `${location.pathname}${location.search}${location.hash}`;
    if (previousTargetRef.current === null) {
      previousTargetRef.current = target;
      return;
    }
    if (previousTargetRef.current === target) {
      return;
    }
    previousTargetRef.current = target;
    onRouteChange(target);
  }, [location.hash, location.pathname, location.search, onRouteChange]);

  return null;
};

const PublicChromeIsland = ({
  initialCurrentUser,
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
  kind,
  location,
}: PublicChromeIslandProps) => {
  const chrome = kind === "header" ? <Header variant="fixed" /> : <Footer />;
  const content = (
    <AppProviders
      initialCurrentUser={initialCurrentUser}
      initialPublicBootstrap={initialPublicBootstrap}
      initialPublicRoutePayload={initialPublicRoutePayload}
      initialSettings={initialSettings ?? initialPublicBootstrap?.settings}
      initiallyLoaded={Boolean(initialSettings ?? initialPublicBootstrap?.settings)}
    >
      <PublicChromeNavigationBridge />
      {chrome}
    </AppProviders>
  );

  if (typeof window === "undefined") {
    return <StaticRouter location={location}>{content}</StaticRouter>;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
};

export default PublicChromeIsland;
