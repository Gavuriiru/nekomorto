import { AppProviders } from "@/components/AppProviders";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";

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
  location: _location,
}: PublicChromeIslandProps) => {
  const chrome =
    kind === "header" ? <Header variant="fixed" locationPath={_location} /> : <Footer />;
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

  return content;
};

export default PublicChromeIsland;
