import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import PublicPhase3IslandApp from "./PublicPhase3IslandApp";

interface ProjectIslandAppProps {
  initialCurrentUser?: unknown;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
  slug: string;
  staticProjectHeroId?: string;
}

const ProjectIslandApp = ({
  initialCurrentUser,
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
  slug,
  staticProjectHeroId,
}: ProjectIslandAppProps) => (
  <PublicPhase3IslandApp
    initialCurrentUser={initialCurrentUser}
    initialPath={`/projeto/${encodeURIComponent(slug)}`}
    initialProjectSlug={slug}
    initialPublicBootstrap={initialPublicBootstrap}
    initialPublicRoutePayload={initialPublicRoutePayload}
    initialSettings={initialSettings}
    staticProjectHeroId={staticProjectHeroId}
  />
);

export default ProjectIslandApp;
