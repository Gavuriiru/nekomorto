import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import PublicPhase3IslandApp from "./PublicPhase3IslandApp";

interface ProjectsIslandAppProps {
  initialCurrentUser?: unknown;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
}

const ProjectsIslandApp = ({
  initialCurrentUser,
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
}: ProjectsIslandAppProps) => (
  <PublicPhase3IslandApp
    initialCurrentUser={initialCurrentUser}
    initialPath="/projetos"
    initialPublicBootstrap={initialPublicBootstrap}
    initialPublicRoutePayload={initialPublicRoutePayload}
    initialSettings={initialSettings}
  />
);

export default ProjectsIslandApp;
