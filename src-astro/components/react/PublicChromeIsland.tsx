import { AppProviders } from "@/components/AppProviders";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import { BrowserRouter, StaticRouter } from "react-router-dom";

interface PublicChromeIslandProps {
  initialCurrentUser?: unknown;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
  kind: "footer" | "header";
  location: string;
}

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
      {chrome}
    </AppProviders>
  );

  if (typeof window === "undefined") {
    return <StaticRouter location={location}>{content}</StaticRouter>;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
};

export default PublicChromeIsland;
