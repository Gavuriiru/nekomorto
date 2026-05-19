import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import PublicPhase3IslandApp from "./PublicPhase3IslandApp";

interface HomeIslandAppProps {
  initialCurrentUser?: unknown;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
}

const HomeIslandApp = ({
  initialCurrentUser,
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
}: HomeIslandAppProps) => (
  <PublicPhase3IslandApp
    initialCurrentUser={initialCurrentUser}
    initialPath="/"
    initialPublicBootstrap={initialPublicBootstrap}
    initialPublicRoutePayload={initialPublicRoutePayload}
    initialSettings={initialSettings}
  />
);

export default HomeIslandApp;
