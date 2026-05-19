import Index from "@/pages/Index";
import Projects from "@/pages/Projects";
import { usePublicDocumentLocation } from "@/lib/public-document-navigation";
import type { PublicBootstrapPayload, PublicRoutePayload } from "@/types/public-bootstrap";
import type { SiteSettings } from "@/types/site-settings";
import PublicHydratedPage from "./PublicHydratedPage";

interface PublicHomeProjectsIslandAppProps {
  initialCurrentUser?: unknown;
  initialPublicBootstrap: PublicBootstrapPayload | null;
  initialPublicRoutePayload?: PublicRoutePayload | null;
  initialSettings?: SiteSettings | null;
}

const PublicHomeProjectsIslandApp = ({
  initialCurrentUser,
  initialPublicBootstrap,
  initialPublicRoutePayload,
  initialSettings,
}: PublicHomeProjectsIslandAppProps) => {
  const location = usePublicDocumentLocation("/");

  return (
    <PublicHydratedPage
      initialCurrentUser={initialCurrentUser}
      initialPublicBootstrap={initialPublicBootstrap}
      initialPublicRoutePayload={initialPublicRoutePayload}
      initialSettings={initialSettings}
    >
      {location.pathname === "/projetos" ? <Projects /> : <Index />}
    </PublicHydratedPage>
  );
};

export default PublicHomeProjectsIslandApp;
